import { compatibilityScore } from '@/lib/matching';

// Summer of Connection — the live event raffle. v1 = Boston, one date.
// The draw is AUTOMATIC: it fires the moment entries hit `cap`, or via the daily
// cron once `entryClose` passes — no human picks. (Confirm the dates below.)
export const RAFFLE = {
  key: 'boston-2026-07-02',
  series: 'Summer of Connection',
  city: 'Boston',
  metro: 'boston',
  entriesOpen: false, // quiet mode: keep the flow/rules live, but block new public entries
  statusLabel: 'TBD',
  cap: 100, // entry closes at 100 entrants → auto-draw fires
  maxAttempts: 2, // each entrant can be drawn at most twice (accept/reject, then re-draw)
  proEntries: 2, // NotCupid Pro members get this many entries (dual entry = 2× draw weight). NO PURCHASE NECESSARY: the same bonus is free on request (AMOE) so it stays a sweepstakes, not a paid lottery.
  respondHours: 18, // a drawn pair has this long to accept before the draw expires + we re-draw (so a no-show can't deadlock the round)
  entryClose: '2099-12-31T04:59:59.000Z',
  entryCloseLabel: 'TBD',
  happensAt: '2099-12-31T23:00:00.000Z',
  dateLabel: 'TBD',
  drawLabel: 'TBD',
  budget: 200,
  // The actual venue — revealed ONLY to a winning pair (set on the draw at mutual
  // accept; never in the public status payload). Kept secret until someone wins.
  restaurant: 'The Berkeley · 154 Berkeley Street, Back Bay, Boston — we’ll confirm the time with you.',
  tagline: 'Two Bostonians. One $200 dinner. On us.',
};

export function raffleClosed(): boolean {
  return !RAFFLE.entriesOpen || Date.now() > new Date(RAFFLE.entryClose).getTime();
}

// Is this user eligible for the raffle? CITY-BASED: they must live in an actual
// named Boston neighborhood or inner-ring town (Back Bay, Cambridge, Somerville,
// Brookline, Quincy, …) — a real Bostonian, so a winner can show up to dinner.
// (Sharper + more on-brand than a vague mileage radius.)
import { isBostonAreaZip } from '@/lib/neighborhoods';
export function raffleEligible(user: any): boolean {
  return isBostonAreaZip(user?.zip);
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
