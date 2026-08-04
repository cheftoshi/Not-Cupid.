// Pool / matching simulation — imports the production scorer so it cannot
// silently drift from lib/matching.ts again.
// Generates synthetic STRAIGHT daters at a given M/F ratio, runs the real
// greedy matcher, and reports who matches, match quality, and the ceiling.
//
// Run: node scripts/simulate-pool.mjs
//
// The point: for straight matching, the gender ratio is a HARD CEILING on
// total matches (each woman can pair one man). The algorithm controls WHO
// matches and match QUALITY — never the COUNT. This quantifies that.

import { compatibilityScore, hasHardDealbreakerConflict, thresholdFor } from '../lib/matching.ts';

const VIBE_KEYS = ['chronotype', 'date_freq', 'future', 'comm', 'social', 'risk'];
const INTERESTS = ['food', 'music', 'sports', 'comedy', 'art', 'outdoor', 'coffee', 'books'];
const KIDS = ['yes', 'no', 'maybe'];
const SUBSTANCES = ['none', 'rare', 'social', 'regular'];

// ── Synthetic population ────────────────────────────────────────────────
let seed = 42;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function randDim() { return Math.round(rnd() * 8); }
function randVibe() { return 1 + Math.floor(rnd() * 4); }
function pick(values) { return values[Math.floor(rnd() * values.length)]; }
function pickSome(values, count = 2) {
  return [...values].sort(() => rnd() - 0.5).slice(0, count);
}
function makeUser(id, gender) {
  return {
    id, gender, seeking: gender === 'm' ? 'f' : 'm',
    score_honesty: randDim(), score_agreeableness: randDim(), score_conscientiousness: randDim(),
    score_emotionality: randDim(), score_openness: randDim(), score_extraversion: randDim(),
    attach_anxiety: Math.round(rnd() * 100), attach_avoidance: Math.round(rnd() * 100),
    vibes: { ...Object.fromEntries(VIBE_KEYS.map((k) => [k, randVibe()])), rapid: { a: randVibe(), b: randVibe(), c: randVibe() } },
    values_profile: {
      kids: pick(KIDS), faith: Math.floor(rnd() * 4), politics: Math.floor(rnd() * 4),
      ambition: Math.floor(rnd() * 4), lifestyle: Math.floor(rnd() * 4), fitness: Math.floor(rnd() * 4),
      substances: pick(SUBSTANCES),
      partner: { pace: pick(['slow', 'steady', 'fast']), energy: pick(['home', 'balanced', 'social']), draws: pickSome(INTERESTS), priority: pickSome(INTERESTS) },
    },
    music: pickSome(INTERESTS), food: pickSome(INTERESTS), hobbies: pickSome(INTERESTS), sports: pickSome(INTERESTS, 1),
    matched: false,
  };
}
function buildPool(total, fracMale) {
  const men = Math.round(total * fracMale);
  const women = total - men;
  const users = [];
  for (let i = 0; i < men; i++) users.push(makeUser(`m${i}`, 'm'));
  for (let i = 0; i < women; i++) users.push(makeUser(`f${i}`, 'f'));
  return users;
}

// ── Greedy matcher (mirrors the app: scarce gender prioritized, best
//    opposite-gender candidate above threshold) ─────────────────────────
function runMatching(users, { useThreshold = true } = {}) {
  const pool = users.map((u) => ({ ...u, matched: false }));
  const matches = [];
  // Priority: under-represented gender first (same as the cron).
  const mCount = pool.filter((p) => p.gender === 'm').length;
  const fCount = pool.filter((p) => p.gender === 'f').length;
  const priority = fCount <= mCount ? 'f' : 'm';
  const order = [...pool].sort((a, b) => (a.gender === priority ? 0 : 1) - (b.gender === priority ? 0 : 1));

  for (const u of order) {
    if (u.matched) continue;
    const cands = pool.filter((p) => !p.matched && p.id !== u.id && p.gender === u.seeking && p.seeking === u.gender && !hasHardDealbreakerConflict(u, p));
    if (!cands.length) continue;
    const scored = cands.map((p) => ({ p, s: compatibilityScore(u, p) })).sort((a, b) => b.s - a.s);
    const min = useThreshold ? thresholdFor(u, pool) : 0;
    const best = scored.find((x) => x.s >= min);
    if (best) { u.matched = true; best.p.matched = true; matches.push({ a: u.id, b: best.p.id, s: best.s }); }
  }
  return { pool, matches };
}

