import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { joinCircle } from '@/lib/friend-circles';
import { devLoginUrl } from '@/lib/dev-login';

export const dynamic = 'force-dynamic';

// A self-contained TEST WORLD, segregated from real users (is_test = true, and
// matching/roster/pulse only ever pair test↔test). After seeding, logging in as
// Test Alex gives you:
//   • a live, both-accepted DATING match with Test Bailey (date-vibes ready)
//   • a 5-person FRIEND crew (Alex + the other 5) with a live group chat
// so every flow is testable on demand without touching real accounts.
const ACTS = ['food & restaurants', 'outdoors & hikes', 'bars & nightlife', 'gaming & nerdy stuff', 'creative & art', 'workouts & run club', 'live music', 'coffee shops'];

const SEED = [
  {
    email: 'alex+test@notcupid.dev', name: 'Test Alex', gender: 'm', seeking: 'f',
    age: 30, age_min: 25, age_max: 36, zip: '02116', archetype: 'The Grounded Optimist',
    bio: 'Test account. Runs on cold brew and long walks along the Charles.',
    occupation: 'Product designer', education: 'Northeastern', photo_url: 'https://i.pravatar.cc/500?img=12',
    music: ['indie', 'jazz'], food: ['ramen', 'tacos'], hobbies: ['running', 'film', 'cooking'],
    score_honesty: 13, score_emotionality: 9, score_extraversion: 11, score_agreeableness: 12, score_conscientiousness: 13, score_openness: 14,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 3 },
    activities: ['food & restaurants', 'outdoors & hikes', 'live music'],
  },
  {
    email: 'bailey+test@notcupid.dev', name: 'Test Bailey', gender: 'f', seeking: 'm',
    age: 29, age_min: 27, age_max: 38, zip: '02118', archetype: 'The Curious Realist',
    bio: 'Test account. South End regular, trivia-night ringer.',
    occupation: 'Data scientist', education: 'BU', photo_url: 'https://i.pravatar.cc/500?img=45',
    music: ['indie', 'soul'], food: ['ramen', 'thai'], hobbies: ['running', 'reading', 'film'],
    score_honesty: 14, score_emotionality: 10, score_extraversion: 10, score_agreeableness: 13, score_conscientiousness: 12, score_openness: 15,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 2 },
    activities: ['food & restaurants', 'live music', 'creative & art'],
  },
  {
    email: 'cam+test@notcupid.dev', name: 'Test Cam', gender: 'm', seeking: 'f',
    age: 31, age_min: 26, age_max: 38, zip: '02139', archetype: 'The Easygoing Builder',
    bio: 'Test account. Cambridge climber, will rope you into a run club.',
    occupation: 'Engineer', education: 'MIT', photo_url: 'https://i.pravatar.cc/500?img=33',
    music: ['rock', 'electronic'], food: ['pizza', 'korean'], hobbies: ['climbing', 'running', 'board games'],
    score_honesty: 12, score_emotionality: 8, score_extraversion: 13, score_agreeableness: 11, score_conscientiousness: 12, score_openness: 13,
    vibes: { chronotype: 1, date_freq: 2, future: 2, comm: 2, social: 3, risk: 3 },
    activities: ['outdoors & hikes', 'workouts & run club', 'gaming & nerdy stuff'],
  },
  {
    email: 'dev+test@notcupid.dev', name: 'Test Dev', gender: 'f', seeking: 'm',
    age: 28, age_min: 25, age_max: 35, zip: '02143', archetype: 'The Warm Connector',
    bio: 'Test account. Somerville, always knows the new spot.',
    occupation: 'PM', education: 'Tufts', photo_url: 'https://i.pravatar.cc/500?img=47',
    music: ['pop', 'soul'], food: ['thai', 'tacos'], hobbies: ['cooking', 'art', 'trivia'],
    score_honesty: 13, score_emotionality: 11, score_extraversion: 12, score_agreeableness: 14, score_conscientiousness: 11, score_openness: 14,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 2 },
    activities: ['food & restaurants', 'creative & art', 'coffee shops'],
  },
  {
    email: 'eli+test@notcupid.dev', name: 'Test Eli', gender: 'm', seeking: 'f',
    age: 32, age_min: 27, age_max: 39, zip: '02134', archetype: 'The Quiet Adventurer',
    bio: 'Test account. Allston, vinyl crates and long bike rides.',
    occupation: 'Writer', education: 'Emerson', photo_url: 'https://i.pravatar.cc/500?img=51',
    music: ['indie', 'jazz'], food: ['ramen', 'pizza'], hobbies: ['cycling', 'music', 'film'],
    score_honesty: 14, score_emotionality: 9, score_extraversion: 9, score_agreeableness: 12, score_conscientiousness: 13, score_openness: 15,
    vibes: { chronotype: 3, date_freq: 2, future: 2, comm: 2, social: 2, risk: 2 },
    activities: ['live music', 'bars & nightlife', 'outdoors & hikes'],
  },
  {
    email: 'frankie+test@notcupid.dev', name: 'Test Frankie', gender: 'f', seeking: 'm',
    age: 30, age_min: 26, age_max: 37, zip: '02130', archetype: 'The Spirited Realist',
    bio: 'Test account. JP, brunch evangelist, hosts game nights.',
    occupation: 'Teacher', education: 'UMass', photo_url: 'https://i.pravatar.cc/500?img=20',
    music: ['pop', 'rock'], food: ['brunch', 'thai'], hobbies: ['board games', 'reading', 'hiking'],
    score_honesty: 13, score_emotionality: 12, score_extraversion: 12, score_agreeableness: 13, score_conscientiousness: 12, score_openness: 13,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 2 },
    activities: ['gaming & nerdy stuff', 'food & restaurants', 'outdoors & hikes'],
  },
];

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  const now = new Date().toISOString();
  const ids: string[] = [];

  for (const u of SEED) {
    const { activities, ...rest } = u;
    const row = {
      ...rest, is_test: true, status: 'waiting', pool_active: true,
      matching_cooldown_until: null, matching_disabled_at: null, deleted_at: null, is_blocked: false,
      friend_opted_in_at: now,
      friend_vibes: { intent: 'open to both', activities, cadence: 'weekly', group_size: 'small', life_stage: 'settling in' },
      friend_seeking: ['grab a drink', 'try new spots'],
    };
    const { data, error } = await supabaseAdmin
      .from('users').upsert(row, { onConflict: 'email' }).select('id').single();
    if (error) {
      console.error('seed-test upsert failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    ids.push(data.id);
  }

  // ── Clean slate (so re-seeding is idempotent) ──
  await supabaseAdmin.from('matches').delete().in('user_1_id', ids);
  await supabaseAdmin.from('matches').delete().in('user_2_id', ids);
  await supabaseAdmin.from('match_history').delete().in('user_a_id', ids);
  await supabaseAdmin.from('match_history').delete().in('user_b_id', ids);
  await supabaseAdmin.from('friend_connections').delete().in('user_a_id', ids);
  await supabaseAdmin.from('friend_connections').delete().in('user_b_id', ids);
  await supabaseAdmin.from('friend_circle_members').delete().in('user_id', ids);
  await supabaseAdmin.from('friend_match_history').delete().in('user_a_id', ids);
  await supabaseAdmin.from('friend_match_history').delete().in('user_b_id', ids);

  // ── Dating: a live, both-accepted match between Alex (0) and Bailey (1) ──
  const [alex, bailey] = ids;
  await supabaseAdmin.from('matches').insert({
    user_1_id: alex, user_2_id: bailey, compatibility_score: 94,
    status: 'both_accepted', user_1_accepted: true, user_2_accepted: true,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  await supabaseAdmin.from('users').update({ status: 'matched', last_matched_at: now }).in('id', [alex, bailey]);

  // ── Friend: Alex's crew = the other 5, all connected into one live circle ──
  const friendIds = ids.slice(1);
  const scores = [78, 72, 69, 65, 61];
  let circleId: string | null = null;
  for (let i = 0; i < friendIds.length; i++) {
    const other = friendIds[i];
    circleId = await joinCircle(alex, other);
    const [ua, ub] = [alex, other].sort();
    await supabaseAdmin.from('friend_connections').upsert(
      {
        user_a_id: ua, user_b_id: ub, status: 'connected',
        a_picked: true, b_picked: true, circle_id: circleId,
        compatibility_score: scores[i] ?? 60, connected_at: now,
      },
      { onConflict: 'user_a_id,user_b_id' }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Test world ready. Log in as Test Alex: live dating match with Test Bailey + a 5-person friend crew with a live group chat. Test accounts only ever match other test accounts.',
    accounts: SEED.map((u, i) => ({ name: u.name, email: u.email, loginUrl: devLoginUrl(baseUrl, ids[i]) })),
  });
}
