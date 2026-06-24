import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, ageMutual } from '@/lib/raffle';
import { isGenderMatch } from '@/lib/matching';
import { metroOf } from '@/lib/quiz-data';
import { sendPushToUser } from '@/lib/push';

const COLS = 'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, hobbies, music, food, sports, ' +
  'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, ' +
  'vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, is_test';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

// The raffle draw — AUTO, no human picks. We raffle ONE date per round: draw the
// single BEST-matched eligible pair (by the hobbies-weighted raffleScore), one
// at a time. If they don't both accept, the willing one is re-drawn to the next
// best — each entrant gets at most RAFFLE.maxAttempts (2) draws, then they're
// out. Stops once a pair mutually accepts (the winner) or no pairs remain.
export async function drawRaffle(): Promise<{ ok: true; entrants: number; drawn: number; pair?: { a: string; b: string; score: number }; state: string }> {
  // Already a winner this round? done.
  const { data: won } = await supabaseAdmin.from('raffle_draws').select('id').eq('event_key', RAFFLE.key).eq('status', 'both_accepted').limit(1);
  if (won && won.length) return { ok: true, entrants: 0, drawn: 0, state: 'winner-locked' };
  // A pair is already out there awaiting a yes/no — only one live pair at a time.
  const { data: pend } = await supabaseAdmin.from('raffle_draws').select('id').eq('event_key', RAFFLE.key).eq('status', 'pending').limit(1);
  if (pend && pend.length) return { ok: true, entrants: 0, drawn: 0, state: 'awaiting-response' };

  // Eligible entrants: still in, under the attempt cap.
  const { data: entries } = await supabaseAdmin.from('raffle_entries').select('user_id, attempts').eq('event_key', RAFFLE.key).eq('status', 'entered');
  const eligibleIds = (entries ?? []).filter((e: any) => (e.attempts ?? 0) < RAFFLE.maxAttempts).map((e: any) => e.user_id);
  if (eligibleIds.length < 2) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'not-enough' };

  const { data: usersData } = await supabaseAdmin.from('users').select(COLS).in('id', eligibleIds);
  const pool: any[] = ((usersData as any[]) ?? []).filter((u) => u.photo_url && u.archetype && metroOf(u.zip) === RAFFLE.metro);

  // Never re-draw the same two people.
  const { data: priorDraws } = await supabaseAdmin.from('raffle_draws').select('user_a_id, user_b_id').eq('event_key', RAFFLE.key);
  const seenPairs = new Set<string>((priorDraws ?? []).map((d: any) => pairKey(d.user_a_id, d.user_b_id)));

  // Best mutually-eligible pair.
  let best: { a: any; b: any; score: number } | null = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (seenPairs.has(pairKey(a.id, b.id))) continue;
      if ((a.is_test === true) !== (b.is_test === true)) continue; // realm segregation
      if (!isGenderMatch(a, b) || !isGenderMatch(b, a)) continue;
      if (!ageMutual(a, b)) continue;
      const score = raffleScore(a, b);
      if (!best || score > best.score) best = { a, b, score };
    }
  }
  if (!best) return { ok: true, entrants: pool.length, drawn: 0, state: 'no-eligible-pair' };

  await supabaseAdmin.from('raffle_draws').upsert(
    { event_key: RAFFLE.key, user_a_id: best.a.id, user_b_id: best.b.id, compatibility_score: best.score, status: 'pending' },
    { onConflict: 'event_key,user_a_id,user_b_id' }
  );
  // Bump each one's attempt count.
  for (const id of [best.a.id, best.b.id]) {
    const cur = (entries ?? []).find((e: any) => e.user_id === id)?.attempts ?? 0;
    await supabaseAdmin.from('raffle_entries').update({ attempts: cur + 1, status: 'picked' }).eq('event_key', RAFFLE.key).eq('user_id', id);
  }
  const msg = { title: "You've been drawn! ✦", body: `${RAFFLE.series}: you got picked. Accept to lock in your $${RAFFLE.budget} date — ${RAFFLE.dateLabel}.`, url: '/hub', tag: 'raffle-drawn' };
  await Promise.allSettled([sendPushToUser(best.a.id, msg), sendPushToUser(best.b.id, msg)]);
  return { ok: true, entrants: pool.length, drawn: 1, pair: { a: best.a.name, b: best.b.name, score: best.score }, state: 'drawn' };
}
