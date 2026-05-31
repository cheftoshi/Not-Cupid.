// Friend Maxxin quiz — the INCREMENTAL piece on top of HEXACO + dating vibes.
// Captures what friendship matching needs that romance scoring doesn't:
// shared activities (the #1 friendship driver), cadence, group size, life stage,
// and what kind of friendship you want. Stored on users.friend_vibes (JSONB).

export interface FriendQuestion {
  key: 'intent' | 'activities' | 'cadence' | 'group_size' | 'life_stage';
  short: string;
  q: string;
  multi?: boolean;
  opts: string[];
}

export const FRIEND_QUESTIONS: FriendQuestion[] = [
  {
    key: 'intent', short: 'looking for',
    q: 'what are you actually after?',
    opts: ['1–2 close friends', 'a small crew', 'a big social circle', 'activity partners'],
  },
  {
    key: 'activities', short: 'do together', multi: true,
    q: 'what do you actually want to DO together? (pick a few)',
    opts: [
      'workouts & run club', 'bars & nightlife', 'coffee & deep talks',
      'concerts & shows', 'outdoors & hikes', 'food & restaurants',
      'creative & art', 'gaming & nerdy stuff', 'sports (watch or play)',
    ],
  },
  {
    key: 'cadence', short: 'how often',
    q: 'how often do you want to hang?',
    opts: ['most days', 'weekly', 'couple times a month', 'occasionally'],
  },
  {
    key: 'group_size', short: 'ideal hang',
    q: 'your ideal hang is…',
    opts: ['1-on-1', 'small (3–5)', 'a big group'],
  },
  {
    key: 'life_stage', short: 'life stage',
    q: 'where are you in life right now?',
    opts: ['new to boston', 'heads-down on career', 'student / grad school', 'settled / parent', 'figuring it out'],
  },
];

export interface FriendVibes {
  intent?: string;
  activities?: string[];
  cadence?: string;
  group_size?: string;
  life_stage?: string;
}

// Build the stored friend_vibes object from the client's answer payload.
// Single-select answers are option strings; activities is an array of strings.
export function normalizeFriendVibes(input: any): FriendVibes {
  const out: FriendVibes = {};
  if (!input || typeof input !== 'object') return out;
  const single = (key: keyof FriendVibes, q: FriendQuestion) => {
    const v = input[key];
    if (typeof v === 'string' && q.opts.includes(v)) (out as any)[key] = v;
  };
  for (const q of FRIEND_QUESTIONS) {
    if (q.multi) {
      const arr: string[] = Array.isArray(input.activities)
        ? input.activities.filter((a: any): a is string => typeof a === 'string' && q.opts.includes(a))
        : [];
      out.activities = Array.from(new Set<string>(arr)).slice(0, q.opts.length);
    } else {
      single(q.key as keyof FriendVibes, q);
    }
  }
  return out;
}

export function hasFriendVibes(v: any): boolean {
  return !!v && typeof v === 'object' && Array.isArray(v.activities) && v.activities.length > 0;
}
