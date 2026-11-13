// Pure contracts for future permitted community adapters. Not connected to any
// live provider or publication route. Registry entries must be server-owned.
export type EventSourcePolicy = {
  key: string;
  label: string;
  allowedHosts: readonly string[];
  maxAgeMs: number;
};
export type CommunityEvent = {
  id: string;
  source: { key: string; label: string; checkedAt: string };
  title: string;
  venue: string;
  startsAt: string;
  url: string;
  category: 'music' | 'arts' | 'sports' | 'food' | 'outdoors' | 'community';
  price: { min: number; max: number; currency: string } | null;
};
export type SourceEventInput = Omit<CommunityEvent, 'id' | 'source'> & {
  providerId: string;
  checkedAt: string;
  status: 'scheduled' | 'cancelled' | 'postponed' | 'unknown';
};
export function sourceEventUrl(value: unknown, policy: EventSourcePolicy): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !policy.allowedHosts.includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function normalizeSourceEvent(input: SourceEventInput, policy: EventSourcePolicy, now = Date.now()): CommunityEvent | null {
  const url = sourceEventUrl(input.url, policy);
  const at = Date.parse(input.startsAt), checked = Date.parse(input.checkedAt);
  const explicitZone = /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(policy.key) || !policy.label.trim() ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.providerId) || !url ||
      !explicitZone.test(input.startsAt) || !explicitZone.test(input.checkedAt) ||
      !Number.isFinite(at) || at <= now || at > now + 14 * 86400000 ||
      !Number.isFinite(checked) || checked > now || policy.maxAgeMs <= 0 ||
      !Number.isFinite(policy.maxAgeMs) || now - checked > policy.maxAgeMs ||
      input.status !== 'scheduled' || !input.title?.trim() || !input.venue?.trim() ||
      !['music','arts','sports','food','outdoors','community'].includes(input.category)) return null;
  const p = input.price;
  const price = p && Number.isFinite(p.min) && Number.isFinite(p.max) && p.min >= 0 && p.max >= p.min && /^[A-Z]{3}$/.test(p.currency) ? p : null;
  return { id: `live:${policy.key}:${input.providerId}`, source: { key: policy.key, label: policy.label, checkedAt: input.checkedAt },
    title: input.title.trim().slice(0,200), venue: input.venue.trim().slice(0,120), startsAt: new Date(at).toISOString(), url,
    category: input.category, price };
}
// Collapse only exact provider IDs or identical source URLs at the same instant.
// Similar titles alone are not enough to merge unrelated performances.
export function deduplicateSourceEvents(events: readonly CommunityEvent[]): CommunityEvent[] {
  const ids = new Set<string>(), links = new Set<string>();
  return events.filter(event => {
    const key = `${event.url}\n${event.startsAt}`;
    if (ids.has(event.id) || links.has(key)) return false;
    ids.add(event.id); links.add(key); return true;
  });
}
