// Boston Calendar (thebostoncalendar.com) — editorial picks for what's
// happening in town. They publish an RSS feed of upcoming events with
// title, description, link, and pub date. No API key required.
//
// We inline a small RSS parser instead of adding xml2js — RSS 2.0 is
// simple enough to parse with regex for our purposes and avoids dragging
// in a 1MB dep tree.
//
// Quality controls:
//   - Must have a title and a link
//   - Description is required (the editorial blurb is the value-add)
//   - Cap pubDate to last 30 days (drops stale entries)
//
// Categorization: Boston Calendar entries don't carry a structured
// category, so everything maps to 'cultural' by default with broad tags.
// The admin "hide" mechanism handles outliers.

import type { Activity } from './activities';

const RSS_URL = 'https://www.thebostoncalendar.com/events.rss';
const CACHE_MIN = 60 * 2; // refresh every 2h

let cache: { at: number; data: Activity[] } | null = null;

export async function fetchBostonCalendarActivities(): Promise<Activity[]> {
  if (cache && Date.now() - cache.at < CACHE_MIN * 60_000) return cache.data;

  try {
    const res = await fetch(RSS_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('BostonCalendar: non-200', { status: res.status });
      return [];
    }
    const xml = await res.text();
    const items = parseRssItems(xml);

    const cutoff = Date.now() - 30 * 86400_000; // 30 days back
    const mapped: Activity[] = items
      .filter((i) => i.title && i.link && i.description)
      .filter((i) => {
        if (!i.pubDate) return true;
        const ts = Date.parse(i.pubDate);
        return isNaN(ts) || ts >= cutoff;
      })
      .map((i) => toActivity(i));

    cache = { at: Date.now(), data: mapped };
    return mapped;
  } catch (err: any) {
    console.warn('BostonCalendar: fetch failed', { msg: err?.message });
    return [];
  }
}

// ─── RSS parsing ─────────────────────────────────────────────────────────
// Lightweight RSS 2.0 parser. Pulls <item> blocks and extracts the
// standard fields. Handles CDATA. Not a general-purpose XML parser —
// good enough for predictable RSS feeds.

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) || [];

  for (const raw of matches) {
    items.push({
      title: extractTag(raw, 'title'),
      link: extractTag(raw, 'link'),
      description: extractTag(raw, 'description'),
      pubDate: extractTag(raw, 'pubDate'),
      guid: extractTag(raw, 'guid'),
    });
  }
  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return undefined;
  let val = m[1].trim();
  // Strip CDATA
  val = val.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
  // Decode common entities
  val = val
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return val;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function toActivity(item: RssItem): Activity {
  const cleanDesc = stripHtml(item.description || '');
  const blurb = cleanDesc.length > 180 ? cleanDesc.slice(0, 177) + '…' : cleanDesc;
  const id = item.guid || item.link || `${item.title}|${item.pubDate || ''}`;

  return {
    id: `live:cal:${hashId(id)}`,
    source: 'boston-calendar',
    title: item.title || 'Untitled event',
    blurb: blurb || 'Editor\'s pick from The Boston Calendar.',
    category: 'cultural',
    tags: ['art', 'music', 'theater'],
    url: item.link,
    whenLabel: item.pubDate ? formatRssDate(item.pubDate) : undefined,
  };
}

function formatRssDate(raw: string): string | undefined {
  const ts = Date.parse(raw);
  if (isNaN(ts)) return undefined;
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Stable short id — for activity_id uniqueness without exposing raw URLs.
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
