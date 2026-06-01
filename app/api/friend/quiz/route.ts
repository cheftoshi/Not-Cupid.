import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeFriendVibes, hasFriendVibes } from '@/lib/friend-quiz';

export const dynamic = 'force-dynamic';

const VALID_GENDERS = ['m', 'f', 'nb', 'o'];

// Save the incremental friend quiz + gender openness, and opt the user into the
// friend pool. Requires the user to already have a HEXACO profile (they reuse it).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (typeof user.score_honesty !== 'number') {
    return NextResponse.json({ error: 'Take the main quiz first — the Friend Line reuses your personality profile.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const friend_vibes = normalizeFriendVibes(body.friend_vibes ?? body);
  if (!hasFriendVibes(friend_vibes)) {
    return NextResponse.json({ error: 'Pick at least one activity you want to do with friends.' }, { status: 400 });
  }
  const friend_seeking = Array.isArray(body.friend_seeking)
    ? Array.from(new Set(body.friend_seeking.filter((g: any) => VALID_GENDERS.includes(g))))
    : [];

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      friend_vibes,
      friend_seeking,
      friend_opted_in_at: user.friend_opted_in_at || new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('friend quiz save error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
