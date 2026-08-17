import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { friendActivityInCurrentMetro, hasFriendActivityHistory } from '@/lib/friend-activity-access';
import { sameRealm } from '@/lib/realm';

export const dynamic = 'force-dynamic';

// Comments on a Scene post, plus a participant-only plan chat for events.
// Event chat deliberately stays attached to the plan instead of opening an
// unrestricted 1:1 DM: only the organizer and people currently RSVP'd "yes"
// can read or write it.

async function canUseEventChat(userId: string, activity: { author_id: string; kind?: string | null }, activityId: string) {
  if ((activity.kind || 'event') !== 'event' || activity.author_id === userId) return true;
  const { data: response } = await supabaseAdmin
    .from('friend_activity_rsvps')
    .select('response')
    .eq('activity_id', activityId)
    .eq('user_id', userId)
    .maybeSingle();
  return response?.response === 'yes';
}

// GET — the comment thread (oldest first), with each commenter's basics.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const openedAt = new Date().toISOString();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: activity } = await supabaseAdmin.from('friend_activities')
    .select('id, author_id, kind, metro, is_test').eq('id', id).maybeSingle();
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!sameRealm(user, activity)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const retained = await hasFriendActivityHistory(user.id, id);
  if (!retained && !(await friendActivityInCurrentMetro(user, activity))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await canUseEventChat(user.id, activity, id))) {
    return NextResponse.json({ error: 'RSVP interested to join this plan chat.' }, { status: 403 });
  }

  const { data: comments } = await supabaseAdmin
    .from('friend_activity_comments')
    .select('id, user_id, body, created_at')
    .eq('activity_id', id)
    .order('created_at', { ascending: true })
    .limit(200);

  const ids = Array.from(new Set((comments ?? []).map((c) => c.user_id)));
  const { data: users } = await supabaseAdmin
    .from('users').select('id, name, photo_url')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  // Opening the plan conversation marks it read for the consolidated daily
  // activity drop. Best-effort keeps the chat usable during a rolling deploy.
  await supabaseAdmin.from('friend_plan_chat_reads').upsert({
    activity_id: id, user_id: user.id, read_at: (comments ?? []).at(-1)?.created_at || openedAt,
  }, { onConflict: 'activity_id,user_id' }).then(undefined, () => {});

  return NextResponse.json({
    comments: (comments ?? []).map((c) => {
      const u: any = byId.get(c.user_id) || {};
      return { id: c.id, body: c.body, created_at: c.created_at, name: u.name, photo_url: u.photo_url, isMe: c.user_id === user.id };
    }),
  });
}

// POST { body } — add a comment; ping the post author (not yourself).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const limit = await rateLimit({ key: `friend-comment:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many comments' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { body } = await req.json().catch(() => ({}));
  const text = String(body ?? '').trim().slice(0, 1000);
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });

  const { data: act } = await supabaseAdmin
    .from('friend_activities').select('id, author_id, title, kind, metro, is_test').eq('id', id).maybeSingle();
  if (!act) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!sameRealm(user, act)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const retained = await hasFriendActivityHistory(user.id, id);
  if (!retained && !(await friendActivityInCurrentMetro(user, act))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await canUseEventChat(user.id, act, id))) {
    return NextResponse.json({ error: 'RSVP interested to join this plan chat.' }, { status: 403 });
  }

  const { data: row, error } = await supabaseAdmin
    .from('friend_activity_comments')
    .insert({ activity_id: id, user_id: user.id, body: text })
    .select('id, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Could not add comment' }, { status: 500 });

  const first = (user.name || 'someone').split(' ')[0];
  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
  const isEvent = (act.kind || 'event') === 'event';
  if (isEvent) {
    // A plan chat is a small coordination room. Notify the host and everyone
    // who has committed "interested", excluding the sender. A stable tag keeps
    // an active exchange from stacking several lock-screen cards.
    const { data: attendees } = await supabaseAdmin
      .from('friend_activity_rsvps')
      .select('user_id')
      .eq('activity_id', id)
      .eq('response', 'yes');
    const recipients = new Set<string>([act.author_id, ...(attendees ?? []).map((row: any) => row.user_id)]);
    recipients.delete(user.id);
    await Promise.all(Array.from(recipients).map((recipientId) => sendPushToUser(recipientId, {
      title: `${first} · ${act.title || 'plan chat'} 💬`,
      body: preview,
      url: `/friends?view=scene&plan=${encodeURIComponent(id)}`,
      tag: `friend-plan-chat-${id}`,
    }).catch(() => false)));
  } else if (act.author_id && act.author_id !== user.id) {
    await sendPushToUser(act.author_id, {
      title: `${first} commented 💬`,
      body: preview,
      url: `/friends?view=scene&plan=${encodeURIComponent(id)}`,
      tag: `friend-comment-${id}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    comment: { id: row.id, body: row.body, created_at: row.created_at, name: user.name, photo_url: (user as any).photo_url, isMe: true },
  });
}
