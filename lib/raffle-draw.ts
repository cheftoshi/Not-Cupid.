import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, ageMutual } from '@/lib/raffle';
import { isGenderMatch } from '@/lib/matching';
import { metroOf } from '@/lib/quiz-data';
import { sendPushToUser } from '@/lib/push';

const COLS = 'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, hobbies, music, food, sports, ' +
  'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, ' +
  'vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, is_test';

// The raffle draw — AUTO, no human picks: pair eligible entrants by the
// hobbies-weighted raffleScore (greedy, non-overlapping), create pending draws,
// push both sides. Shared by the cap-trigger (enter), the deadline cron, and the
// admin override button. Idempotent: never re-draws anyone already in a live draw.
export async function drawRaffle(): Promise<{ ok: true; entrants: number; drawn: number; pairs: { a: string; b: string; score: number }[] }> {
  const { data: entries } = await supabaseAdmin.from('raffle_entries').select('user_id').eq('event_key', RAFFLE.key).eq('status', 'entered');
  const ids = (entries ?? []).map((e: any) => e.user_id);
  if (ids.length < 2) return { ok: true, entrants: ids.length, drawn: 0, pairs: [] };

  const { data: usersData } = await supabaseAdmin.from('users').select(COLS).in('id', ids);
  const users: any[] = (usersData as any[]) ?? [];
  const pool: any[] = users.filter((u) => u.photo_url && u.archetype && metroOf(u.zip) === RAFFLE.metro);

  const { data: existing } = await supabaseAdmin.from('raffle_draws').select('user_a_id, user_b_id').eq('event_key', RAFFLE.key).in('status', ['pending', 'both_accepted']);
  const taken = new Set<string>();
  (existing ?? []).forEach((d: any) => { taken.add(d.user_a_id); taken.add(d.user_b_id); });
  const avail = pool.filter((u) => !taken.has(u.id));

  const pairs: { a: any; b: any; score: number }[] = [];
  for (let i = 0; i < avail.length; i++) {
    for (let j = i + 1; j < avail.length; j++) {
      const a = avail[i], b = avail[j];
      if ((a.is_test === true) !== (b.is_test === true)) continue;
      if (!isGenderMatch(a, b) || !isGenderMatch(b, a)) continue;
      if (!ageMutual(a, b)) continue;
      pairs.push({ a, b, score: raffleScore(a, b) });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const used = new Set<string>();
  const drawn: { a: string; b: string; score: number }[] = [];
  for (const p of pairs) {
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id); used.add(p.b.id);
    await supabaseAdmin.from('raffle_draws').upsert(
      { event_key: RAFFLE.key, user_a_id: p.a.id, user_b_id: p.b.id, compatibility_score: p.score, status: 'pending' },
      { onConflict: 'event_key,user_a_id,user_b_id' }
    );
    await supabaseAdmin.from('raffle_entries').update({ status: 'picked' }).eq('event_key', RAFFLE.key).in('user_id', [p.a.id, p.b.id]);
    const msg = { title: "You've been drawn! ✦", body: `${RAFFLE.series}: you got picked. Accept to lock in your $${RAFFLE.budget} date — ${RAFFLE.dateLabel}.`, url: '/hub', tag: 'raffle-drawn' };
    await Promise.allSettled([sendPushToUser(p.a.id, msg), sendPushToUser(p.b.id, msg)]);
    drawn.push({ a: p.a.name, b: p.b.name, score: p.score });
  }
  return { ok: true, entrants: pool.length, drawn: drawn.length, pairs: drawn };
}