function report(label, total, fracMale, opts) {
  const users = buildPool(total, fracMale);
  const M = users.filter((u) => u.gender === 'm').length;
  const F = users.filter((u) => u.gender === 'f').length;
  const { pool, matches } = runMatching(users, opts);
  const matchedM = pool.filter((p) => p.gender === 'm' && p.matched).length;
  const matchedF = pool.filter((p) => p.gender === 'f' && p.matched).length;
  const avgScore = matches.length ? (matches.reduce((s, m) => s + m.s, 0) / matches.length).toFixed(1) : '—';
  const ceiling = Math.min(M, F);
  console.log(`\n${label}`);
  console.log(`  pool: ${M}M / ${F}F  (${Math.round(fracMale * 100)}% male)`);
  console.log(`  matches made: ${matches.length}  (theoretical ceiling: ${ceiling})`);
  console.log(`  men matched:   ${matchedM}/${M}  (${Math.round(matchedM / M * 100)}%)  → ${M - matchedM} men left unmatched`);
  console.log(`  women matched: ${matchedF}/${F}  (${Math.round(matchedF / F * 100)}%)`);
  console.log(`  avg match quality: ${avgScore}%`);
}

console.log('='.repeat(64));
console.log('NOTCUPID POOL SIMULATION — straight matching, 200 daters');
console.log('='.repeat(64));

for (const frac of [0.5, 0.6, 0.7, 0.8]) {
  report(`Gender ratio ${Math.round(frac * 100)}/${Math.round((1 - frac) * 100)} (M/F)`, 200, frac, { useThreshold: true });
}

console.log('\n' + '='.repeat(64));
console.log('Does dropping the threshold help the unmatched men? (70/30 pool)');
console.log('='.repeat(64));
report('WITH threshold (current algo)', 200, 0.7, { useThreshold: true });
report('NO threshold (match anyone)', 200, 0.7, { useThreshold: false });

console.log('\n' + '='.repeat(64));
console.log('What actually moves the needle: adding women to a 70M pool');
console.log('='.repeat(64));
for (const [m, f] of [[70, 30], [70, 45], [70, 60], [70, 70]]) {
  const users = [...Array(m)].map((_, i) => makeUser(`m${i}`, 'm')).concat([...Array(f)].map((_, i) => makeUser(`f${i}`, 'f')));
  const { pool, matches } = runMatching(users, { useThreshold: true });
  const matchedM = pool.filter((p) => p.gender === 'm' && p.matched).length;
  console.log(`  70M + ${f}F → ${matches.length} matches, ${matchedM}/${m} men matched (${Math.round(matchedM / m * 100)}%), ${m - matchedM} men waiting`);
}
console.log('');

// ── Equity rotation validation ──────────────────────────────────────────
// Over repeated match cycles in a skewed pool, does equity weighting give
// MORE distinct men a shot than always picking the top score?
function equityBonusSim(lastRound, cur) {
  if (lastRound == null) return 8;
  const gap = cur - lastRound;
  if (gap >= 3) return 8; if (gap >= 1) return 4; return 0;
}
function multiRound(fracMale, rounds, useEquity) {
  const users = buildPool(200, fracMale);
  users.forEach((u) => (u.lastRound = null));
  const everMatchedMen = new Set();
  for (let r = 0; r < rounds; r++) {
    users.forEach((u) => (u.matched = false));
    const mC = users.filter((u) => u.gender === 'm').length, fC = users.filter((u) => u.gender === 'f').length;
    const pri = fC <= mC ? 'f' : 'm';
    const order = [...users].sort((a, b) => (a.gender === pri ? 0 : 1) - (b.gender === pri ? 0 : 1));
    for (const u of order) {
      if (u.matched) continue;
      const cands = users.filter((p) => !p.matched && p.id !== u.id && p.gender === u.seeking && !hasHardDealbreakerConflict(u, p));
      if (!cands.length) continue;
      const min = thresholdFor(u, users);
      const clearing = cands.map((p) => ({ p, raw: compatibilityScore(u, p) })).filter((x) => x.raw >= min);
      if (!clearing.length) continue;
      clearing.sort((a, b) => (b.raw + (useEquity ? equityBonusSim(b.p.lastRound, r) : 0)) - (a.raw + (useEquity ? equityBonusSim(a.p.lastRound, r) : 0)));
      const best = clearing[0];
      u.matched = true; best.p.matched = true; u.lastRound = r; best.p.lastRound = r;
      if (u.gender === 'm') everMatchedMen.add(u.id);
      if (best.p.gender === 'm') everMatchedMen.add(best.p.id);
    }
  }
  return everMatchedMen.size;
}
console.log('='.repeat(64));
console.log('Equity rotation: distinct men who got >=1 match over 6 cycles (70/30)');
console.log('='.repeat(64));
console.log(`  top-score only:   ${multiRound(0.7, 6, false)} distinct men (of 140) ever matched`);
console.log(`  equity-weighted:  ${multiRound(0.7, 6, true)} distinct men (of 140) ever matched`);
console.log('');
