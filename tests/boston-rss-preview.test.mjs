import test from 'node:test';
import assert from 'node:assert/strict';
import { bostonRssPreview } from '../lib/boston-rss-preview.ts';
const now=Date.parse('2026-11-13T00:00:00Z'), checked=new Date(now).toISOString();
const item=()=>({title:'Park gathering',link:'https://www.boston.gov/calendar/example',guid:'https://www.boston.gov/123',description:'<div class="date-recur-date"><time datetime="2026-11-13T09:00:00Z">Fri, 11/13/2026 - 9:00am</time></div><span class="address-line1">Public Park</span><img src="https://example.test/image"><p>Full prose is excluded.</p>'});
test('Boston Z time is kept unverified; never creates a publishable timestamp',()=>{
 const [e]=bostonRssPreview([item()],checked,now);assert.equal(e.startsAt,null);assert.equal(e.timeStatus,'unverified_local_time');assert.equal(e.displayTime,'Fri, 11/13/2026 - 9:00am');assert.equal(e.publicationEligible,false);assert.equal(e.price,null);assert.equal(e.cancellationStatus,'unknown');assert.equal(JSON.stringify(e).includes('Full prose'),false);assert.equal(JSON.stringify(e).includes('image'),false);
});
test('preview enforces freshness and trusted source links and deduplicates occurrences',()=>{
 assert.equal(bostonRssPreview([item(),item()],checked,now).length,1);
 assert.deepEqual(bostonRssPreview([item()],new Date(now-3600001).toISOString(),now),[]);
 assert.deepEqual(bostonRssPreview([{...item(),link:'https://www.boston.gov.evil.test/a'}],checked,now),[]);
 const next={...item(),description:item().description.replaceAll('2026-11-13','2026-11-14').replace('11/13','11/14')};assert.equal(bostonRssPreview([item(),next],checked,now).length,2);
});
test('missing/ambiguous date is not replaced by publication date; explicit offset stays review-only',()=>{
 const missing={...item(),description:'<p>Publish Date: <time datetime="2026-11-13T09:00:00Z">9am</time></p>'};
 assert.equal(bostonRssPreview([missing],checked,now)[0].timeStatus,'missing_or_ambiguous');
 const explicit={...item(),description:item().description.replace('09:00:00Z','09:00:00-05:00')};
 const [e]=bostonRssPreview([explicit],checked,now);assert.equal(e.startsAt,'2026-11-13T14:00:00.000Z');assert.equal(e.publicationEligible,false);
});
