import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { activeCircleOf } from '@/lib/friend-circles';
import { canUseFriendCircle } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// GET: the caller's friend-circle group chat — members + messages.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const circleId = await activeCircleOf(user.id);
  if (!circleId) return NextResponse.json({ circleId: null, members: [], messages: [] });

  const { data: memberRows } = await supabaseAdmin
    .from('friend_circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
    .is('left_at', null);
  const ids = (memberRows ?? []).map((m) => m.user_id);

  const { data: members } = await supabaseAdmin
    .from('users').select('id, name, photo_url').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const unlocked = await canUseFriendCircle(user, circleId);

  // When locked, return the roster (members) but withhold message bodies so the
  // UI can show a paywall over a real, populated chat.
  const { data: messages } = unlocked
    ? await supabaseAdmin
        .from('friend_messages')
        .select('id, sender_id, body, created_at')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: true })
    : { data: [] };

  return NextResponse.json({ circleId, members: members ?? [], messages: messages ?? [], locked: !unlocked });
}

// POST: send a message to the caller's friend circle.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body } = await req.json().catch(() => ({}));
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (body.length > 2000) return NextResponse.json({ error: 'Too long (max 2000)' }, { status: 400 });

  const circleId = await activeCircleOf(user.id);
  if (!circleId) return NextResponse.json({ error: 'You have no friend circle yet — match with someone first.' }, { status: 400 });

  // Paywall: Pro (all chats) OR this specific crew unlocked ($0.99).
  if (!(await canUseFriendCircle(user, circleId))) {
    return NextResponse.json({ error: 'locked', needsUnlock: true }, { status: 402 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('friend_messages')
    .insert({ circle_id: circleId, sender_id: user.id, body: body.trim() })
    .select('id, sender_id, body, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message });
}
