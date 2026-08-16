// User-facing "what's new" changelog. Add a new entry at the TOP and bump
// CHANGELOG_VERSION — that drives the "new" dot for returning users.

export interface ChangelogEntry {
  date: string;
  items: string[];
}

// Bump this string whenever you add an entry. The dashboard compares it to
// the version the user last saw (localStorage) to show a "new" indicator.
export const CHANGELOG_VERSION = '2026-08-16-dating-experiment';

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'August 2026',
    items: [
      '🍽️ The Boston Dating Experiment is live — opt in free, meet up to 2 private compatibility options, and mutually choose who you would actually meet. Up to 2 mutual pairs get dinner on us.',
      '🎥 Video is optional — add a private 5–15 second hello if you want to show more personality. Skipping it never affects eligibility or compatibility.',
      '💘 More room to meet — keep up to 3 active Love connections while 5 curated options rotate with your activity.',
      '✈ Going somewhere? Add an upcoming trip and Friend Line will route local people, plans, clubs, and communities before you arrive.',
      '📱 Friend Line is smoother on phones — thumb-sized controls, compact navigation, safer modal scrolling, and better support for notched screens.',
      '🔒 Compatibility profiles — a clearer optional $0.99 unlock shows exactly what a match shared, from extra photos and interests to values and connection style. Chat stays free.',
      '✦ Prefer everything open? Pro is still $3.99/mo, and one-time Love profile and Friend pack unlocks stay $0.99.',
    ],
  },
  {
    date: 'June 2026',
    items: [
      '🎒 Friendship packs — your Friend Line matches now come in packs you OPEN, cinematically. First pack (up to 5 friends) is free; more are $0.99 each.',
      '✦ NotCupid Pro — one $3.99/mo subscription unlocks everything: every love profile, unlimited friendship packs, and events.',
      '💸 Love unlocks are now just $0.99 (down from $1.99) — see a match’s compatibility profile for less.',
      '🔔 More notifications — get pinged when a match is expiring, when someone unlocks your profile, and when a new friend match lands.',
      '🌍 Change your city — set your home base from any city we’re live in (all of New England + NYC) right from the hub.',
      '✨ Sun signs — add yours on your profile for a little cosmic flavor (just for fun — never part of how we match you).',
    ],
  },
  {
    date: 'May 2026',
    items: [
      '✦ Date Vibes — a private game with your match: pick what you\'re into, swipe activities, and the ones you both want pin to the top. The deck warms up as you go.',
      '📸 Profile gallery — add up to 3 more photos (part of the $0.99 profile unlock).',
      '📍 Smarter local matching — a tighter 15-mile default, with one-tap "widen my search" when your area is quiet.',
      '⚡ Faster matches — the algorithm now re-runs every 20 minutes instead of once a day.',
      '🎨 A fresh look — new blue & orange brand across the whole app.',
      '💬 Real-time chat that stays open as long as you\'re both talking.',
    ],
  },
];
