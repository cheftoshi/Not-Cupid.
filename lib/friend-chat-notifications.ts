import { button, escapeHtml, renderEmail, sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase';
import type { FriendChatKind } from '@/lib/friend-chat-read';

export const FRIEND_CHAT_EMAIL_DELAY_HOURS = 12;
export const FRIEND_CHAT_EMAIL_APPROVAL_VERSION = 'friend-chat-unread-v1';
const DELAY_MS = FRIEND_CHAT_EMAIL_DELAY_HOURS * 60 * 60 * 1000;
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CANDIDATES_PER_RUN = 100;

type Membership = { userId: string; threadKind: FriendChatKind; threadId: string; threadName: string };
type ChatMessage = { id: string; threadId: string; senderId: string; createdAt: string };
type ReadRow = {
  user_id: string;
  thread_kind: FriendChatKind;
  thread_id: string;
  read_at: string;
  email_notified_at: string | null;
};

export type FriendChatEmailCandidate = Membership & {
  email: string;
  recipientName: string;
  unreadCount: number;
  oldestUnreadAt: string;
  latestUnreadAt: string;
  latestMessageId: string;
  url: string;
};

export function friendChatEmailActivation() {
  const enabled = process.env.FRIEND_CHAT_EMAILS_ENABLED === 'true';
  const approvedVersion = process.env.FRIEND_CHAT_EMAIL_TEMPLATE_VERSION || '';
  return {
    enabled: enabled && approvedVersion === FRIEND_CHAT_EMAIL_APPROVAL_VERSION,
    requested: enabled,
    approvedVersion,
    requiredVersion: FRIEND_CHAT_EMAIL_APPROVAL_VERSION,
  };
}

export function friendChatEmailCopy(input: { threadName: string; unreadCount: number; url: string; recipientId?: string }) {
  const countLabel = `${input.unreadCount} unread message${input.unreadCount === 1 ? '' : 's'}`;
  const subject = `${countLabel} in ${input.threadName}`;
  const safeThreadName = escapeHtml(input.threadName);
  const html = renderEmail({
    preheader: `${countLabel} waiting in ${input.threadName}.`,
    eyebrow: 'friend line · unread messages',
    headline: 'your group has been talking.',
    bodyHtml: `
      <p style="margin:0 0 14px 0;">You have <strong>${countLabel}</strong> in ${safeThreadName}.</p>
      <p style="margin:0 0 18px 0;">We waited 12 hours before sending this reminder so your inbox stays quiet.</p>
      ${button({ href: input.url, label: 'open the conversation →' })}
    `,
    recipientId: input.recipientId,
    footerNote: 'one email per unread stretch — opening the chat resets it.',
  });
  return { subject, html };
}

function membershipKey(member: Pick<Membership, 'userId' | 'threadKind' | 'threadId'>) {
  return `${member.userId}:${member.threadKind}:${member.threadId}`;
}

function threadKey(kind: FriendChatKind, id: string) {
  return `${kind}:${id}`;
}

async function collectFriendChatEmailCandidates(now = new Date()): Promise<{ candidates: FriendChatEmailCandidate[]; bootstrapped: number; reason?: string }> {
  const [clubsRes, clubMembersRes, circleMembersRes, readsRes] = await Promise.all([
    supabaseAdmin.from('friend_clubs').select('id, name, creator_id, is_test, hidden_at').is('hidden_at', null),
    supabaseAdmin.from('friend_club_members').select('club_id, user_id').eq('status', 'member'),
    supabaseAdmin.from('friend_circle_members').select('circle_id, user_id').is('left_at', null),
    supabaseAdmin.from('friend_chat_reads').select('user_id, thread_kind, thread_id, read_at, email_notified_at'),
  ]);
  const schemaError = clubsRes.error || clubMembersRes.error || circleMembersRes.error || readsRes.error;
  if (schemaError) {
    return { candidates: [], bootstrapped: 0, reason: `chat notification schema unavailable: ${schemaError.message}` };
  }

  const clubs = (clubsRes.data ?? []).filter((club: any) => club.is_test !== true);
  const clubById = new Map(clubs.map((club: any) => [club.id, club]));
  const membershipByKey = new Map<string, Membership>();
  for (const row of clubMembersRes.data ?? []) {
    const club: any = clubById.get(row.club_id);
    if (!club) continue;
    const member = { userId: row.user_id, threadKind: 'club' as const, threadId: row.club_id, threadName: club.name || 'your club' };
    membershipByKey.set(membershipKey(member), member);
  }
  for (const club of clubs as any[]) {
    const member = { userId: club.creator_id, threadKind: 'club' as const, threadId: club.id, threadName: club.name || 'your club' };
    membershipByKey.set(membershipKey(member), member);
  }
  for (const row of circleMembersRes.data ?? []) {
    const member = { userId: row.user_id, threadKind: 'circle' as const, threadId: row.circle_id, threadName: 'your pack chat' };
    membershipByKey.set(membershipKey(member), member);
  }
  const memberships = Array.from(membershipByKey.values());

  const readByKey = new Map((readsRes.data ?? []).map((read: any) => [membershipKey({
    userId: read.user_id,
    threadKind: read.thread_kind,
    threadId: read.thread_id,
  }), read as ReadRow]));
  const missingReads = memberships.filter((member) => !readByKey.has(membershipKey(member)));
  if (missingReads.length) {
    const { error } = await supabaseAdmin.from('friend_chat_reads').upsert(
      missingReads.map((member) => ({
        user_id: member.userId,
        thread_kind: member.threadKind,
        thread_id: member.threadId,
        read_at: now.toISOString(),
      })),
      { onConflict: 'user_id,thread_kind,thread_id', ignoreDuplicates: true },
    );
    if (error) return { candidates: [], bootstrapped: 0, reason: `could not initialize read cursors: ${error.message}` };
  }

  const eligibleMemberships = memberships.filter((member) => readByKey.has(membershipKey(member)));
  if (!eligibleMemberships.length) return { candidates: [], bootstrapped: missingReads.length };

  const userIds = Array.from(new Set(eligibleMemberships.map((member) => member.userId)));
  const { data: users, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, email_notifications, notifications_paused_at, is_test, deleted_at')
    .in('id', userIds);
  if (userError) return { candidates: [], bootstrapped: missingReads.length, reason: `could not load recipients: ${userError.message}` };
  const userById = new Map((users ?? [])
    .filter((user: any) => user.is_test !== true && !user.deleted_at && user.email && user.email_notifications !== false && !user.notifications_paused_at)
    .map((user: any) => [user.id, user]));

  const clubIds = Array.from(new Set(eligibleMemberships.filter((m) => m.threadKind === 'club').map((m) => m.threadId)));
  const circleIds = Array.from(new Set(eligibleMemberships.filter((m) => m.threadKind === 'circle').map((m) => m.threadId)));
  const lookbackIso = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const [clubMessagesRes, circleMessagesRes] = await Promise.all([
    clubIds.length
      ? supabaseAdmin.from('friend_club_messages').select('id, club_id, sender_id, created_at').in('club_id', clubIds).gte('created_at', lookbackIso).order('created_at', { ascending: true }).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    circleIds.length
      ? supabaseAdmin.from('friend_messages').select('id, circle_id, sender_id, created_at').in('circle_id', circleIds).gte('created_at', lookbackIso).order('created_at', { ascending: true }).limit(10000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const messageError = clubMessagesRes.error || circleMessagesRes.error;
  if (messageError) return { candidates: [], bootstrapped: missingReads.length, reason: `could not load unread messages: ${messageError.message}` };

  const messagesByThread = new Map<string, ChatMessage[]>();
  const addMessage = (kind: FriendChatKind, threadId: string, row: any) => {
    const key = threadKey(kind, threadId);
    const list = messagesByThread.get(key) || [];
    list.push({ id: row.id, threadId, senderId: row.sender_id, createdAt: row.created_at });
    messagesByThread.set(key, list);
  };
  (clubMessagesRes.data ?? []).forEach((row: any) => addMessage('club', row.club_id, row));
  (circleMessagesRes.data ?? []).forEach((row: any) => addMessage('circle', row.circle_id, row));

  const dueBefore = now.getTime() - DELAY_MS;
  const candidates: FriendChatEmailCandidate[] = [];
  for (const member of eligibleMemberships) {
    const recipient: any = userById.get(member.userId);
    if (!recipient) continue;
    const read = readByKey.get(membershipKey(member));
    if (!read || read.email_notified_at) continue;
    const readAt = new Date(read.read_at).getTime();
    const unread = (messagesByThread.get(threadKey(member.threadKind, member.threadId)) || [])
      .filter((message) => message.senderId !== member.userId && new Date(message.createdAt).getTime() > readAt);
    if (!unread.length || new Date(unread[0].createdAt).getTime() > dueBefore) continue;
    const latest = unread[unread.length - 1];
    candidates.push({
      ...member,
      email: recipient.email,
      recipientName: recipient.name || 'there',
      unreadCount: unread.length,
      oldestUnreadAt: unread[0].createdAt,
      latestUnreadAt: latest.createdAt,
      latestMessageId: latest.id,
      url: member.threadKind === 'club'
        ? `/friends?view=pulse&club=${encodeURIComponent(member.threadId)}`
        : '/friends?view=crew&chat=pack',
    });
  }
  candidates.sort((a, b) => a.oldestUnreadAt.localeCompare(b.oldestUnreadAt));
  return { candidates: candidates.slice(0, MAX_CANDIDATES_PER_RUN), bootstrapped: missingReads.length };
}

export async function runFriendChatUnreadNotifications(opts: { send?: boolean; now?: Date } = {}) {
  const now = opts.now || new Date();
  const activation = friendChatEmailActivation();
  const collected = await collectFriendChatEmailCandidates(now);
  const send = opts.send === true && activation.enabled;
  let sent = 0;
  let failed = 0;

  if (send) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
    for (const candidate of collected.candidates) {
      const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_friend_chat_email', {
        p_user_id: candidate.userId,
        p_thread_kind: candidate.threadKind,
        p_thread_id: candidate.threadId,
        p_latest_message_at: candidate.latestUnreadAt,
        p_now: now.toISOString(),
      });
      if (claimError || claimed !== true) continue;

      const copy = friendChatEmailCopy({
        threadName: candidate.threadName,
        unreadCount: candidate.unreadCount,
        url: `${base}${candidate.url}`,
        recipientId: candidate.userId,
      });
      const result = await sendEmail({
        to: candidate.email,
        subject: copy.subject,
        html: copy.html,
        idempotencyKey: `friend-unread-${candidate.threadKind}-${candidate.threadId}-${candidate.userId}-${new Date(candidate.latestUnreadAt).getTime()}`,
      });
      if (!result.ok) {
        failed++;
        continue;
      }
      const { error: stampError } = await supabaseAdmin.from('friend_chat_reads').update({ email_notified_at: now.toISOString() })
        .eq('user_id', candidate.userId).eq('thread_kind', candidate.threadKind).eq('thread_id', candidate.threadId);
      if (stampError) console.error('[friend-chat-email] sent but could not stamp notification', { error: stampError.message });
      sent++;
    }
  }

  const preview = friendChatEmailCopy({
    threadName: 'Tennis in Boston',
    unreadCount: 3,
    url: 'https://notcupid.com/friends?view=pulse&club=example',
  });
  return {
    enabled: activation.enabled,
    sendRequested: opts.send === true,
    delayHours: FRIEND_CHAT_EMAIL_DELAY_HOURS,
    templateVersion: FRIEND_CHAT_EMAIL_APPROVAL_VERSION,
    candidates: collected.candidates.length,
    clubCandidates: collected.candidates.filter((candidate) => candidate.threadKind === 'club').length,
    packCandidates: collected.candidates.filter((candidate) => candidate.threadKind === 'circle').length,
    bootstrapped: collected.bootstrapped,
    sent,
    failed,
    reason: collected.reason || (!activation.enabled ? 'email delivery remains approval-gated' : undefined),
    template: {
      subject: preview.subject,
      preheader: '3 unread messages waiting in Tennis in Boston.',
      headline: 'your group has been talking.',
      body: 'You have 3 unread messages in Tennis in Boston. We waited 12 hours before sending this reminder so your inbox stays quiet.',
      cta: 'open the conversation →',
    },
  };
}
