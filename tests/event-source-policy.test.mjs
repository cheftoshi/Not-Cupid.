import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceEventUrl, normalizeSourceEvent, deduplicateSourceEvents } from '../lib/event-source-policy.ts';
const now = Date.parse('2026-11-13T00:00:00Z');
const policy = {key:'sample', label:'Synthetic source', allowedHosts:['events.example.test'], maxAgeMs:3600000};
const raw = () => ({providerId:'abc',title:'Community walk',venue:'Public park',startsAt:'2026-11-14T18:00:00Z',url:'https://events.example.test/walk',category:'outdoors',price:null,checkedAt:new Date(now).toISOString(),status:'scheduled'});
test('source URLs require exact configured HTTPS hosts and reject credentials',()=>{
 assert.equal(sourceEventUrl(raw().url,policy),raw().url);
 for(const url of ['http://events.example.test/walk','https://events.example.test.evil.test/walk','https://user@events.example.test/walk','https://events.example.test:444/walk','javascript:alert(1)']) assert.equal(sourceEventUrl(url,policy),null);
 assert.equal(sourceEventUrl(raw().url,{...policy,allowedHosts:[]}),null);
});
test('community normalization preserves provenance and excludes stale, cancelled and unknown records',()=>{
 const good=normalizeSourceEvent(raw(),policy,now); assert.equal(good.id,'live:sample:abc');assert.equal(good.source.label,'Synthetic source');assert.equal(good.price,null);
 for(const status of ['cancelled','postponed','unknown']) assert.equal(normalizeSourceEvent({...raw(),status},policy,now),null);
 for(const checkedAt of ['bad',new Date(now+1).toISOString(),new Date(now-3600001).toISOString()]) assert.equal(normalizeSourceEvent({...raw(),checkedAt},policy,now),null);
 assert.equal(normalizeSourceEvent({...raw(),startsAt:'2026-11-14T18:00:00Z',price:{min:-1,max:0,currency:'USD'}},policy,now).price,null);
 assert.equal(normalizeSourceEvent({...raw(),providerId:'../x'},policy,now),null);
 assert.equal(normalizeSourceEvent(raw(),{...policy,maxAgeMs:NaN},now),null);
 assert.equal(normalizeSourceEvent({...raw(),startsAt:'2026-11-14T18:00:00'},policy,now),null);
});
test('deduplication keeps distinct times and venues rather than guessing from title',()=>{
 const one=normalizeSourceEvent(raw(),policy,now);
 const same={...one,id:'live:other:abc'};
 const later={...one,id:'live:sample:def',startsAt:'2026-11-15T18:00:00Z'};
 assert.deepEqual(deduplicateSourceEvents([one,same,later,one]),[one,later]);
});
