// User-facing "what's new" changelog. Add a new entry at the TOP and bump
// CHANGELOG_VERSION — that drives the "new" dot for returning users.

export interface ChangelogEntry {
  date: string;
  items: string[];
}

// Bump this string whenever you add an entry. The dashboard compares it to
// the version the user last saw (localStorage) to show a "new" indicator.
export const CHANGELOG_VERSION = '2026-05-29';

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'May 2026',
    items: [
      '✦ Date Vibes — a private game with your match: pick what you\'re into, swipe activities, and the ones you both want pin to the top. The deck warms up as you go.',
      '📸 Profile gallery — add up to 3 more photos (part of the $1.99 profile unlock).',
      '📍 Smarter local matching — a tighter 15-mile default, with one-tap "widen my search" when your area is quiet.',
      '⚡ Faster matches — the algorithm now re-runs every 20 minutes instead of once a day.',
      '🎨 A fresh look — new blue & orange brand across the whole app.',
      '💬 Real-time chat that stays open as long as you\'re both talking.',
    ],
  },
];
