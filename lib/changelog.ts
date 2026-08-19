// User-facing "what's new" changelog. Add a new entry at the TOP and bump
// CHANGELOG_VERSION — that drives the "new" dot for returning users.

export interface ChangelogEntry {
  date: string;
  items: string[];
}

// Bump this string whenever you add an entry. The dashboard compares it to
// the version the user last saw (localStorage) to show a "new" indicator.
export const CHANGELOG_VERSION = '2026-08-18-hub-concierge-v1';

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'August 2026',
    items: [
      '✦ Your NotCupid concierge now lives at the top of the Hub — tell it whether you want Love, friends, a plan, a community, or help in another city, and it will route you to one real next move. You approve every action.',
      '🍽️ The Boston Dating Experiment is underway — entries are now closed. Entrants can follow their private compatibility options and mutually choose who they would actually meet. Up to 2 mutual pairs get dinner on us.',
      '🎥 Video is optional — add a private 5–15 second hello if you want to show more personality. Skipping it never affects eligibility or compatibility.',
      '💘 More people, still curated — every Love roster now shows up to 10 compatible options and includes 3 distinct connection picks.',
      '🪪 Love profiles are open — tap any roster card to read the bio, prompts and interests before choosing. Accepting and replying are always free.',
      '✈ Going somewhere? Add an upcoming trip and Friend Line will route local people, plans, clubs, and communities before you arrive.',
      '📱 Friend Line is smoother on phones — thumb-sized controls, compact navigation, safer modal scrolling, and better support for notched screens.',
      '🧠 AI Compatibility Read — the optional AI + HEXACO tab translates all six broad personality signals into strengths, watch-outs, and a first-date angle. Raw answers and exact scores stay private.',
      '✦ One $0.99 purchase — a person-specific AI Compatibility Read includes an extra Love connection to that person, so there is never a second charge. If it never becomes mutual, the connection value returns as an in-app credit while the read stays open.',
      '↩️ Paid-pick protection — if an extra Love connection is declined or expires before becoming mutual, the purchase automatically comes back as an in-app credit.',
      '🎒 Pro stays $3.99/mo and now includes AI Compatibility Reads, extra Love connection picks, and additional Friend packs.',
    ],
  },
  {
    date: 'June 2026',
    items: [
      '🎒 Friendship packs — your Friend Line matches now come in packs you OPEN, cinematically. First pack (up to 5 friends) is free; more are $0.99 each.',
      '✦ NotCupid Pro launched as one $3.99/mo subscription for optional extras across both lines.',
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
