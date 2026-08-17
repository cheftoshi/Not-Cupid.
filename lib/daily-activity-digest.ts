import 'server-only';
import { sendEmail } from '@/lib/email';
import { defaultEmailReplyTo, looksLikePublicPostalAddress } from '@/lib/email-address';
import {
  DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION,
  DAILY_ACTIVITY_EMAIL_HOUR_ET,
  DAILY_ACTIVITY_EMAIL_SUBJECT,
  DailyActivityItem,
  dailyActivityContentKey,
  dailyActivityCounts,
  dailyActivityEmailActivation,
  dailyActivityEmailHtml,
} from '@/lib/daily-activity-email';
import { isLgbtqIdentity } from '@/lib/friend-matching';
import { metroOf } from '@/lib/quiz-data';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 7 * DAY_MS;
const MAX_ITEMS_PER_SECTION = 4;
const MAX_SENDS_PER_RUN = 300;

type UserRow = {
  id: string; name: string | null; email: string | null; zip: string | null;
  gender: string | null; age: number | null; is_lgbtq: boolean | null;
  email_notifications: boolean | null; notifications_paused_at: string | null;
  friend_opted_in_at: string | null; activity_digest_sent_at: string | null;
  is_test: boolean | null; deleted_at: string | null; is_blocked: boolean | null;
};

export type DailyActivityCandidate = {
  user: UserRow;
  items: DailyActivityItem[];
  contentKey: string;
};

function firstName(name: string | null | undefined) {
  return (name || 'there').trim().split(/\s+/)[0] || 'there';
}

function latestIso(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => !!value).sort().at(-1) || new Date(Date.now() - DAY_MS).toISOString();
}

function pushItem(itemsByUser: Map<string, DailyActivityItem[]>, userId: string, item: DailyActivityItem) {
  const items = itemsByUser.get(userId) || [];
  if (!items.some((existing) => existing.kind === item.kind && existing.entityId === item.entityId)) items.push(item);
  itemsByUser.set(userId, items);
}

function eligibleForActivity(user: UserRow, activity: any) {
  const genders = Array.isArray(activity.audience_gender) ? activity.audience_gender : [];
  if (genders.length && !genders.includes(user.gender) && !(genders.includes('lgbtq') && isLgbtqIdentity(user))) return false;
  if (activity.audience_age_min != null && (user.age == null || user.age < activity.audience_age_min)) return false;
  if (activity.audience_age_max != null && (user.age == null || user.age > activity.audience_age_max)) return false;
  return true;
}

