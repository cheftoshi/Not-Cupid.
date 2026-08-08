export type ShortlistCandidateEdge<T = string> = {
  a: T;
  b: T;
  score: number;
};

export type ShortlistDecisionEdge<T = string> = ShortlistCandidateEdge<T> & {
  id: string;
  aAccepted: boolean | null;
  bAccepted: boolean | null;
  aFavorite?: boolean;
  bFavorite?: boolean;
};

const keyOf = (value: unknown) => {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
};

/**
 * Build a reciprocal, undirected shortlist graph. Pass one prioritizes broad
 * coverage (scarce candidates first) so as many people as possible receive one
 * option. Pass two adds the strongest remaining edges without letting anyone
 * exceed the same max-options cap.
 */
export function buildCoverageFirstShortlist<T>(
  candidates: ShortlistCandidateEdge<T>[],
  maxOptions = 2,
): ShortlistCandidateEdge<T>[] {
  if (maxOptions < 1) return [];

  const degreeInPool = new Map<string, number>();
  for (const edge of candidates) {
    const a = keyOf(edge.a), b = keyOf(edge.b);
    degreeInPool.set(a, (degreeInPool.get(a) ?? 0) + 1);
    degreeInPool.set(b, (degreeInPool.get(b) ?? 0) + 1);
  }

  const ordered = [...candidates].sort((left, right) => {
    const leftScarcity = Math.min(degreeInPool.get(keyOf(left.a)) ?? 0, degreeInPool.get(keyOf(left.b)) ?? 0);
    const rightScarcity = Math.min(degreeInPool.get(keyOf(right.a)) ?? 0, degreeInPool.get(keyOf(right.b)) ?? 0);
    return leftScarcity - rightScarcity || right.score - left.score;
  });
  const selected: ShortlistCandidateEdge<T>[] = [];
  const selectedKeys = new Set<string>();
  const assigned = new Map<string, number>();
  const count = (user: T) => assigned.get(keyOf(user)) ?? 0;
  const add = (edge: ShortlistCandidateEdge<T>) => {
    const a = keyOf(edge.a), b = keyOf(edge.b);
    selected.push(edge);
    selectedKeys.add([a, b].sort().join('|'));
    assigned.set(a, (assigned.get(a) ?? 0) + 1);
    assigned.set(b, (assigned.get(b) ?? 0) + 1);
  };

  // Coverage pass: an edge is useful while it gives at least one uncovered
  // participant their first option and does not consume a second slot yet.
  for (const edge of ordered) {
    if (count(edge.a) > 0 && count(edge.b) > 0) continue;
    if (count(edge.a) >= 1 || count(edge.b) >= 1) continue;
    add(edge);
  }

  // A second coverage sweep can connect an uncovered participant to someone
  // who already has one option, without exceeding the shared capacity.
  for (const edge of ordered) {
    const edgeKey = [keyOf(edge.a), keyOf(edge.b)].sort().join('|');
    if (selectedKeys.has(edgeKey)) continue;
    if (count(edge.a) >= maxOptions || count(edge.b) >= maxOptions) continue;
    if (count(edge.a) === 0 || count(edge.b) === 0) add(edge);
  }

  // Quality pass: fill remaining second slots with the strongest compatible
  // unused pair. The cap is identical for every gender and orientation.
  for (const edge of [...candidates].sort((a, b) => b.score - a.score)) {
    const edgeKey = [keyOf(edge.a), keyOf(edge.b)].sort().join('|');
    if (selectedKeys.has(edgeKey)) continue;
    if (count(edge.a) >= maxOptions || count(edge.b) >= maxOptions) continue;
    add(edge);
  }
  return selected;
}

export function mutualSelectionWeight<T>(
  edge: ShortlistDecisionEdge<T>,
  compatibilityWeight: (score: number) => number,
): number {
  const favoriteCount = Number(edge.aFavorite === true) + Number(edge.bFavorite === true);
  const favoriteMultiplier = favoriteCount === 2 ? 1.5 : favoriteCount === 1 ? 1.2 : 1;
  return compatibilityWeight(edge.score) * favoriteMultiplier;
}

/** Pick one dinner pair only from mutual yes edges. */
export function selectMutualDinnerPair<T>(
  candidates: ShortlistDecisionEdge<T>[],
  compatibilityWeight: (score: number) => number,
  random = Math.random,
): ShortlistDecisionEdge<T> | null {
  const mutual = candidates.filter((edge) => edge.aAccepted === true && edge.bAccepted === true);
  if (!mutual.length) return null;
  const total = mutual.reduce((sum, edge) => sum + mutualSelectionWeight(edge, compatibilityWeight), 0);
  let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const edge of mutual) {
    cursor -= mutualSelectionWeight(edge, compatibilityWeight);
    if (cursor <= 0) return edge;
  }
  return mutual[mutual.length - 1];
}
