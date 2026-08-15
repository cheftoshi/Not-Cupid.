import { compatibilityScore } from '@/lib/matching';
import { zipDistanceMiles } from '@/lib/quiz-data';

export type ExperimentAnswers = {
  intention: 'relationship' | 'intentional' | 'open';
  energy: 'conversation' | 'playful' | 'foodie';
  planningStyle: 'planned' | 'spontaneous' | 'flexible';
  conversationStarter: string;
  availableSlotKeys?: string[];
  preferences?: {
    gender: 'm' | 'f' | 'nb';
    orientation: 'straight' | 'bisexual' | 'gay' | 'lesbian' | 'pansexual' | 'queer' | 'asexual' | 'questioning' | 'unlabeled';
    seekingGenders: ('m' | 'f' | 'nb')[];
    ageMin: number;
    ageMax: number;
  };
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
  statusLabel: 'Thursday, August 20',
  cap: 100, // entry closes at 100 entrants → auto-draw fires
  maxAttempts: 2, // at most two sealed shortlist rounds per entrant
  shortlistMaxOptions: 2,
  winnerPairCount: 2,
  respondHours: 12,
  termsVersion: 'boston-v10-2026-08-15',
  algorithmVersion: 'dating-experiment-two-pair-v4',
  minimumPairScore: 55,
  videoMinSeconds: 5,
  videoMaxSeconds: 15,
  videoMaxBytes: 25 * 1024 * 1024,
  entryClose: '2026-08-18T16:00:00.000Z',
  entryCloseLabel: 'Tuesday, August 18 at 12:00 PM ET',
  happensAt: '2026-08-21T00:30:00.000Z',
  dateLabel: 'Thursday, August 20, 2026 — 6:30 PM or 8:30 PM ET; restaurant revealed privately later',
  dateOptions: [
    { key: 'aug20-1830', label: 'Thursday, August 20 · 6:30 PM ET', eventDate: '2026-08-20', dateLabel: 'Thursday, August 20, 2026', timeLabel: '6:30 PM ET' },
    { key: 'aug20-2030', label: 'Thursday, August 20 · 8:30 PM ET', eventDate: '2026-08-20', dateLabel: 'Thursday, August 20, 2026', timeLabel: '8:30 PM ET' },
  ],
  drawLabel: 'Tuesday, August 18 after 12:00 PM ET',
  budget: 200,
  // The operator confirmed the $400 maximum prize funding and both prepaid
  // reservations on August 15. Sponsor details and counsel review remain gates.
  prizeFundingConfirmed: true,
  venueConfirmed: true,
  sponsorDetailsConfirmed: false,
  legalReviewApproved: false,
  // Times are public. The venue is revealed privately only after selection.
  restaurant: 'The Berkeley · 154 Berkeley Street, Boston, MA 02116',
  tagline: 'Two compatible Boston pairs. Dinner is on us.',
};

export function raffleLaunchBlockers(): string[] {
  const blockers: string[] = [];
  if (!RAFFLE.prizeFundingConfirmed) blockers.push(`confirm funding for up to $${RAFFLE.budget * RAFFLE.winnerPairCount} in dinner prizes`);
  if (!RAFFLE.venueConfirmed) blockers.push('confirm the restaurant and fulfillment plan');
  if (!RAFFLE.sponsorDetailsConfirmed) blockers.push('confirm the Sponsor legal identity and public mailing address');
  if (!RAFFLE.legalReviewApproved) blockers.push('complete Massachusetts counsel review of the Official Rules');
  if ([RAFFLE.entryCloseLabel, RAFFLE.drawLabel].some((label) => !label || label === 'TBD')) blockers.push('set the public entry and shortlist deadlines');
  if (new Date(RAFFLE.entryClose).getUTCFullYear() >= 2099 || new Date(RAFFLE.happensAt).getUTCFullYear() >= 2099) blockers.push('set the exact entry deadline and dinner time');
  return blockers;
}

export function raffleEntriesOpen(): boolean {
  return RAFFLE.entriesOpen && raffleLaunchBlockers().length === 0;
}

export function raffleClosed(): boolean {
  return !raffleEntriesOpen() || Date.now() > new Date(RAFFLE.entryClose).getTime();
}

// Keep the first experiment in one jurisdiction and within a practical trip of
// the fixed Boston dinner. ZIP distance is approximate and exact location is
// never shown to another participant.
export function raffleEligible(
  user: any,
  location: { centerZip: string; radiusMiles: number } = RAFFLE,
): boolean {
  const distance = zipDistanceMiles(user?.zip, location.centerZip);
  return distance != null && distance <= location.radiusMiles;
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
  const planning = !a.planningStyle || !b.planningStyle
    ? 75
    : a.planningStyle === b.planningStyle || a.planningStyle === 'flexible' || b.planningStyle === 'flexible'
      ? 100
      : 55;
  return intention * 0.50 + energy * 0.30 + planning * 0.20;
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
export function pairSelectionWeight(score: number, floor = RAFFLE.minimumPairScore): number {
  if (score <= floor) return 1;
  return Math.min(3, 1 + ((score - floor) / Math.max(1, 100 - floor)) * 2);
}
