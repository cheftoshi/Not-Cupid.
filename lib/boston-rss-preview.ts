// Local review-only Boston.gov RSS adapter. Never a publication-ready catalog.
// Only factual fields/source links are retained; description HTML/images are not.
import { sourceEventUrl } from './event-source-policy.ts';
export type BostonRssItem = { title: string; link: string; guid: string; description: string };
export type BostonPreviewEvent = {
  id: string; title: string; url: string; venue: string | null;
  source: { label: 'City of Boston'; checkedAt: string };
  displayTime: string | null; startsAt: string | null;
  timeStatus: 'unverified_local_time' | 'explicit_offset' | 'missing_or_ambiguous';
  price: null; cancellationStatus: 'unknown'; publicationEligible: false;
};
const policy = { key:'boston', label:'City of Boston', allowedHosts:['www.boston.gov','boston.gov'], maxAgeMs:3600000 };
function text(value: string) {
  return value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
export function bostonRssPreview(items: readonly BostonRssItem[], checkedAt: string, now = Date.now()): BostonPreviewEvent[] {
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(checked) || checked > now || now-checked > policy.maxAgeMs || items.length > 500) return [];
  const seen = new Set<string>();
  return items.flatMap(item => {
    if (typeof item.description !== 'string' || item.description.length > 100000 || typeof item.title !== 'string') return [];
    const url = sourceEventUrl(item.link,policy);
    const guid = sourceEventUrl(item.guid,policy);
    const title = text(item.title).slice(0,200);
    if (!url || !guid || !title) return [];
    const dates = item.description.match(/<div\b[^>]*class=["'][^"']*\bdate-recur-date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi) || [];
    const match = dates.length === 1 ? dates[0].match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i) : null;
    const raw = match?.[1] || '', displayTime = match ? text(match[2]).slice(0,120) : null;
    // Boston's observed Z-suffixed values conflict with displayed local clock
    // times. Do not silently reinterpret them as UTC or assert a corrected time.
    const offset = /T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw));
    const startsAt = offset ? new Date(raw).toISOString() : null;
    if (startsAt && (Date.parse(startsAt)<=now || Date.parse(startsAt)>now+14*86400000)) return [];
    const timeStatus = offset ? 'explicit_offset' : /Z$/.test(raw) && displayTime ? 'unverified_local_time' : 'missing_or_ambiguous';
    const venue = item.description.match(/<span\b[^>]*class=["'][^"']*\baddress-line1\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const key = `${guid}|${raw}|${displayTime}`;
    if (seen.has(key)) return []; seen.add(key);
    return [{id:`boston-preview:${encodeURIComponent(key)}`,title,url,venue:venue ? text(venue[1]).slice(0,120) : null,
      source:{label:'City of Boston' as const,checkedAt},displayTime,startsAt,timeStatus,price:null,cancellationStatus:'unknown' as const,publicationEligible:false as const}];
  });
}
