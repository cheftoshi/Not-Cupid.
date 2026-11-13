// Editorial lifecycle for a versioned local catalogue. No network/database writes.
import { createHash } from 'node:crypto';
import { curatedPublicUrl } from './city-events.ts';
export const CURATED_REFRESH_MS = 3 * 86400000;
export type CuratedCategory = 'music'|'arts'|'sports'|'food'|'outdoors'|'community';
export type CuratedFacts = {
  id: string; city: 'boston'; title: string; venue: string; startsAt: string;
  category: CuratedCategory; sourceUrl: string; sourceLabel: string;
  sourceCheckedAt: string; price: { min:number; max:number; currency:string } | null;
  publicAdmissionConfirmed: boolean; timeConfirmed: boolean;
};
export type CuratedRecord = {
  facts: CuratedFacts; state:'draft'|'reviewed'|'published';
  reviewedAt?:string; reviewDigest?:string; publishedAt?:string; expiresAt?:string;
};
export const curatedSourceUrl = curatedPublicUrl;
const stamp=(v:string)=>/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
function digest(f:CuratedFacts) {
  // Fixed key order means object serialization order cannot change approval.
  return createHash('sha256').update(JSON.stringify([f.id,f.city,f.title,f.venue,f.startsAt,f.category,f.sourceUrl,f.sourceLabel,f.sourceCheckedAt,f.price,f.publicAdmissionConfirmed,f.timeConfirmed])).digest('hex');
}
function validate(f:CuratedFacts,now:number) {
  if(!f || typeof f.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(f.id) || f.city!=='boston')throw Error('Choose a stable Boston event ID.');
  if(typeof f.title!=='string'||!f.title.trim()||f.title.length>200||typeof f.venue!=='string'||!f.venue.trim()||f.venue.length>120)throw Error('Add a short title and venue.');
  if(!['music','arts','sports','food','outdoors','community'].includes(f.category))throw Error('Choose a supported category.');
  if(typeof f.sourceUrl!=='string'||!curatedSourceUrl(f.sourceUrl)||curatedSourceUrl(f.sourceUrl)!==f.sourceUrl||typeof f.sourceLabel!=='string'||!f.sourceLabel.trim()||f.sourceLabel.length>100)throw Error('Add the source name and HTTPS event link.');
  if(!stamp(f.startsAt)||Date.parse(f.startsAt)<=now||Date.parse(f.startsAt)>now+60*86400000)throw Error('Confirm an upcoming event time with timezone, within 60 days.');
  if(!stamp(f.sourceCheckedAt)||Date.parse(f.sourceCheckedAt)>now||now-Date.parse(f.sourceCheckedAt)>=CURATED_REFRESH_MS)throw Error('Check the source again; checks expire after three days.');
  if(f.publicAdmissionConfirmed!==true||f.timeConfirmed!==true)throw Error('Confirm public admission and the event time before review.');
  const p=f.price;
  if(p!==null&&(!p||!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.min<0||p.max<p.min||!/^[A-Z]{3}$/.test(p.currency)))throw Error('Use a verified price or null for unknown.');
}
export function draftCuratedEvent(facts:CuratedFacts):CuratedRecord {const normalized=structuredClone(facts); const url=curatedSourceUrl(normalized.sourceUrl); if(url) normalized.sourceUrl=url; return {facts:normalized,state:'draft'};}
export function reviewCuratedEvent(record:CuratedRecord,now=Date.now()):CuratedRecord {
  if(record.state!=='draft')throw Error('Return this event to draft before reviewing it.');
  validate(record.facts,now);
  return {...structuredClone(record),state:'reviewed',reviewedAt:new Date(now).toISOString(),reviewDigest:digest(record.facts)};
}
export function publishCuratedEvent(record:CuratedRecord,now=Date.now()):CuratedRecord {
  validate(record.facts,now);
  if(record.state!=='reviewed'||record.reviewDigest!==digest(record.facts)||!record.reviewedAt||!stamp(record.reviewedAt)||Date.parse(record.reviewedAt)>now)throw Error('Review the exact current event before publishing.');
  return {...structuredClone(record),state:'published',publishedAt:new Date(now).toISOString(),expiresAt:new Date(Math.min(Date.parse(record.facts.startsAt),Date.parse(record.facts.sourceCheckedAt)+CURATED_REFRESH_MS)).toISOString()};
}
export function activeCuratedEvents(records:readonly CuratedRecord[],now=Date.now()) {
  const ids=new Set<string>();
  return records.flatMap(record=>{
    try {
      validate(record.facts,now);
      if(record.state!=='published'||record.reviewDigest!==digest(record.facts)||!record.publishedAt||!record.reviewedAt||
         !stamp(record.publishedAt)||!stamp(record.reviewedAt)||Date.parse(record.publishedAt)>now||Date.parse(record.reviewedAt)>Date.parse(record.publishedAt)||
         !record.expiresAt||!stamp(record.expiresAt)||Date.parse(record.expiresAt)<=now||ids.has(record.facts.id))return [];
      const f=record.facts; ids.add(f.id);
      return [{id:`live:curated:${f.id}`,title:f.title,venue:f.venue,startsAt:f.startsAt,url:f.sourceUrl,category:f.category,price:f.price,
        sourceLabel:f.sourceLabel,sourceCheckedAt:f.sourceCheckedAt,curated:true as const}];
    }catch{return [];}
  });
}
