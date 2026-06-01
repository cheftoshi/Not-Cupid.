// POST /api/profile/refresh
//
// Full "start over" for a user: wipes quiz + profile content + matches +
// history (both Love and Friend lines), but KEEPS the account/email/session.
// Capped at MAX_REFRESHES per account (tracked on users.profile_refresh_count,
// so it's per-email-unique). After this, the user re-takes the core quiz.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_REFRESHES = 3;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const used = user.profile_refresh_count ?? 0;
  if (used >= MAX_REFRESHES) {
    return NextResponse.json(
      { error: `You've used all ${MAX_REFRESHES} profile refreshes for this account.` },
      { status: 429 }
    );
  }

  const now = new Date().toISOString();

  // End any live matches (Love line) — same as the delete flow.
  await supabaseAdmin
    .from('matches')
    .update({ ended_at: now, ended_reason: 'user_requiz' })
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null);

  // Clear match history so a fresh profile can re-meet people.
  await supabaseAdmin
    .from('match_history')
    .delete()
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

  // Friend line: drop connections + history + leave circles so they re-pool.
  await supabaseAdmin.from('friend_connections').delete()
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  await supabaseAdmin.from('friend_match_history').delete()
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  // Soft-leave any friend circles (matches the app's left_at convention).
  await supabaseAdmin.from('friend_circle_members')
    .update({ left_at: now }).eq('user_id', user.id).is('left_at', null);

  // Wipe quiz + profile content, reset pool state, opt out of both lines, and
  // bump the refresh counter. Keep name/email/age/gender/seeking/zip (account
  // identity) so they don't have to re-enter the basics or re-verify email.
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      // personality / quiz
      archetype: null,
      score_honesty: null, score_emotionality: null, score_extraversion: null,
      score_agreeableness: null, score_conscientiousness: null, score_openness: null,
      vibes: null,
      // profile content
      bio: null, music: null, food: null, hobbies: null, prompts: null,
      gallery: [], relationship_style: null,
      // love-line pool state
      status: 'waiting', pool_active: true, roster_snapshot: [], roster_refreshed_at: null,
      // friend-line opt-out (they re-take the friend quiz if they want back in)
      friend_opted_in_at: null, friend_vibes: null, friend_seeking: [],
      friend_age_min: null, friend_age_max: null,
      // bookkeeping
      profile_refresh_count: used + 1,
    })
    .eq('id', user.id);

  if (error) {
    console.error('profile refresh error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, remaining: MAX_REFRESHES - (used + 1) });
}
