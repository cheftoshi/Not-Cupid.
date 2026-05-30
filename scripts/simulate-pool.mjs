// Pool / matching simulation — mirrors lib/matching.ts scoring exactly.
// Generates synthetic STRAIGHT daters at a given M/F ratio, runs the real
// greedy matcher, and reports who matches, match quality, and the ceiling.
//
// Run: node scripts/simulate-pool.mjs
//
// The point: for straight matching, the gender ratio is a HARD CEILING on
// total matches (each woman can pair one man). The algorithm controls WHO
// matches and match QUALITY — never the COUNT. This quantifies that.

// ── Scoring (copied verbatim from lib/matching.ts) ──────────────────────
const W = { honesty: 2.0, agreeableness: 2.5, conscientiousness: 2.0, emotionality: 1.0, openness: 1.0, extraversion: 0.5 };
const DIM_MAX_DIFF = 16;
const MAX_WEIGHTED_DIFF = DIM_MAX_DIFF * (W.honesty + W.agreeableness + W.conscientiousness + W.emotionality + W.openness + W.extraversion);
const HEXACO_WEIGHT = 0.8, VIBES_WEIGHT = 0.2;
const VIBE_KEYS = ['chronotype', 'date_freq', 'future', 'comm', 'social', 'risk'];
const VIBE_MAX_DIFF_PER_KEY = 3;

function hexacoSub(a, b) {
  const d = (k) => Math.abs(a[k] - b[k]);
  const weighted = d('honesty') * W.honesty + d('agreeableness') * W.agreeableness + d('conscientiousness') * W.conscientiousness
    + d('emotionality') * W.emotionality + d('openness') * W.openness + d('extraversion') * W.extraversion;
  return 100 - (weighted / MAX_WEIGHTED_DIFF) * 100;
}
function vibesSub(a, b) {
  let total = 0, max = 0;
  for (const k of VIBE_KEYS) { total += Math.abs(a.vibes[k] - b.vibes[k]); max += VIBE_MAX_DIFF_PER_KEY; }
  return 100 - (total / max) * 100;
}
function compatibilityScore(a, b) {
  const hex = hexacoSub(a, b), vib = vibesSub(a, b);
  return Math.round(hex * HEXACO_WEIGHT + vib * VIBES_WEIGHT);
}
function thresholdFor(user, pool, base = 50, strict = 65, overrep = 0.55, minPool = 10) {
  let t = base;
  const binary = pool.filter((p) => p.gender === 'm' || p.gender === 'f');
  if (binary.length >= minPool) {
    const same = binary.filter((p) => p.gender === user.gender).length;
    if (same / binary.length >= overrep) t = strict;
  }
  return t;
}

// ── Synthetic population ────────────────────────────────────────────────
let seed = 42;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function randDim() { return Math.round(rnd() * 16); }
function randVibe() { return 1 + Math.floor(rnd() * 4); }
function makeUser(id, gender) {
  return {
    id, gender, seeking: gender === 'm' ? 'f' : 'm',
    honesty: randDim(), agreeableness: randDim(), conscientiousness: randDim(),
    emotionality: randDim(), openness: randDim(), extraversion: randDim(),
    vibes: Object.fromEntries(VIBE_KEYS.map((k) => [k, randVibe()])),
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
    const cands = pool.filter((p) => !p.matched && p.id !== u.id && p.gender === u.seeking && p.seeking === u.gender);
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
