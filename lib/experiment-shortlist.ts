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

export type SlotAwareDecisionEdge<T = string> = ShortlistDecisionEdge<T> & {
  availableSlotKeys: string[];
};

export type DinnerSlotSelection<T = string> = {
  edge: SlotAwareDecisionEdge<T>;
  slotKey: string;
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

/**
 * V5 shortlist ranking. Start with the strongest disjoint reciprocal edges,
 * then use each person's second slot to rescue uncovered participants before
 * filling any remaining capacity by quality. With a two-option cap this keeps
 * broad access without allowing a weak scarcity edge to displace a person's
 * strongest available first option.
 */
export function buildReciprocalQualityShortlist<T>(
  candidates: ShortlistCandidateEdge<T>[],
  maxOptions = 2,
): ShortlistCandidateEdge<T>[] {
  if (maxOptions < 1) return [];
  const ordered = [...candidates].sort((left, right) => {
    const scoreOrder = right.score - left.score;
    if (scoreOrder) return scoreOrder;
    const leftKey = [keyOf(left.a), keyOf(left.b)].sort().join('|');
    const rightKey = [keyOf(right.a), keyOf(right.b)].sort().join('|');
    return leftKey.localeCompare(rightKey);
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

  // Quality pass: every first option comes from the highest-scoring remaining
  // disjoint edge, rather than a low-scoring scarcity edge.
  for (const edge of ordered) {
    if (count(edge.a) === 0 && count(edge.b) === 0) add(edge);
  }

  // Coverage repair: an uncovered participant may use the second slot of a
  // covered person, but never pushes that person's strongest option away.
  for (const edge of ordered) {
    const edgeKey = [keyOf(edge.a), keyOf(edge.b)].sort().join('|');
    if (selectedKeys.has(edgeKey)) continue;
    if (count(edge.a) >= maxOptions || count(edge.b) >= maxOptions) continue;
    if (count(edge.a) === 0 || count(edge.b) === 0) add(edge);
  }

  // Optional second choices are then filled strictly by reciprocal quality.
  for (const edge of ordered) {
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

export function mutualWinnerSelectionPool<T>(
  pool: ShortlistDecisionEdge<T>[],
  remainingSlots: number,
): ShortlistDecisionEdge<T>[] {
  if (remainingSlots <= 1) return pool;
  const keepsAnotherPairAvailable = pool.filter((edge) => {
    const used = new Set([keyOf(edge.a), keyOf(edge.b)]);
    return pool.some((other) => other.id !== edge.id && !used.has(keyOf(other.a)) && !used.has(keyOf(other.b)));
  });
  return keepsAnotherPairAvailable.length ? keepsAnotherPairAvailable : pool;
}

/** Pick one dinner pair only from mutual yes edges. */
export function selectMutualDinnerPair<T>(
  candidates: ShortlistDecisionEdge<T>[],
  compatibilityWeight: (score: number) => number,
  random = Math.random,
): ShortlistDecisionEdge<T> | null {
  return selectMutualDinnerPairs(candidates, 1, compatibilityWeight, random)[0] ?? null;
}

/**
 * Select up to `maxPairs` mutual dinner pairs without replacement. Once a pair
 * wins, every edge containing either participant is removed so nobody can win
 * two dinners in the same experiment.
 */
export function selectMutualDinnerPairs<T>(
  candidates: ShortlistDecisionEdge<T>[],
  maxPairs: number,
  compatibilityWeight: (score: number) => number,
  random = Math.random,
): ShortlistDecisionEdge<T>[] {
  let pool = candidates.filter((edge) => edge.aAccepted === true && edge.bAccepted === true);
  const selected: ShortlistDecisionEdge<T>[] = [];
  while (selected.length < Math.max(0, maxPairs) && pool.length) {
    // If two disjoint mutual pairs exist, do not let the first random choice
    // consume the only participant configuration that makes two prizes possible.
    const selectionPool = mutualWinnerSelectionPool(pool, maxPairs - selected.length);
    const total = selectionPool.reduce((sum, edge) => sum + mutualSelectionWeight(edge, compatibilityWeight), 0);
    let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
    let winner = selectionPool[selectionPool.length - 1];
    for (const edge of selectionPool) {
      cursor -= mutualSelectionWeight(edge, compatibilityWeight);
      if (cursor <= 0) {
        winner = edge;
        break;
      }
    }
    selected.push(winner);
    const used = new Set([keyOf(winner.a), keyOf(winner.b)]);
    pool = pool.filter((edge) => !used.has(keyOf(edge.a)) && !used.has(keyOf(edge.b)));
  }
  return selected;
}

/** Assign a fixed, ordered set of disjoint pairs to different dinner slots. */
export function assignDinnerSlots<T>(
  pairs: SlotAwareDecisionEdge<T>[],
  slotKeys: string[],
): DinnerSlotSelection<T>[] | null {
  const allowed = new Set(slotKeys);
  const assigned: DinnerSlotSelection<T>[] = [];
  const used = new Set<string>();
  function visit(index: number): boolean {
    if (index >= pairs.length) return true;
    const pair = pairs[index];
    for (const slotKey of pair.availableSlotKeys) {
      if (!allowed.has(slotKey) || used.has(slotKey)) continue;
      used.add(slotKey);
      assigned.push({ edge: pair, slotKey });
      if (visit(index + 1)) return true;
      assigned.pop();
      used.delete(slotKey);
    }
    return false;
  }
  return visit(0) ? assigned : null;
}

/**
 * Slot-aware winner selection. When two disjoint mutual pairs can use two
 * different reservations, the first weighted choice is restricted to a pair
 * that preserves that outcome. Every selected pair is returned with a shared
 * time that both participants marked available.
 */
export function selectMutualDinnerPairsForSlots<T>(
  candidates: SlotAwareDecisionEdge<T>[],
  maxPairs: number,
  slotKeys: string[],
  compatibilityWeight: (score: number) => number,
  random = Math.random,
): DinnerSlotSelection<T>[] {
  const allowed = new Set(slotKeys);
  let pool = candidates
    .filter((edge) => edge.aAccepted === true && edge.bAccepted === true)
    .map((edge) => ({ ...edge, availableSlotKeys: [...new Set(edge.availableSlotKeys)].filter((key) => allowed.has(key)) }))
    .filter((edge) => edge.availableSlotKeys.length > 0);
  const selected: DinnerSlotSelection<T>[] = [];
  const openSlots = [...slotKeys];

  while (selected.length < Math.max(0, maxPairs) && pool.length && openSlots.length) {
    const remainingCapacity = Math.min(maxPairs - selected.length, openSlots.length);
    let selectionPool = pool;
    if (remainingCapacity > 1) {
      const preservesAnotherSlot = pool.filter((edge) => {
        const usedPeople = new Set([keyOf(edge.a), keyOf(edge.b)]);
        return edge.availableSlotKeys.some((firstSlot) => pool.some((other) => (
          other.id !== edge.id
          && !usedPeople.has(keyOf(other.a))
          && !usedPeople.has(keyOf(other.b))
          && other.availableSlotKeys.some((otherSlot) => otherSlot !== firstSlot)
        )));
      });
      if (preservesAnotherSlot.length) selectionPool = preservesAnotherSlot;
    }

    const total = selectionPool.reduce((sum, edge) => sum + mutualSelectionWeight(edge, compatibilityWeight), 0);
    let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
    let winner = selectionPool[selectionPool.length - 1];
    for (const edge of selectionPool) {
      cursor -= mutualSelectionWeight(edge, compatibilityWeight);
      if (cursor <= 0) {
        winner = edge;
        break;
      }
    }

    let winnerSlot = winner.availableSlotKeys[0];
    if (remainingCapacity > 1) {
      const usedPeople = new Set([keyOf(winner.a), keyOf(winner.b)]);
      winnerSlot = winner.availableSlotKeys.find((firstSlot) => pool.some((other) => (
        other.id !== winner.id
        && !usedPeople.has(keyOf(other.a))
        && !usedPeople.has(keyOf(other.b))
        && other.availableSlotKeys.some((otherSlot) => otherSlot !== firstSlot)
      ))) ?? winnerSlot;
    }
    selected.push({ edge: winner, slotKey: winnerSlot });
    const usedPeople = new Set([keyOf(winner.a), keyOf(winner.b)]);
    const slotIndex = openSlots.indexOf(winnerSlot);
    if (slotIndex >= 0) openSlots.splice(slotIndex, 1);
    pool = pool
      .filter((edge) => !usedPeople.has(keyOf(edge.a)) && !usedPeople.has(keyOf(edge.b)))
      .map((edge) => ({ ...edge, availableSlotKeys: edge.availableSlotKeys.filter((key) => key !== winnerSlot) }))
      .filter((edge) => edge.availableSlotKeys.length > 0);
  }
  return selected;
}
