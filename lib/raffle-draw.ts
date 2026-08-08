import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, pairSelectionWeight, ageMutual, raffleClosed, raffleEligible } from '@/lib/raffle';
import { isGenderMatch } from '@/lib/matching';
import { sendPushToUser } from '@/lib/push';

const COLS = 'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, hobbies, music, food, sports, ' +
  'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, ' +
  'vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, is_test';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

// The experiment selection is automatic: hard mutual eligibility first, then a
// lightly compatibility-weighted random choice among qualified pairs.
// If they don't both accept, the willing one is re-drawn — each entrant gets at
// most RAFFLE.maxAttempts (2) draws, then they're out. Prior-round winners are
// excluded. Stops once a pair mutually accepts (the winner) or no pairs remain.
export async function drawRaffle(opts: { force?: boolean } = {}): Promise<{ ok: true; entrants: number; drawn: number; pair?: { a: string; b: string; score: number }; state: string }> {
  const force = opts.force === true;
  if (!RAFFLE.entriesOpen && !force) return { ok: true, entrants: 0, drawn: 0, state: 'paused' };

  // Already a winner this round? done.
  const { data: won } = await supabaseAdmin.from('raffle_draws').select('id').eq('event_key', RAFFLE.key).eq('status', 'both_accepted').limit(1);
  if (won && won.length) return { ok: true, entrants: 0, drawn: 0, state: 'winner-locked' };

  // A pair is awaiting a yes/no — only one live pair at a time. Give them their
  // window; if it's gone STALE, expire it and move on so a no-show can't deadlock
  // the round. (A side that already accepted re-enters if under the attempt cap; a
  // no-show side is set aside.)
  const { data: pendRows } = await supabaseAdmin.from('raffle_draws')
    .select('id, created_at, a_accepted, b_accepted, user_a_id, user_b_id')
    .eq('event_key', RAFFLE.key).eq('status', 'pending').limit(1);
  const pendingDraw = (pendRows ?? [])[0] as any;
  if (pendingDraw) {
    const ageMs = Date.now() - new Date(pendingDraw.created_at).getTime();
    if (ageMs < RAFFLE.respondHours * 3_600_000) return { ok: true, entrants: 0, drawn: 0, state: 'awaiting-response' };
    await supabaseAdmin.from('raffle_draws').update({ status: 'expired' }).eq('id', pendingDraw.id);
    for (const [uid, accepted] of [[pendingDraw.user_a_id, pendingDraw.a_accepted], [pendingDraw.user_b_id, pendingDraw.b_accepted]] as [string, boolean][]) {
      let next: 'entered' | 'passed' = 'passed';
      if (accepted) {
        const { data: e } = await supabaseAdmin.from('raffle_entries').select('attempts').eq('event_key', RAFFLE.key).eq('user_id', uid).maybeSingle();
        next = ((e as any)?.attempts ?? 0) < RAFFLE.maxAttempts ? 'entered' : 'passed';
      }
      await supabaseAdmin.from('raffle_entries').update({ status: next }).eq('event_key', RAFFLE.key).eq('user_id', uid);
    }
  }

  // Prior draws this round — for seen-pairs AND the "round has started" trigger.
  const { data: priorDraws } = await supabaseAdmin.from('raffle_draws').select('user_a_id, user_b_id').eq('event_key', RAFFLE.key);
  const seenPairs = new Set<string>((priorDraws ?? []).map((d: any) => pairKey(d.user_a_id, d.user_b_id)));

  // Eligible entrants: still in, under the attempt cap.
  const { data: entries } = await supabaseAdmin.from('raffle_entries')
    .select('user_id, attempts, questionnaire, terms_version')
    .eq('event_key', RAFFLE.key)
    .eq('status', 'entered');
  const eligibleIds = (entries ?? [])
    .filter((e: any) => (e.attempts ?? 0) < RAFFLE.maxAttempts && e.terms_version === RAFFLE.termsVersion)
    .map((e: any) => e.user_id);

  // Only draw when it's time: admin force, entries closed, the cap is reached, or
  // the round already started (so post-decline / post-expiry re-draws flow through).
  const { count: totalEntries } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key).neq('status', 'withdrawn');
  const canDraw = force || (RAFFLE.entriesOpen && raffleClosed()) || (totalEntries ?? 0) >= RAFFLE.cap || (priorDraws?.length ?? 0) > 0;
  if (!canDraw) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'waiting-for-trigger' };
  if (eligibleIds.length < 2) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'not-enough' };

  const { data: usersData } = await supabaseAdmin.from('users').select(COLS).in('id', eligibleIds);
  const entryByUser = new Map((entries ?? []).map((entry: any) => [entry.user_id, entry]));
  const pool: any[] = ((usersData as any[]) ?? [])
    .filter((u) => u.is_test !== true && u.photo_url && u.archetype && raffleEligible(u))
    .map((u) => ({ ...u, experiment_answers: (entryByUser.get(u.id) as any)?.questionnaire ?? null }));

  // Fairness across rounds: a prior-round winner can't win again.
  const { data: priorWins } = await supabaseAdmin.from('raffle_draws').select('user_a_id, user_b_id').eq('status', 'both_accepted').neq('event_key', RAFFLE.key);
  const wonBefore = new Set<string>();
  (priorWins ?? []).forEach((d: any) => { wonBefore.add(d.user_a_id); wonBefore.add(d.user_b_id); });
  const eligiblePool = pool.filter((u) => !wonBefore.has(u.id));

  // Every mutually-eligible pair (not just the single best).
  const pairs: { a: any; b: any; score: number }[] = [];
  for (let i = 0; i < eligiblePool.length; i++) {
    for (let j = i + 1; j < eligiblePool.length; j++) {
      const a = eligiblePool[i], b = eligiblePool[j];
      if (seenPairs.has(pairKey(a.id, b.id))) continue;
      if ((a.is_test === true) !== (b.is_test === true)) continue; // realm segregation
      if (!isGenderMatch(a, b) || !isGenderMatch(b, a)) continue;
      if (!ageMutual(a, b)) continue;
      const score = raffleScore(a, b);
      if (score < RAFFLE.minimumPairScore) continue;
      pairs.push({ a, b, score });
    }
  }
  if (!pairs.length) return { ok: true, entrants: pool.length, drawn: 0, state: 'no-eligible-pair' };

  // Every qualified pair has a real chance. Compatibility changes odds only
  // within a bounded 1×–3× band; subscriptions and payments never affect it.
  const weightOf = (p: { a: any; b: any; score: number }) => pairSelectionWeight(p.score);
  const totalW = pairs.reduce((s, p) => s + weightOf(p), 0);
  let r = Math.random() * totalW;
  let best = pairs[0];
  for (const p of pairs) { r -= weightOf(p); if (r <= 0) { best = p; break; } }

  const selectedWeight = weightOf(best);
  const { error: drawError } = await supabaseAdmin.from('raffle_draws').upsert(
    {
      event_key: RAFFLE.key,
      user_a_id: best.a.id,
      user_b_id: best.b.id,
      compatibility_score: best.score,
      status: 'pending',
      algorithm_version: RAFFLE.algorithmVersion,
      eligible_pair_count: pairs.length,
      selection_weight: selectedWeight,
    },
    { onConflict: 'event_key,user_a_id,user_b_id' }
  );
  if (drawError) {
    if (drawError.code === '23505') return { ok: true, entrants: pool.length, drawn: 0, state: 'awaiting-response' };
    throw drawError;
  }
  // Bump each one's attempt count.
  for (const id of [best.a.id, best.b.id]) {
    const cur = (entries ?? []).find((e: any) => e.user_id === id)?.attempts ?? 0;
    await supabaseAdmin.from('raffle_entries').update({ attempts: cur + 1, status: 'picked' }).eq('event_key', RAFFLE.key).eq('user_id', id);
  }
  const msg = { title: "You've been selected! ✦", body: `${RAFFLE.series}: preview your match and decide whether to lock in the $${RAFFLE.budget} dinner — ${RAFFLE.dateLabel}.`, url: '/dating-experiment', tag: 'dating-experiment-selected' };
  await Promise.allSettled([sendPushToUser(best.a.id, msg), sendPushToUser(best.b.id, msg)]);
  return { ok: true, entrants: pool.length, drawn: 1, pair: { a: best.a.name, b: best.b.name, score: best.score }, state: 'drawn' };
}
