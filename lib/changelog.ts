// User-facing "what's new" changelog. Add a new entry at the TOP and bump
// CHANGELOG_VERSION — that drives the "new" dot for returning users.

export interface ChangelogEntry {
  date: string;
  items: string[];
}

// Bump this string whenever you add an entry. The dashboard compares it to
// the version the user last saw (localStorage) to show a "new" indicator.
export const CHANGELOG_VERSION = '2026-08-18-love-connection-picks';

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'August 2026',
    items: [
      '🍽️ The Boston Dating Experiment is live — opt in free, meet up to 2 private compatibility options, and mutually choose who you would actually meet. Up to 2 mutual pairs get dinner on us.',
      '🎥 Video is optional — add a private 5–15 second hello if you want to show more personality. Skipping it never affects eligibility or compatibility.',
      '💘 More people, still curated — every Love roster now shows up to 7 compatible options and includes 3 distinct connection picks.',
      '🪪 Love profiles are open — tap any roster card to read the bio, prompts and interests before choosing. Accepting and replying are always free.',
      '✈ Going somewhere? Add an upcoming trip and Friend Line will route local people, plans, clubs, and communities before you arrive.',
      '📱 Friend Line is smoother on phones — thumb-sized controls, compact navigation, safer modal scrolling, and better support for notched screens.',
      '✦ Extra Love connections — after the 3 included picks in a roster, choosing one more person is a one-time $0.99. If mutual, chat and the full compatibility profile are included.',
      '↩️ Paid-pick protection — if an extra Love connection is declined or expires before becoming mutual, the purchase automatically comes back as an in-app credit.',
      '🎒 Pro stays $3.99/mo and now includes extra Love connection picks plus additional Friend packs.',
    ],
  },
  {
    date: 'June 2026',
    items: [
      '🎒 Friendship packs — your Friend Line matches now come in packs you OPEN, cinematically. First pack (up to 5 friends) is free; more are $0.99 each.',
      '✦ NotCupid Pro — one $3.99/mo subscription covers every compatibility deep-dive and unlimited friendship packs.',
      '💸 Optional Love compatibility deep-dives are $0.99 after a mutual connection.',
      '🔔 More notifications — get pinged when a match is expiring or a new friend match lands.',
      '🌍 Change your city — set your home base from any city we’re live in (all of New England + NYC) right from the hub.',
      '✨ Sun signs — add yours on your profile for a little cosmic flavor (just for fun — never part of how we match you).',
    ],
  },
  {
    date: 'May 2026',
    items: [
      '✦ Date Vibes — a private game with your match: pick what you\'re into, swipe activities, and the ones you both want pin to the top. The deck warms up as you go.',
      '📸 Profile gallery — add up to 3 more photos for the optional post-connection deep-dive.',
      '📍 Smarter local matching — a tighter 15-mile default, with one-tap "widen my search" when your area is quiet.',
      '⚡ Faster matches — the algorithm now re-runs every 20 minutes instead of once a day.',
      '🎨 A fresh look — new blue & orange brand across the whole app.',
      '💬 Real-time chat that stays open as long as you\'re both talking.',
    ],
  },
];