function eventWhen(activity: any) {
  if (!activity.happens_at) return activity.area || 'Open the plan in Friend Hub';
  return new Date(activity.happens_at).toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export async function collectDailyActivityCandidates(now = new Date()): Promise<DailyActivityCandidate[]> {
  const nowIso = now.toISOString();
  const lookbackIso = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const today = nowIso.slice(0, 10);
  const planningEnd = new Date(now.getTime() + 30 * DAY_MS).toISOString().slice(0, 10);

  const [users, matches, loveMessages, activities, rsvps, comments, planReads, clubs, clubMembers, clubMessages, circles, circleMembers, circleMessages, chatReads, friendDms, dmReads, trips] = await Promise.all([
    fetchAllSupabaseRows<UserRow>((from, to) => supabaseAdmin.from('users').select('id,name,email,zip,gender,age,is_lgbtq,email_notifications,notifications_paused_at,friend_opted_in_at,activity_digest_sent_at,is_test,deleted_at,is_blocked').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('matches').select('id,user_1_id,user_2_id,user_1_accepted,user_2_accepted,user_1_read_at,user_2_read_at,status,created_at,expires_at,chat_expires_at,ended_at').is('ended_at', null).order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('messages').select('id,match_id,sender_id,created_at').gte('created_at', lookbackIso).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_activities').select('id,author_id,title,kind,area,metro,is_test,happens_at,expires_at,created_at,audience_gender,audience_age_min,audience_age_max').or(`expires_at.is.null,expires_at.gt.${nowIso}`).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_activity_rsvps').select('activity_id,user_id,response,created_at').order('created_at').order('activity_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_activity_comments').select('id,activity_id,user_id,created_at').gte('created_at', lookbackIso).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_plan_chat_reads').select('activity_id,user_id,read_at').order('user_id').order('activity_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_clubs').select('id,name,creator_id,is_test,hidden_at').is('hidden_at', null).order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_club_members').select('club_id,user_id,status').eq('status', 'member').order('club_id').order('user_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_club_messages').select('id,club_id,sender_id,created_at').gte('created_at', lookbackIso).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_circles').select('id').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_circle_members').select('circle_id,user_id,left_at').is('left_at', null).order('circle_id').order('user_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_messages').select('id,circle_id,sender_id,created_at').gte('created_at', lookbackIso).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_chat_reads').select('user_id,thread_kind,thread_id,read_at').order('user_id').order('thread_kind').order('thread_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_dms').select('id,user_a_id,user_b_id,sender_id,created_at').gte('created_at', lookbackIso).order('created_at').order('id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_dm_reads').select('user_id,other_id,read_at').order('user_id').order('other_id').range(from, to)),
    fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_trips').select('user_id,destination_metro,starts_on,ends_on,status').eq('status', 'active').gte('ends_on', today).lte('starts_on', planningEnd).order('user_id').order('starts_on').range(from, to)),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const targets = users.filter((user) => user.is_test !== true && !user.deleted_at && user.is_blocked !== true && !!user.email && user.email_notifications !== false && !user.notifications_paused_at);
  const targetById = new Map(targets.map((user) => [user.id, user]));
  const itemsByUser = new Map<string, DailyActivityItem[]>();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

  const messagesByMatch = new Map<string, any[]>();
  for (const message of loveMessages) {
    const list = messagesByMatch.get(message.match_id) || [];
    list.push(message);
    messagesByMatch.set(message.match_id, list);
  }

  for (const match of matches) {
    if (match.ended_at || ['ended', 'passed', 'expired'].includes(match.status)) continue;
    const both = !!match.user_1_accepted && !!match.user_2_accepted;
    for (const side of [1, 2] as const) {
      const recipientId = match[`user_${side}_id`];
      const otherId = match[`user_${side === 1 ? 2 : 1}_id`];
      const recipient = targetById.get(recipientId);
      const other = userById.get(otherId);
      if (!recipient || !other || other.is_test === true) continue;
      const baseline = latestIso(recipient.activity_digest_sent_at);
      const mineAccepted = !!match[`user_${side}_accepted`];
      const otherAccepted = !!match[`user_${side === 1 ? 2 : 1}_accepted`];
      if (!both && otherAccepted && !mineAccepted && (!match.expires_at || match.expires_at > nowIso) && match.created_at > baseline) {
        pushItem(itemsByUser, recipientId, {
          section: 'love', kind: 'love_interest', entityId: match.id, label: `${firstName(other.name)} chose you`,
          detail: 'Say yes back to make it mutual and open the chat.', url: `${baseUrl}/dashboard?from=daily-activity-drop`, occurredAt: match.created_at,
        });
      }
      if (!both) continue;
      const readAt = match[`user_${side}_read_at`] || null;
      const unread = (messagesByMatch.get(match.id) || []).filter((message) => message.sender_id !== recipientId && message.created_at > latestIso(readAt, recipient.activity_digest_sent_at));
      if (unread.length) {
        pushItem(itemsByUser, recipientId, {
          section: 'love', kind: 'love_message', entityId: match.id, label: `${unread.length} unread message${unread.length === 1 ? '' : 's'} from ${firstName(other.name)}`,
          detail: 'Your Love Line conversation is waiting.', url: `${baseUrl}/match/${match.id}?from=daily-activity-drop`, occurredAt: unread.at(-1).created_at, count: unread.length,
        });
      } else if (!readAt) {
        const mutualAt = match.chat_expires_at ? new Date(new Date(match.chat_expires_at).getTime() - 36 * 60 * 60 * 1000).toISOString() : match.created_at;
        if (mutualAt > baseline) pushItem(itemsByUser, recipientId, {
          section: 'love', kind: 'love_mutual', entityId: match.id, label: `You matched with ${firstName(other.name)}`,
          detail: 'The chat is open—say something real.', url: `${baseUrl}/match/${match.id}?from=daily-activity-drop`, occurredAt: mutualAt,
        });
      }
    }
  }

  const tripByUser = new Map<string, any>();
  for (const trip of trips) if (!tripByUser.has(trip.user_id)) tripByUser.set(trip.user_id, trip);
  const activityById = new Map(activities.filter((activity) => activity.is_test !== true).map((activity) => [activity.id, activity]));
  const yesByActivity = new Map<string, string[]>();
  for (const rsvp of rsvps) {
    if (rsvp.response !== 'yes' || !activityById.has(rsvp.activity_id)) continue;
    const list = yesByActivity.get(rsvp.activity_id) || [];
    list.push(rsvp.user_id);
    yesByActivity.set(rsvp.activity_id, list);
  }

  for (const recipient of targets.filter((user) => !!user.friend_opted_in_at)) {
    const baseline = latestIso(recipient.activity_digest_sent_at);
    const metro = tripByUser.get(recipient.id)?.destination_metro || metroOf(recipient.zip);
    if (!metro) continue;
    const newPlans = activities
      .filter((activity) => activity.is_test !== true && (activity.kind || 'event') === 'event' && activity.author_id !== recipient.id && activity.metro === metro && activity.created_at > baseline && eligibleForActivity(recipient, activity))
      .sort((a, b) => String(a.happens_at || a.created_at).localeCompare(String(b.happens_at || b.created_at)))
      .slice(0, MAX_ITEMS_PER_SECTION);
    for (const activity of newPlans) pushItem(itemsByUser, recipient.id, {
      section: 'plans', kind: 'new_plan', entityId: activity.id, label: activity.title,
      detail: eventWhen(activity), url: `${baseUrl}/friends?view=scene&plan=${encodeURIComponent(activity.id)}&from=daily-activity-drop`, occurredAt: activity.created_at,
    });
  }

  // Organizers get one grouped daily line when new people RSVP yes/maybe.
  for (const activity of activityById.values()) {
    const host = targetById.get(activity.author_id);
    if (!host?.friend_opted_in_at) continue;
    const responses = rsvps.filter((row) => row.activity_id === activity.id && row.user_id !== host.id && ['yes', 'maybe'].includes(row.response) && row.created_at > latestIso(host.activity_digest_sent_at));
    if (!responses.length) continue;
    pushItem(itemsByUser, host.id, {
      section: 'friend', kind: 'plan_rsvp', entityId: activity.id, label: `${responses.length} response${responses.length === 1 ? '' : 's'} to ${activity.title}`,
      detail: 'Open the plan to see who is interested and start coordinating.', url: `${baseUrl}/friends?view=scene&plan=${encodeURIComponent(activity.id)}&from=daily-activity-drop`, occurredAt: responses.at(-1).created_at, count: responses.length,
    });
  }

  const planReadByKey = new Map(planReads.map((row) => [`${row.user_id}:${row.activity_id}`, row.read_at]));
  const planParticipants: Array<{ userId: string; activityId: string }> = [];
  for (const activity of activityById.values()) {
    planParticipants.push({ userId: activity.author_id, activityId: activity.id });
    for (const userId of yesByActivity.get(activity.id) || []) planParticipants.push({ userId, activityId: activity.id });
  }
  for (const participant of planParticipants) {
    const recipient = targetById.get(participant.userId);
    const activity = activityById.get(participant.activityId);
    const readAt = planReadByKey.get(`${participant.userId}:${participant.activityId}`);
    if (!recipient?.friend_opted_in_at || !activity || !readAt) continue;
    const unread = comments.filter((comment) => comment.activity_id === participant.activityId && comment.user_id !== participant.userId && comment.created_at > latestIso(readAt, recipient.activity_digest_sent_at));
    if (!unread.length) continue;
    pushItem(itemsByUser, participant.userId, {
      section: 'friend', kind: 'plan_chat', entityId: participant.activityId, label: `${unread.length} new message${unread.length === 1 ? '' : 's'} in ${activity.title}`,
      detail: 'The organizer and interested people are coordinating.', url: `${baseUrl}/friends?view=scene&plan=${encodeURIComponent(participant.activityId)}&from=daily-activity-drop`, occurredAt: unread.at(-1).created_at, count: unread.length,
    });
  }

  const clubById = new Map(clubs.filter((club) => club.is_test !== true).map((club) => [club.id, club]));
  const clubMemberships: Array<{ userId: string; threadId: string }> = [];
  for (const club of clubById.values()) clubMemberships.push({ userId: club.creator_id, threadId: club.id });
  for (const member of clubMembers) if (clubById.has(member.club_id)) clubMemberships.push({ userId: member.user_id, threadId: member.club_id });
  const circleIds = new Set(circles.map((circle) => circle.id));
  const circleMemberships = circleMembers.filter((member) => circleIds.has(member.circle_id)).map((member) => ({ userId: member.user_id, threadId: member.circle_id }));
  const chatReadByKey = new Map(chatReads.map((row) => [`${row.user_id}:${row.thread_kind}:${row.thread_id}`, row.read_at]));

  for (const member of clubMemberships) {
    const recipient = targetById.get(member.userId);
    const club = clubById.get(member.threadId);
    const readAt = chatReadByKey.get(`${member.userId}:club:${member.threadId}`);
    if (!recipient?.friend_opted_in_at || !club || !readAt) continue;
    const unread = clubMessages.filter((message) => message.club_id === member.threadId && message.sender_id !== member.userId && message.created_at > latestIso(readAt, recipient.activity_digest_sent_at) && userById.get(message.sender_id)?.is_test !== true);
    if (!unread.length) continue;
    pushItem(itemsByUser, member.userId, {
      section: 'friend', kind: 'club_chat', entityId: member.threadId, label: `${unread.length} unread in ${club.name}`,
      detail: 'Your club chat has new activity.', url: `${baseUrl}/friends?view=pulse&club=${encodeURIComponent(member.threadId)}&from=daily-activity-drop`, occurredAt: unread.at(-1).created_at, count: unread.length, chatKind: 'club', chatId: member.threadId,
    });
  }

  for (const member of circleMemberships) {
    const recipient = targetById.get(member.userId);
    const readAt = chatReadByKey.get(`${member.userId}:circle:${member.threadId}`);
    if (!recipient?.friend_opted_in_at || !readAt) continue;
    const unread = circleMessages.filter((message) => message.circle_id === member.threadId && message.sender_id !== member.userId && message.created_at > latestIso(readAt, recipient.activity_digest_sent_at) && userById.get(message.sender_id)?.is_test !== true);
    if (!unread.length) continue;
    pushItem(itemsByUser, member.userId, {
      section: 'friend', kind: 'pack_chat', entityId: member.threadId, label: `${unread.length} unread in your pack chat`,
      detail: 'Your Friend Line crew has been talking.', url: `${baseUrl}/friends?view=crew&chat=pack&from=daily-activity-drop`, occurredAt: unread.at(-1).created_at, count: unread.length, chatKind: 'circle', chatId: member.threadId,
    });
  }

  const dmReadByKey = new Map(dmReads.map((row) => [`${row.user_id}:${row.other_id}`, row.read_at]));
  for (const recipient of targets.filter((user) => !!user.friend_opted_in_at)) {
    const unreadByOther = new Map<string, any[]>();
    for (const message of friendDms) {
      if (message.sender_id === recipient.id || (message.user_a_id !== recipient.id && message.user_b_id !== recipient.id)) continue;
      const otherId = message.user_a_id === recipient.id ? message.user_b_id : message.user_a_id;
      if (userById.get(otherId)?.is_test === true || message.created_at <= latestIso(dmReadByKey.get(`${recipient.id}:${otherId}`), recipient.activity_digest_sent_at)) continue;
      const list = unreadByOther.get(otherId) || [];
      list.push(message);
      unreadByOther.set(otherId, list);
    }
    for (const [otherId, unread] of unreadByOther) {
      pushItem(itemsByUser, recipient.id, {
        section: 'friend', kind: 'friend_dm', entityId: otherId, label: `${unread.length} unread from ${firstName(userById.get(otherId)?.name)}`,
        detail: 'A friend sent you a private message.', url: `${baseUrl}/friends?dm=${encodeURIComponent(otherId)}&from=daily-activity-drop`, occurredAt: unread.at(-1).created_at, count: unread.length,
      });
    }
  }

  return targets.flatMap((user) => {
    const all = (itemsByUser.get(user.id) || []).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const selected = (['love', 'friend', 'plans'] as const).flatMap((section) => all.filter((item) => item.section === section).slice(0, MAX_ITEMS_PER_SECTION));
    return selected.length ? [{ user, items: selected, contentKey: dailyActivityContentKey(selected) }] : [];
  });
}

export async function runDailyActivityDigest(opts: { send?: boolean; now?: Date } = {}) {
  const now = opts.now || new Date();
  const activation = dailyActivityEmailActivation();
  const mailingAddress = process.env.EMAIL_MAILING_ADDRESS?.trim() || '';
  const mailingAddressReady = looksLikePublicPostalAddress(mailingAddress);
  const candidates = await collectDailyActivityCandidates(now);
  const send = opts.send === true && activation.enabled && mailingAddressReady;
  let sent = 0;
  let failed = 0;
  let skippedClaimed = 0;
  const totals = candidates.reduce((sum, candidate) => {
    const counts = dailyActivityCounts(candidate.items);
    sum.love += counts.love; sum.friend += counts.friend; sum.plans += counts.plans;
    return sum;
  }, { love: 0, friend: 0, plans: 0 });

  if (send) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
    for (const candidate of candidates.slice(0, MAX_SENDS_PER_RUN)) {
      const counts = dailyActivityCounts(candidate.items);
      const { error: claimError } = await supabaseAdmin.from('activity_digest_deliveries').insert({
        user_id: candidate.user.id, content_key: candidate.contentKey, status: 'queued', item_counts: counts,
      });
      if (claimError) {
        if ((claimError as any).code === '23505') skippedClaimed++;
        else failed++;
        continue;
      }
      const result = await sendEmail({
        to: candidate.user.email!, subject: DAILY_ACTIVITY_EMAIL_SUBJECT,
        html: dailyActivityEmailHtml({ userId: candidate.user.id, firstName: firstName(candidate.user.name), items: candidate.items, baseUrl, mailingAddress }),
        idempotencyKey: `daily-activity-${candidate.user.id}-${candidate.contentKey}`,
        tags: [{ name: 'category', value: 'daily_activity' }, { name: 'template', value: DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION }],
      });
      if (!result.ok) {
        failed++;
        await supabaseAdmin.from('activity_digest_deliveries').delete().eq('user_id', candidate.user.id).eq('content_key', candidate.contentKey);
        continue;
      }
      const sentAt = now.toISOString();
      await Promise.all([
        supabaseAdmin.from('activity_digest_deliveries').update({ status: 'sent', provider_email_id: result.id || null, sent_at: sentAt }).eq('user_id', candidate.user.id).eq('content_key', candidate.contentKey),
        supabaseAdmin.from('users').update({ activity_digest_sent_at: sentAt }).eq('id', candidate.user.id),
      ]);
      sent++;
    }
  }

  const sampleItems: DailyActivityItem[] = [
    { section: 'love', kind: 'love_interest', entityId: 'sample-love', label: 'Maya chose you', detail: 'Say yes back to make it mutual and open the chat.', url: 'https://notcupid.com/dashboard?from=daily-activity-drop', occurredAt: now.toISOString() },
    { section: 'friend', kind: 'club_chat', entityId: 'sample-club', label: '3 unread in Tennis in Boston', detail: 'Your club chat has new activity.', url: 'https://notcupid.com/friends?view=pulse&club=sample&from=daily-activity-drop', occurredAt: now.toISOString(), count: 3 },
    { section: 'plans', kind: 'new_plan', entityId: 'sample-plan', label: 'Run along the Charles', detail: 'Tue, Aug 18, 6:30 PM', url: 'https://notcupid.com/friends?view=scene&plan=sample&from=daily-activity-drop', occurredAt: now.toISOString() },
  ];

  return {
    enabled: activation.enabled,
    sendRequested: opts.send === true,
    deliveryAttempted: send,
    templateVersion: DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION,
    requiredEnv: {
      enabled: 'DAILY_ACTIVITY_EMAILS_ENABLED=true',
      template: `DAILY_ACTIVITY_EMAIL_TEMPLATE_VERSION=${DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION}`,
    },
    schedule: `daily at ${DAILY_ACTIVITY_EMAIL_HOUR_ET}:00 ET`,
    sender: 'NotCupid <match@notcupid.com>', replyTo: defaultEmailReplyTo(),
    subject: DAILY_ACTIVITY_EMAIL_SUBJECT,
    audienceDefinition: 'Real, non-deleted, non-blocked users with email notifications enabled who have at least one actionable Love update, unread Friend conversation, new Scene response, or eligible local plan since their last daily drop. Opening a conversation clears its unread state. Test accounts and cross-realm activity are excluded.',
    candidates: candidates.length, totals, mailingAddressReady, sent, failed, skippedClaimed,
    reason: !activation.enabled ? 'automatic delivery remains template-and-send approval gated' : !mailingAddressReady ? 'mailing address is missing or invalid' : undefined,
    template: {
      greeting: 'Hi {{first_name}},', headline: 'Here’s what’s waiting for you.',
      intro: 'A quick daily drop of activity you haven’t opened yet.',
      dynamicSections: ['Love Line', 'Friend Hub', 'Plans near you'],
      primaryCta: 'OPEN NOTCUPID →', primaryUrl: 'https://notcupid.com/hub?from=daily-activity-drop',
      cadence: 'Sent at most once a day—and only when there’s something new or unread.',
      footer: `NotCupid · operated by Lemon Labs · ${mailingAddress || '[mailing address]'} · Unsubscribe`,
      sampleItems,
    },
  };
}
