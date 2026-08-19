import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { compatibilityBreakdown } from '../lib/matching.ts';
import { experimentReciprocalScore } from '../lib/experiment-reciprocal-scoring.ts';
import { zipDistanceMiles } from '../lib/quiz-data.ts';

function loadLocalEnv() {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function prompts(value) {
  return list(value).filter((prompt) => typeof prompt?.answer === 'string' && prompt.answer.trim()).length;
}

function profileEvidence(profile, entry) {
  const interestCount = [profile.music, profile.food, profile.hobbies, profile.sports].flatMap(list).length;
  const bioLength = String(profile.bio || '').trim().length;
  const galleryCount = list(profile.gallery).length;
  const promptCount = prompts(profile.prompts);
  const present = [
    bioLength >= 40,
    interestCount >= 3,
    promptCount >= 1,
    galleryCount >= 2,
    !!profile.occupation,
    !!profile.education,
    !!profile.relationship_style,
    !!profile.intro_video_url || !!entry?.video_url,
  ];
  return {
    score: present.filter(Boolean).length / present.length * 100,
    bioLength,
    interestCount,
    promptCount,
    galleryCount,
    hasOccupation: Number(!!profile.occupation),
    hasEducation: Number(!!profile.education),
    hasVideo: Number(!!profile.intro_video_url || !!entry?.video_url),
  };
}

function experimentAlignment(a, b) {
  const aa = a?.questionnaire || {};
  const bb = b?.questionnaire || {};
  const values = [
    aa.intention && bb.intention ? Number(aa.intention === bb.intention || aa.intention === 'open' || bb.intention === 'open') : null,
    aa.energy && bb.energy ? Number(aa.energy === bb.energy) : null,
    aa.planningStyle && bb.planningStyle ? Number(aa.planningStyle === bb.planningStyle || aa.planningStyle === 'flexible' || bb.planningStyle === 'flexible') : null,
  ].filter((value) => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length * 100 : 50;
}

function interestOverlap(a, b) {
  const aa = new Set([a.music, a.food, a.hobbies, a.sports].flatMap(list).map((v) => String(v).trim().toLowerCase()));
  const bb = new Set([b.music, b.food, b.hobbies, b.sports].flatMap(list).map((v) => String(v).trim().toLowerCase()));
  let shared = 0;
  for (const value of aa) if (bb.has(value)) shared += 1;
  return shared;
}

function preferenceComfort(viewer, target, entry) {
  const saved = entry?.questionnaire?.preferences || {};
  const min = Number.isInteger(saved.ageMin) ? saved.ageMin : viewer.age_min;
  const max = Number.isInteger(saved.ageMax) ? saved.ageMax : viewer.age_max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target.age) || max <= min) return 50;
  const center = (min + max) / 2;
  const half = Math.max(1, (max - min) / 2);
  return Math.max(0, 100 - Math.abs(target.age - center) / half * 50);
}

function summarize(rows, key) {
  const yes = rows.filter((row) => row.label === 1).map((row) => row[key]);
  const no = rows.filter((row) => row.label === 0).map((row) => row[key]);
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  let wins = 0, ties = 0, comparisons = 0;
  for (const positive of yes) for (const negative of no) {
    comparisons += 1;
    if (positive > negative) wins += 1;
    if (positive === negative) ties += 1;
  }
  return {
    yes: Number(average(yes).toFixed(1)),
    pass: Number(average(no).toFixed(1)),
    delta: Number((average(yes) - average(no)).toFixed(1)),
    auc: comparisons ? Number(((wins + ties * 0.5) / comparisons).toFixed(3)) : null,
  };
}

function topChoice(rows, key) {
  const byViewer = new Map();
  for (const row of rows) {
    const current = byViewer.get(row.viewerId) || [];
    current.push(row);
    byViewer.set(row.viewerId, current);
  }
  let eligible = 0, correct = 0, ties = 0;
  for (const choices of byViewer.values()) {
    if (choices.length < 2 || choices.filter((row) => row.label === 1).length !== 1) continue;
    eligible += 1;
    const positive = choices.find((row) => row.label === 1);
    const best = Math.max(...choices.map((row) => row[key]));
    if (positive[key] === best) {
      const tied = choices.filter((row) => row[key] === best).length > 1;
      if (tied) ties += 1;
      else correct += 1;
    }
  }
  return { eligible, correct, ties, accuracy: eligible ? Number(((correct + ties * 0.5) / eligible).toFixed(3)) : null };
}

loadLocalEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const eventKey = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || 'boston-dating-experiment-v1';
const [{ data: rounds, error: roundsError }, { data: entries, error: entriesError }] = await Promise.all([
  supabase.from('dating_experiment_rounds').select('id,round_number,response_deadline,status').eq('event_key', eventKey),
  supabase.from('raffle_entries').select('user_id,questionnaire,video_url').eq('event_key', eventKey),
]);
if (roundsError) throw roundsError;
if (entriesError) throw entriesError;
const roundById = new Map(rounds.map((round) => [round.id, round.round_number]));
const entryByUser = new Map(entries.map((entry) => [entry.user_id, entry]));
const { data: pairs, error: pairsError } = await supabase.from('dating_experiment_shortlist_pairs')
  .select('round_id,user_a_id,user_b_id,compatibility_score,a_accepted,b_accepted')
  .eq('event_key', eventKey);
if (pairsError) throw pairsError;
const userIds = [...new Set(pairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id]))];
const columns = 'id,age,age_min,age_max,zip,bio,gallery,prompts,occupation,education,relationship_style,intro_video_url,music,food,hobbies,sports,score_honesty,score_emotionality,score_extraversion,score_agreeableness,score_conscientiousness,score_openness,vibes,values_profile,attach_anxiety,attach_avoidance,attach_style';
const { data: users, error: usersError } = await supabase.from('users').select(columns).in('id', userIds);
if (usersError) throw usersError;
const userById = new Map(users.map((user) => [user.id, user]));
const decisions = [];
for (const pair of pairs) {
  const a = userById.get(pair.user_a_id), b = userById.get(pair.user_b_id);
  if (!a || !b) continue;
  const core = compatibilityBreakdown(a, b);
  const shared = interestOverlap(a, b);
  const alignment = experimentAlignment(entryByUser.get(a.id), entryByUser.get(b.id));
  const distance = zipDistanceMiles(a.zip, b.zip);
  const common = {
    round: roundById.get(pair.round_id),
    oldScore: pair.compatibility_score,
    core: core.score,
    values: core.signalScores.values ?? 50,
    attachment: core.signalScores.attachment ?? 50,
    traits: core.signalScores.traits ?? 50,
    vibes: core.signalScores.vibes ?? 50,
    interestsSignal: core.signalScores.interests ?? 50,
    relationship: core.signalScores.relationshipPreferences ?? 50,
    experiment: alignment,
    shared,
    distanceCloseness: distance == null ? 50 : Math.max(0, 100 - distance * 4),
    ageGapCloseness: Math.max(0, 100 - Math.abs(a.age - b.age) * 7),
  };
  common.foundationV5 = experimentReciprocalScore(
    { ...a, experiment_answers: entryByUser.get(a.id)?.questionnaire || null },
    { ...b, experiment_answers: entryByUser.get(b.id)?.questionnaire || null },
  ).score;
  if (pair.a_accepted != null) decisions.push({
    ...common,
    viewerId: a.id,
    label: Number(pair.a_accepted),
    targetEvidence: profileEvidence(b, entryByUser.get(b.id)).score,
    ageComfort: preferenceComfort(a, b, entryByUser.get(a.id)),
  });
  if (pair.b_accepted != null) decisions.push({
    ...common,
    viewerId: b.id,
    label: Number(pair.b_accepted),
    targetEvidence: profileEvidence(a, entryByUser.get(a.id)).score,
    ageComfort: preferenceComfort(b, a, entryByUser.get(b.id)),
  });
}

const keys = ['oldScore','core','foundationV5','values','attachment','traits','vibes','interestsSignal','relationship','experiment','shared','distanceCloseness','ageGapCloseness','targetEvidence','ageComfort'];
const byRound = Object.fromEntries([...new Set(decisions.map((row) => row.round))].sort().map((round) => {
  const rows = decisions.filter((row) => row.round === round);
  return [round, {
    decisions: rows.length,
    yes: rows.filter((row) => row.label === 1).length,
    pass: rows.filter((row) => row.label === 0).length,
    signals: Object.fromEntries(keys.map((key) => [key, summarize(rows, key)])),
    topChoice: Object.fromEntries(['oldScore', 'core', 'foundationV5'].map((key) => [key, topChoice(rows, key)])),
  }];
}));
const all = {
  decisions: decisions.length,
  yes: decisions.filter((row) => row.label === 1).length,
  pass: decisions.filter((row) => row.label === 0).length,
  signals: Object.fromEntries(keys.map((key) => [key, summarize(decisions, key)])),
  topChoice: Object.fromEntries(['oldScore', 'core', 'foundationV5'].map((key) => [key, topChoice(decisions, key)])),
};
const roundSummary = rounds.map(({ id: _id, ...round }) => round).sort((a, b) => a.round_number - b.round_number);
if (process.argv.includes('--rounds-only')) {
  console.log(JSON.stringify({ eventKey, rounds: roundSummary }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({
  eventKey,
  rounds: roundSummary,
  all,
  byRound,
}, null, 2));
