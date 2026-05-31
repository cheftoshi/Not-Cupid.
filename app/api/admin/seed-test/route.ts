import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { devLoginUrl } from '@/lib/dev-login';

export const dynamic = 'force-dynamic';

// Two compatible Boston test users (similar HEXACO + vibes → high score, same
// metro within match radius, each seeking the other's gender). Flagged is_test.
const SEED = [
  {
    email: 'alex+test@notcupid.dev', name: 'Test Alex', gender: 'm', seeking: 'f',
    age: 30, age_min: 25, age_max: 36, zip: '02116', archetype: 'The Grounded Optimist',
    bio: "Test account. Runs on cold brew and long walks along the Charles. Will absolutely overanalyze a movie with you.",
    occupation: 'Product designer', education: 'Northeastern',
    photo_url: 'https://i.pravatar.cc/500?img=12',
    music: ['indie', 'jazz'], food: ['ramen', 'tacos'], hobbies: ['running', 'film', 'cooking'],
    score_honesty: 13, score_emotionality: 9, score_extraversion: 11,
    score_agreeableness: 12, score_conscientiousness: 13, score_openness: 14,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 3 },
  },
  {
    email: 'bailey+test@notcupid.dev', name: 'Test Bailey', gender: 'f', seeking: 'm',
    age: 29, age_min: 27, age_max: 38, zip: '02118', archetype: 'The Curious Realist',
    bio: "Test account. South End regular, trivia-night ringer, will fight you on the best North End cannoli.",
    occupation: 'Data scientist', education: 'BU',
    photo_url: 'https://i.pravatar.cc/500?img=45',
    music: ['indie', 'soul'], food: ['ramen', 'thai'], hobbies: ['running', 'reading', 'film'],
    score_honesty: 14, score_emotionality: 10, score_extraversion: 10,
    score_agreeableness: 13, score_conscientiousness: 12, score_openness: 15,
    vibes: { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 2 },
  },
];

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  const ids: string[] = [];

  for (const u of SEED) {
    const row = { ...u, is_test: true, status: 'waiting', pool_active: true,
      matching_cooldown_until: null, matching_disabled_at: null, deleted_at: null };
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(row, { onConflict: 'email' })
      .select('id')
      .single();
    if (error) {
      console.error('seed-test upsert failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    ids.push(data.id);
  }

  // Reset matchability so re-seeding always yields a clean, re-pickable pair:
  // drop any matches + history between the two test users (cascades messages),
  // and put both back to waiting/active.
  const [a, b] = ids;
  await supabaseAdmin.from('matches').delete()
    .or(`and(user_1_id.eq.${a},user_2_id.eq.${b}),and(user_1_id.eq.${b},user_2_id.eq.${a})`);
  const [lo, hi] = [a, b].sort();
  await supabaseAdmin.from('match_history').delete().eq('user_a_id', lo).eq('user_b_id', hi);
  await supabaseAdmin.from('users')
    .update({ status: 'waiting', pool_active: true })
    .in('id', ids);

  const logins = SEED.map((u, i) => ({
    name: u.name, email: u.email, loginUrl: devLoginUrl(baseUrl, ids[i]),
  }));

  return NextResponse.json({
    ok: true,
    message: 'Open each login link in a SEPARATE browser/incognito window, then have one pick the other.',
    accounts: logins,
  });
}
