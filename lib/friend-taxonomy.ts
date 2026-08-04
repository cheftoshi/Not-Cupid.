// One activity language for Friend Line. Quiz answers, Scene categories, clubs,
// community links, and short-lived "I'm down for" signals used to speak
// slightly different dialects, which made cross-surface discovery impossible.

export const FRIEND_ACTIVITIES = [
  { key: 'run_fitness', label: 'run / workout', emoji: '🏃' },
  { key: 'sports', label: 'sports', emoji: '🎾' },
  { key: 'outdoors', label: 'outdoors', emoji: '🌲' },
  { key: 'books', label: 'book club', emoji: '📚' },
  { key: 'coffee', label: 'coffee / walk', emoji: '☕' },
  { key: 'food', label: 'food', emoji: '🍜' },
  { key: 'nightlife', label: 'drinks / nightlife', emoji: '🍸' },
  { key: 'music', label: 'music / shows', emoji: '🎶' },
  { key: 'arts', label: 'creative / arts', emoji: '🎨' },
  { key: 'games', label: 'games', emoji: '🎲' },
  { key: 'volunteering', label: 'volunteering', emoji: '🤝' },
  { key: 'coworking', label: 'coworking', emoji: '💻' },
  { key: 'other', label: 'something else', emoji: '✨' },
] as const;

export type FriendActivityKey = typeof FRIEND_ACTIVITIES[number]['key'];

const VALID = new Set<string>(FRIEND_ACTIVITIES.map((activity) => activity.key));
const ALIASES: Record<string, FriendActivityKey> = {
  // Friend quiz answers.
  'workouts & run club': 'run_fitness',
  'bars & nightlife': 'nightlife',
  'coffee & deep talks': 'coffee',
  'concerts & shows': 'music',
  'outdoors & hikes': 'outdoors',
  'food & restaurants': 'food',
  'creative & art': 'arts',
  'gaming & nerdy stuff': 'games',
  'sports (watch or play)': 'sports',
  // Scene + legacy club categories.
  active: 'run_fitness', fitness: 'run_fitness', gym: 'run_fitness', running: 'run_fitness', yoga: 'run_fitness',
  tennis: 'sports', pickleball: 'sports',
  'run club': 'run_fitness', workouts: 'run_fitness',
  'book club': 'books', reading: 'books',
  chill: 'coffee', hang: 'other',
  drinks: 'nightlife', nightlife: 'nightlife',
  concerts: 'music', movies: 'music', culture: 'arts',
};

export function normalizeFriendActivity(value: unknown): FriendActivityKey {
  const raw = String(value ?? '').trim().toLowerCase();
  if (VALID.has(raw)) return raw as FriendActivityKey;
  return ALIASES[raw] || 'other';
}

export function friendActivity(value: unknown) {
  const key = normalizeFriendActivity(value);
  return FRIEND_ACTIVITIES.find((activity) => activity.key === key) || FRIEND_ACTIVITIES[FRIEND_ACTIVITIES.length - 1];
}

export function friendActivityAffinity(vibes: any): FriendActivityKey[] {
  const source = Array.isArray(vibes?.activities) ? vibes.activities : [];
  return Array.from(new Set(source.map(normalizeFriendActivity)));
}

export function friendSceneCategory(value: unknown): 'food' | 'drinks' | 'active' | 'outdoors' | 'culture' | 'games' | 'chill' | 'hang' {
  const key = normalizeFriendActivity(value);
  if (key === 'run_fitness' || key === 'sports') return 'active';
  if (key === 'outdoors') return 'outdoors';
  if (key === 'books' || key === 'music' || key === 'arts') return 'culture';
  if (key === 'food') return 'food';
  if (key === 'nightlife') return 'drinks';
  if (key === 'games') return 'games';
  if (key === 'coffee') return 'chill';
  return 'hang';
}

export const FRIEND_TIME_WINDOWS = [
  { key: 'today', label: 'today' },
  { key: 'this_week', label: 'this week' },
  { key: 'weekend', label: 'this weekend' },
  { key: 'ongoing', label: 'ongoing' },
] as const;

export type FriendTimeWindow = typeof FRIEND_TIME_WINDOWS[number]['key'];

export function isFriendTimeWindow(value: unknown): value is FriendTimeWindow {
  return FRIEND_TIME_WINDOWS.some((window) => window.key === value);
}

export function friendIntentExpiry(window: FriendTimeWindow, now = Date.now()): string {
  const days = window === 'today' ? 1 : window === 'ongoing' ? 14 : window === 'weekend' ? 6 : 7;
  return new Date(now + days * 86_400_000).toISOString();
}
