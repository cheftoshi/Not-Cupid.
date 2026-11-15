import { createHash } from 'node:crypto';
import { isLgbtqIdentity } from '@/lib/friend-matching';
import { eventInWindow, outsideEventUrl, type CityEvent } from '@/lib/city-events';

export const FRIEND_DISCOVERY_VERSION = 'friend-discovery-review-v1-2026-11-15';
export type DiscoveryEdition = 'ideas' | 'weekend';
export type DiscoveryItem = { key: string; kind: 'plan' | 'event'; id: string; title: string; category: string; startsAt: string | null; area?: string; relatedEventId?: string; sourceLabel?: string; sourceUrl?: string };
export const easternDate = (now: number) => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function discoveryEditionId(edition: DiscoveryEdition, now: number) {
  if (!['ideas','weekend'].includes(edition) || !Number.isFinite(now)) throw Error('Invalid edition');
  // One immutable review slot per edition and Eastern Monday-based week.
  const date = new Date(easternDate(now)+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  return `friend_events_announcement_discovery_${date.toISOString().slice(0,10).replaceAll('-','')}_${edition}`;
}
export function discoveryHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function freshDiscoveryEvents(events: CityEvent[], edition: DiscoveryEdition, now: number) {
  return events.filter(e => outsideEventUrl(e.url,e.id) && eventInWindow(e,edition==='weekend'?'weekend':'week',now)
    && (!e.curated || (!!e.sourceCheckedAt && Date.parse(e.sourceCheckedAt)<=now && now-Date.parse(e.sourceCheckedAt)<3*86400000)));
}
export function selectDiscoveryItems(user: any, input: { plans: any[]; users: any[]; rsvps: any[]; reports: any[]; events: CityEvent[]; admins: string[]; seen: Set<string> }, edition: DiscoveryEdition, now: number): DiscoveryItem[] {
  const live = (u: any) => u && !u.is_test && !u.is_blocked && !u.deleted_at && !input.admins.includes((u.email||'').trim().toLowerCase());
  if (!live(user) || !user.age || user.age<18) return [];
  const hosts = new Map(input.users.filter(live).map(u=>[u.id,u]));
  const blocked = new Set(input.reports.filter(r=>r.reporter_id===user.id||r.reported_id===user.id).map(r=>r.reporter_id===user.id?r.reported_id:r.reporter_id));
  const fresh = freshDiscoveryEvents(input.events,edition,now), byEvent = new Map(fresh.map(e=>[e.id,e]));
  const plans = input.plans.filter(p=>{
    if (p.kind!=='event'||p.is_test||p.metro!=='boston'||!hosts.has(p.author_id)||blocked.has(p.author_id)||p.author_id===user.id||input.seen.has(`plan:${p.id}`)) return false;
    if (!p.expires_at||!(Date.parse(p.expires_at)>now)||!Number.isInteger(p.capacity)||p.capacity<2||p.capacity>10) return false;
    if (p.happens_at && !eventInWindow({startsAt:p.happens_at} as CityEvent,edition==='weekend'?'weekend':'week',now)) return false;
    if (p.external_event_id && (!byEvent.has(p.external_event_id)||Date.parse(byEvent.get(p.external_event_id)!.startsAt)!==Date.parse(p.happens_at)||input.seen.has(`event:${p.external_event_id}`))) return false;
    const members=input.rsvps.filter(r=>r.activity_id===p.id&&r.response==='yes');
    if (input.rsvps.some(r=>r.activity_id===p.id&&r.user_id===user.id)) return false;
    const occupants = new Set([p.author_id,...members.map(r=>r.user_id)]);
    if (occupants.size>=p.capacity || [...occupants].some(id=>blocked.has(id))) return false;
    if (Array.isArray(p.audience_gender)&&p.audience_gender.length&&!p.audience_gender.includes(user.gender)&&!(p.audience_gender.includes('lgbtq')&&isLgbtqIdentity(user))) return false;
    return !(p.audience_age_min!=null&&user.age<p.audience_age_min) && !(p.audience_age_max!=null&&user.age>p.audience_age_max);
  }).sort((a,b)=>(Date.parse(a.happens_at||a.expires_at)-Date.parse(b.happens_at||b.expires_at))||a.id.localeCompare(b.id));
  const chosen: DiscoveryItem[] = plans.slice(0,2).map(p=>({key:`plan:${p.id}`,kind:'plan',id:p.id,title:String(p.title).slice(0,200),category:p.category||'community',startsAt:p.happens_at||null,area:p.area||undefined,relatedEventId:p.external_event_id||undefined}));
  const represented=new Set(plans.slice(0,2).map(p=>p.external_event_id).filter(Boolean));
  const remaining=[...new Map(fresh.filter(e=>!input.seen.has(`event:${e.id}`)&&!represented.has(e.id)).map(e=>[e.id,e])).values()].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
  const categories=new Set(chosen.map(p=>p.category));
  while(chosen.length<3&&remaining.length){const index=Math.max(0,remaining.findIndex(e=>!categories.has(e.category)));const [e]=remaining.splice(index,1);categories.add(e.category);chosen.push({key:`event:${e.id}`,kind:'event',id:e.id,title:e.title,category:e.category,startsAt:e.startsAt,sourceLabel:e.sourceLabel||'Ticketmaster',sourceUrl:e.url});}
  return chosen;
}
