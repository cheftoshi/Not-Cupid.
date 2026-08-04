export const FRIEND_TRAVEL_PACK_SIZE = 5;

type FriendSegmentConnection = {
  match_metro?: string | null;
};

// Legacy rows have no match_metro and belong to the member's home segment.
// Travel rows must be explicitly stamped so a Boston trip never consumes a
// New York pack (or reveals a New York pack while the visitor is in Boston).
export function connectionInFriendSegment(
  connection: FriendSegmentConnection,
  metro: string | null,
  isTraveling: boolean,
): boolean {
  if (isTraveling) return !!metro && connection.match_metro === metro;
  return !connection.match_metro || connection.match_metro === metro;
}

// The first destination pack is intentionally smaller than the home pack.
// Purchased/Pro rounds still add the same full round used everywhere else.
export function travelSegmentCapacity(max: number, base: number): number {
  return Math.min(max, FRIEND_TRAVEL_PACK_SIZE + Math.max(0, max - base));
}

export function travelWindowsOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstStart <= secondEnd && firstEnd >= secondStart;
}

// Visitor-to-local matches last through the visitor's departure day. When two
// visitors overlap, the match expires at the earlier departure because that is
// when they stop sharing the destination. Mutual connections clear the expiry.
export function travelMatchExpiry(endDates: string[]): string | null {
  const earliest = endDates.filter(Boolean).sort()[0];
  return earliest ? `${earliest}T23:59:59.999Z` : null;
}
