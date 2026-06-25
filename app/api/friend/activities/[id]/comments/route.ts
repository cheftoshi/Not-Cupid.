import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Comments on a Scene post — a talk post becomes a little thread.

// GET — the comment thread (oldest first), with each commenter's basics.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: comments } = await supabaseAdmin
    .from('friend_activity_comments')
    .select('id, user_id, body, created_at')
    .eq('activity_id', params.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const ids = Array.from(new Set((comments ?? []).map((c) => c.user_id)));
  const { data: users } = await supabaseAdmin
    .from('users').select('id, name, photo_url')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return NextResponse.json({
    comments: (comments ?? []).map((c) => {
      const u: any = byId.get(c.user_id) || {};
      return { id: c.id, body: c.body, created_at: c.created_at, name: u.name, photo_url: u.photo_url, isMe: c.user_id === user.id };
    }),
  });
}

// POST { body } — add a comment; ping the post author (not yourself).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });

  const { body } = await req.json().catch(() => ({}));
  const text = String(body ?? '').trim().slice(0, 1000);
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });

  const { data: act } = await supabaseAdmin
    .from('friend_activities').select('id, author_id, title').eq('id', params.id).maybeSingle();
  if (!act) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: row, error } = await supabaseAdmin
    .from('friend_activity_comments')
    .insert({ activity_id: params.id, user_id: user.id, body: text })
    .select('id, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (act.author_id && act.author_id !== user.id) {
    const first = (user.name || 'someone').split(' ')[0];
    await sendPushToUser(act.author_id, {
      title: `${first} commented 💬`,
      body: text.length > 80 ? text.slice(0, 80) + '…' : text,
      url: '/friends?view=scene', tag: `friend-comment-${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    comment: { id: row.id, body: row.body, created_at: row.created_at, name: user.name, photo_url: (user as any).photo_url, isMe: true },
  });
}
