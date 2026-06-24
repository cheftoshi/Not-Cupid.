import { compatibilityScore } from '@/lib/matching';

// Summer of Connection — the live event raffle. v1 = Boston, one date.
// The draw is AUTOMATIC: it fires the moment entries hit `cap`, or via the daily
// cron once `entryClose` passes — no human picks. (Confirm the dates below.)
export const RAFFLE = {
  key: 'boston-2026-07-02',
  series: 'Summer of Connection',
  city: 'Boston',
  metro: 'boston',
  cap: 50, // entry closes at 50 entrants → auto-draw fires
  entryClose: '2026-06-30T03:59:59.000Z', // last entry point: Mon Jun 29, 11:59pm ET (EDT = UTC-4)
  entryCloseLabel: 'Monday, June 29',
  happensAt: '2026-07-02T23:00:00.000Z', // Thu Jul 2, 7pm ET
  dateLabel: 'Thursday, July 2 · 7pm',
  drawLabel: 'the moment we hit 50 (or Monday June 29)',
  budget: 200,
  restaurant: "a spot we love in Boston — we'll email you the address + time",
  tagline: 'Two Bostonians. One $200 dinner. On us.',
};

export function raffleClosed(): boolean {
  return Date.now() > new Date(RAFFLE.entryClose).getTime();
}

// Is this user eligible for the raffle? (in the event's metro)
import { metroOf } from '@/lib/quiz-data';
export function raffleEligible(user: any): boolean {
  return metroOf(user?.zip) === RAFFLE.metro;
}

const overlap = (a?: string[] | null, b?: string[] | null) => {
  if (!a?.length || !b?.length) return 0;
  const A = new Set(a.map((s) => String(s).toLowerCase().trim()));
  return b.filter((s) => A.has(String(s).toLowerCase().trim())).length;
};

// Raffle pairing score — the normal compatibility score, then a heavy bonus for
// SHARED INTERESTS (hobbies / music / food / sports), so the draw clearly favors
// people who'd actually have things to do + talk about over dinner.
export function raffleScore(a: any, b: any): number {
  const base = compatibilityScore(a, b); // 0–100
  const shared =
    overlap(a.hobbies, b.hobbies) +
    overlap(a.music, b.music) +
    overlap(a.food, b.food) +
    overlap(a.sports, b.sports);
  return Math.round(base) + Math.min(40, shared * 6); // up to +40 for overlap
}

// Mutually within each other's age window.
export function ageMutual(a: any, b: any): boolean {
  const ok = (x: any, y: any) =>
    x.age == null || ((y.age_min == null || x.age >= y.age_min) && (y.age_max == null || x.age <= y.age_max));
  return ok(a, b) && ok(b, a);
}
