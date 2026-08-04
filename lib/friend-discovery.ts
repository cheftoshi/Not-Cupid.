import { normalizeFriendActivity, type FriendActivityKey } from './friend-taxonomy.ts';

export type FriendDiscoveryKind = 'event' | 'club' | 'community' | 'intent';

export type FriendDiscoveryItem = {
  id: string;
  kind: FriendDiscoveryKind;
  activityKey?: string | null;
  area?: string | null;
  timeWindow?: string | null;
  cadence?: string | null;
  happensAt?: string | null;
  createdAt?: string | null;
  verifiedAt?: string | null;
  memberCount?: number;
  joinCount?: number;
};

export type FriendDiscoveryContext = {
  selected?: FriendActivityKey | null;
  affinities?: FriendActivityKey[];
  area?: string | null;
  now?: number;
};

export function scoreFriendDiscovery(item: FriendDiscoveryItem, context: FriendDiscoveryContext) {
  const reasons: string[] = [];
  const key = normalizeFriendActivity(item.activityKey);
  const now = context.now ?? Date.now();
  let score = 0;

  if (context.selected && key === context.selected) {
    score += 46;
    reasons.push('what you want to do');
  } else if ((context.affinities || []).includes(key)) {
    score += 28;
    reasons.push('fits your friend vibe');
  } else {
    score += 5;
  }

  if (context.area && item.area && context.area.toLowerCase() === item.area.toLowerCase()) {
    score += 10;
    reasons.push('near you');
  }

  if (item.kind === 'event') {
    score += 18;
    const hours = item.happensAt ? (new Date(item.happensAt).getTime() - now) / 3_600_000 : Infinity;
    if (hours >= 0 && hours <= 72) { score += 16; reasons.push('happening soon'); }
    else if (hours > 72 && hours <= 24 * 14) score += 9;
    score += Math.min(10, Math.max(0, item.memberCount || 0) * 2);
  } else if (item.kind === 'club') {
    score += 15;
    if (item.cadence === 'weekly' || item.cadence === 'biweekly') { score += 13; reasons.push('recurring'); }
    score += Math.min(10, Math.log2(1 + Math.max(0, item.memberCount || 0)) * 3);
  } else if (item.kind === 'community') {
    score += 14;
    if (item.verifiedAt) { score += 12; reasons.push('recently checked'); }
    score += Math.min(8, Math.log2(1 + Math.max(0, item.joinCount || 0)) * 2);
  } else {
    score += 13;
    score += Math.min(12, Math.max(0, item.memberCount || 0) * 3);
    const ageHours = item.createdAt ? (now - new Date(item.createdAt).getTime()) / 3_600_000 : Infinity;
    if (ageHours >= 0 && ageHours <= 48) { score += 10; reasons.push('fresh signal'); }
  }

  return { score: Math.round(score), reasons: reasons.slice(0, 3) };
}

export function rankFriendDiscovery<T extends FriendDiscoveryItem>(items: T[], context: FriendDiscoveryContext) {
  return items
    .map((item) => ({ ...item, ...scoreFriendDiscovery(item, context) }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}
