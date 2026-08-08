import { compatibilityScore } from '@/lib/matching';
import { zipDistanceMiles } from '@/lib/quiz-data';

export type ExperimentAnswers = {
  intention: 'relationship' | 'intentional' | 'open';
  energy: 'conversation' | 'playful' | 'foodie';
  conversationStarter: string;
};

// Publicly this is the NotCupid Dating Experiment. The legacy RAFFLE symbol and
// database table names stay internal so we can upgrade the existing machinery
// without a risky data migration.
export const RAFFLE = {
  key: 'boston-dating-experiment-v1',
  series: 'The NotCupid Dating Experiment',
  city: 'Boston',
  metro: 'boston',
  centerZip: '02116',
  radiusMiles: 20,
  entriesOpen: false, // quiet mode: keep the flow/rules live, but block new public entries
  statusLabel: 'TBD',
  cap: 100, // entry closes at 100 entrants → auto-draw fires
  maxAttempts: 2, // at most two sealed shortlist rounds per entrant
  shortlistMaxOptions: 2,
  respondHours: 12,
  termsVersion: 'boston-v2-2026-08-08',
  algorithmVersion: 'dating-experiment-mutual-shortlist-v2',
  minimumPairScore: 55,
  videoMinSeconds: 5,
  videoMaxSeconds: 15,
  videoMaxBytes: 25 * 1024 * 1024,
  entryClose: '2099-12-31T04:59:59.000Z',
  entryCloseLabel: 'TBD',
  happensAt: '2099-12-31T23:00:00.000Z',
  dateLabel: 'TBD',
  drawLabel: 'TBD',
  budget: 200,
  // The actual venue — revealed ONLY to a winning pair (set on the draw at mutual
  // accept; never in the public status payload). Kept secret until someone wins.
  restaurant: 'The Berkeley · 154 Berkeley Street, Back Bay, Boston — we’ll confirm the time with you.',
  tagline: 'One compatible Boston pair. Dinner is on us.',
};

export function raffleClosed(): boolean {
  return !RAFFLE.entriesOpen || Date.now() > new Date(RAFFLE.entryClose).getTime();
}

// Keep the first experiment in one jurisdiction and within a practical trip of
// the fixed Boston dinner. ZIP distance is approximate and exact location is
// never shown to another participant.
export function raffleEligible(user: any): boolean {
  const distance = zipDistanceMiles(user?.zip, RAFFLE.centerZip);
  return distance != null && distance <= RAFFLE.radiusMiles;
}

const overlap = (a?: string[] | null, b?: string[] | null) => {
  if (!a?.length || !b?.length) return 0;
  const A = new Set(a.map((s) => String(s).toLowerCase().trim()));
  return b.filter((s) => A.has(String(s).toLowerCase().trim())).length;
};

function answerCompatibility(a?: Partial<ExperimentAnswers>, b?: Partial<ExperimentAnswers>): number | null {
  if (!a?.intention || !b?.intention || !a?.energy || !b?.energy) return null;
  const intention = a.intention === b.intention || a.intention === 'open' || b.intention === 'open' ? 100 : 55;
  const energy = a.energy === b.energy ? 100 : 65;
  return intention * 0.65 + energy * 0.35;
}

// Compatibility drives who makes the eligible pair pool. Shared interests and
// the tiny experiment questionnaire add texture without overpowering the main
// values/attachment-based matching model.
export function raffleScore(a: any, b: any): number {
  const base = compatibilityScore(a, b); // 0–100
  const shared =
    overlap(a.hobbies, b.hobbies) +
    overlap(a.music, b.music) +
    overlap(a.food, b.food) +
    overlap(a.sports, b.sports);
  const sharedScore = Math.min(100, shared * 20);
  const answerScore = answerCompatibility(a.experiment_answers, b.experiment_answers);
  const score = answerScore == null
    ? base * 0.85 + sharedScore * 0.15
    : base * 0.75 + sharedScore * 0.15 + answerScore * 0.10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Stronger mutual pairs are more likely to receive the dinner, but the narrow
// 1×–3× band keeps the final selection meaningfully random.
export function pairSelectionWeight(score: number): number {
  const floor = RAFFLE.minimumPairScore;
  if (score <= floor) return 1;
  return Math.min(3, 1 + ((score - floor) / Math.max(1, 100 - floor)) * 2);
}

// Mutually within each other's age window.
export function ageMutual(a: any, b: any): boolean {
  const ok = (x: any, y: any) =>
    x.age == null || ((y.age_min == null || x.age >= y.age_min) && (y.age_max == null || x.age <= y.age_max));
  return ok(a, b) && ok(b, a);
}
