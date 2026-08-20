export type LoveBottleneckUser = {
  id: string;
  gender?: unknown;
  seeking?: unknown;
  age?: unknown;
  metro?: unknown;
  rosterSnapshot?: unknown;
};

type Counter = Record<string, number>;

function increment(counter: Counter, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function rosterSize(value: unknown): number {
  if (Array.isArray(value)) return new Set(value.filter((id): id is string => typeof id === 'string' && !!id)).size;
  return 0;
}

function ageBand(value: unknown): string {
  const age = Number(value);
  if (!Number.isFinite(age)) return 'unknown';
  if (age < 25) return '21–24';
  if (age < 30) return '25–29';
  if (age < 35) return '30–34';
  if (age < 40) return '35–39';
  if (age < 50) return '40–49';
  return '50+';
}

function genderLabel(value: unknown): string {
  if (value === 'm') return 'men';
  if (value === 'f') return 'women';
  return 'other_or_unspecified';
}

function seekingLabel(value: unknown): string {
  if (value === 'm') return 'men';
  if (value === 'f') return 'women';
  if (value === 'b' || value === 'both') return 'everyone';
  return 'unspecified';
}

function rosterBand(size: number): string {
  if (size === 0) return '0';
  if (size < 5) return '1–4';
  if (size < 10) return '5–9';
  return '10+';
}

export function summarizeLoveBottlenecks(input: {
  users: LoveBottleneckUser[];
  liveParticipantIds: Set<string>;
  shown24hIds: Set<string>;
  picked7dIds: Set<string>;
}) {
  const uncovered = input.users.filter((user) => !input.liveParticipantIds.has(user.id));
  const reasons = {
    noRosterInventory: 0,
    rosterAvailableNoPick7d: 0,
    pickedButNoLiveConnection7d: 0,
  };
  const gender: Counter = {};
  const seeking: Counter = {};
  const metro: Counter = {};
  const ageBands: Counter = {};
  const rosterSizes: Counter = {};
  let shown24h = 0;
  let picked7d = 0;

  for (const user of uncovered) {
    const size = rosterSize(user.rosterSnapshot);
    const wasShown = input.shown24hIds.has(user.id);
    const recentlyPicked = input.picked7dIds.has(user.id);
    if (recentlyPicked) reasons.pickedButNoLiveConnection7d += 1;
    else if (size > 0 || wasShown) reasons.rosterAvailableNoPick7d += 1;
    else reasons.noRosterInventory += 1;

    if (wasShown) shown24h += 1;
    if (recentlyPicked) picked7d += 1;
    increment(gender, genderLabel(user.gender));
    increment(seeking, seekingLabel(user.seeking));
    increment(ageBands, ageBand(user.age));
    increment(rosterSizes, rosterBand(size));
    increment(metro, typeof user.metro === 'string' && user.metro ? user.metro : 'unknown');
  }

  const orderedReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  return {
    total: uncovered.length,
    reasons,
    topReason: orderedReasons[0]?.[0] ?? null,
    shown24h,
    picked7d,
    gender,
    seeking,
    metro,
    ageBands,
    rosterSizes,
  };
}
