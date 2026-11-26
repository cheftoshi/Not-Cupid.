import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadTs,nextMock} from './helpers/load-ts.mjs';
import {eventInWindow,outsideEventUrl} from '../lib/city-events.ts';
import {signFriendEventToken,verifyFriendEventToken,friendEventDestination} from '../lib/friend-event-campaign.ts';
import {friendCampaignHash,executeFrozenFriendCampaign} from '../lib/friend-event-sender.ts';
const policy=await loadTs('lib/friend-discovery-edition.ts',{'node:crypto':{createHash},'@/lib/friend-matching':{isLgbtqIdentity:u=>u.is_lgbtq===true},'@/lib/city-events':{eventInWindow,outsideEventUrl}});
const now=Date.parse('2026-11-20T15:00:00Z'),user={id:randomUUID(),email:'recipient@example.test',age:28,gender:'woman'},host={id:randomUUID(),email:'host@example.test'};
const plan={id:randomUUID(),author_id:host.id,kind:'event',metro:'boston',title:'Synthetic coffee plan',category:'food',area:'Back Bay',capacity:4,expires_at:'2026-11-23T15:00:00Z',happens_at:'2026-11-21T15:00:00Z'};
const event=(n,category='music')=>({id:'live:curated:test-'+n,title:'Synthetic '+n,category,startsAt:'2026-11-21T18:00:00Z',url:'https://example.test/event/'+n,curated:true,sourceCheckedAt:new Date(now-3600000).toISOString(),sourceLabel:'Example organizer',price:null,venue:'Public event venue'});
const inventory=()=>({plans:[plan],users:[user,host],rsvps:[],reports:[],events:[event(1),event(2),event(3,'arts')],admins:['admin@example.test'],seen:new Set()});
test('plan-first selection is concise, diverse, bounded by actual eligibility and does not cap the catalogue',()=>{
 const i=inventory();i.events.push(...Array.from({length:250},(_,n)=>event(n+10,'sports')));
 const items=policy.selectDiscoveryItems(user,i,'weekend',now);
 assert.equal(items.length,3);assert.equal(items[0].kind,'plan');assert.equal(items[1].category,'music');assert.notEqual(items[2].category,'music');assert.equal(i.events.length,253);
 for(const change of [{capacity:1},{expires_at:new Date(now).toISOString()},{is_test:true},{metro:'nyc'},{audience_gender:['man']},{audience_age_min:30},{author_id:user.id}])assert.equal(policy.selectDiscoveryItems(user,{...i,plans:[{...plan,...change}]},'weekend',now).some(x=>x.kind==='plan'),false);
 assert.equal(policy.selectDiscoveryItems(user,{...i,reports:[{reporter_id:host.id,reported_id:user.id}]},'weekend',now).some(x=>x.kind==='plan'),false);
 assert.equal(policy.selectDiscoveryItems(user,{...i,rsvps:[{activity_id:plan.id,user_id:user.id,response:'no'}]},'weekend',now).some(x=>x.kind==='plan'),false);
 const people=Array.from({length:3},()=>({id:randomUUID()}));assert.equal(policy.selectDiscoveryItems(user,{...i,users:[...i.users,...people],rsvps:people.map(u=>({activity_id:plan.id,user_id:u.id,response:'yes'}))},'weekend',now).some(x=>x.kind==='plan'),false);
});
test('stale, repeated, cancelled-source, duplicate and past items cannot be recommended',()=>{
 const i=inventory();i.seen.add('plan:'+plan.id);i.seen.add('event:'+event(1).id);i.events=[event(1),{...event(2),sourceCheckedAt:new Date(now-4*86400000).toISOString()},{...event(3),startsAt:new Date(now-1).toISOString()}];
 assert.deepEqual(policy.selectDiscoveryItems(user,i,'weekend',now),[]);
 const linked={...plan,external_event_id:event(1).id};assert.equal(policy.selectDiscoveryItems(user,{...inventory(),plans:[linked]},'weekend',now).some(x=>x.kind==='plan'),false);
 assert.equal(policy.discoveryEditionId('ideas',Date.parse('2026-11-16T05:00:00Z')),policy.discoveryEditionId('ideas',Date.parse('2026-11-22T22:00:00Z')));
 assert.notEqual(policy.discoveryEditionId('ideas',now),policy.discoveryEditionId('weekend',now));
 const sameInstant={...plan,external_event_id:event(1).id,happens_at:'2026-11-21T13:00:00-05:00'};assert.equal(policy.selectDiscoveryItems(user,{...inventory(),plans:[sameInstant]},'weekend',now)[0].kind,'plan');
});
test('signed item links preserve safe destinations and reject arbitrary redirects',()=>{
 const key='synthetic-signing-secret-only-1234567890',base={purpose:'attribution',userId:user.id,deliveryId:randomUUID(),channel:'email',expires:Date.now()+60000};
 const token=signFriendEventToken({...base,planId:plan.id},key);assert.equal(friendEventDestination(verifyFriendEventToken(token,'attribution',Date.now(),key)),'/hub?plan='+plan.id);
 assert.throws(()=>signFriendEventToken({...base,planId:'https://evil.test'},key));assert.throws(()=>signFriendEventToken({...base,planId:plan.id,eventId:event(1).id},key));
 assert.equal(friendEventDestination(null),'/hub?discover=1');assert.equal(friendEventDestination({...base,eventId:event(1).id}),'/hub?discover=1&event='+encodeURIComponent(event(1).id));
});
test('rendered copy distinguishes member plans, outside events, admission and escapes content',async()=>{
 const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const {renderFriendDiscoveryMessage}=await loadTs('lib/friend-discovery-message.ts',{'@/lib/email':{escapeHtml}});
 const items=policy.selectDiscoveryItems(user,inventory(),'weekend',now);items[0].title='<script>bad</script>';
 const email=renderFriendDiscoveryMessage('weekend',items,{item:i=>'https://notcupid.com/hub?'+(i.kind==='plan'?'plan=':'discover=1&event=')+encodeURIComponent(i.id),browse:'https://notcupid.com/hub?discover=1',unsubscribe:'https://notcupid.com/unsubscribe?u='+user.id+'&t=synthetic'});
 assert.doesNotMatch(email.html,/<script>/);assert.match(email.html,/not existing NotCupid group plans/);assert.match(email.text,/Admission is separate/);assert.doesNotMatch(email.text,/picked for you|your interests|people are going/i);assert.equal(email.unsubscribePostUrl,'https://notcupid.com/api/unsubscribe?u='+user.id+'&t=synthetic');
 const noPlans=renderFriendDiscoveryMessage('ideas',items.filter(i=>i.kind==='event'),{item:()=> 'https://notcupid.com/hub?discover=1',browse:'https://notcupid.com/hub?discover=1',unsubscribe:email.unsubscribeUrl});assert.doesNotMatch(noPlans.html,/Member plans you can join/);
});
test('review purpose cannot execute through existing sender even if existing flags were enabled',async()=>{
 let called=false;const result=await executeFrozenFriendCampaign({purpose:'friend_discovery_review',campaign:'friend_events_announcement_discovery_test',expires:Date.now()+60000,version:'test',entries:[]},{approval:async()=>{called=true;return {enabled:true};}});assert.equal(result.attempted,0);assert.equal(called,false);
 const route=readFileSync('app/api/admin/friend-discovery-prepare/route.ts','utf8');assert.doesNotMatch(route,/sendEmail|executeFrozen|SEND_ENABLED|cron/);
});
test('draft API refuses execute/audience/approval overrides and expired preparation credentials',async()=>{
 const old=[process.env.FRIEND_DISCOVERY_PREPARE_TOKEN,process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES];let calls=0;
 try{process.env.FRIEND_DISCOVERY_PREPARE_TOKEN='p'.repeat(40);process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES=new Date(Date.now()+60000).toISOString();const {POST}=await loadTs('app/api/admin/friend-discovery-prepare/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friend-discovery-prepare':{prepareFriendDiscovery:async()=>{calls++;return {sendReady:false,authorizedRecipients:0};}}});
 const req=(b,auth=true)=>new Request('https://example.test/api/admin/friend-discovery-prepare',{method:'POST',headers:auth?{authorization:'Bearer '+'p'.repeat(40)}:{},body:JSON.stringify(b)});
 assert.equal((await POST(req({edition:'ideas'},false))).status,403);for(const extra of [{send:true},{action:'execute'},{recipient:user.id},{approved:true}])assert.equal((await POST(req({edition:'ideas',...extra}))).status,400);
 assert.equal((await POST(req({edition:'ideas'}))).status,200);assert.equal(calls,1);process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES=new Date(Date.now()-1).toISOString();assert.equal((await POST(req({edition:'ideas'}))).status,403);
 }finally{['FRIEND_DISCOVERY_PREPARE_TOKEN','FRIEND_DISCOVERY_PREPARE_EXPIRES'].forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});

test('edition preparation persists immutable draft, retries safely and excludes overlap/repeated inventory',async()=>{
 const {renderFriendDiscoveryMessage:renderPrepared}=await loadTs('lib/friend-discovery-message.ts',{'@/lib/email':{escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}});
 const candidate={...user,name:'Sam Example',friend_opted_in_at:'2026-01-01',email_notifications:true,discovery_metro:'boston'};
 const rows={users:[candidate,host],friend_event_preferences:[{user_id:user.id,email_enabled:true,consent_version:'friend-events-v1'}],friend_event_suppressions:[],friend_activities:[plan],friend_activity_rsvps:[],user_reports:[],friend_trips:[],friend_event_deliveries:[],activity_digest_deliveries:[],friend_announcement_drafts:[]};
 let daily=[],storageError=null,renderedName;const writes=[];
 const db={from(table){let equal={};const q={select:()=>q,eq:(k,v)=>(equal[k]=v,q),order:()=>q,range:async()=>({data:rows[table],error:null}),maybeSingle:async()=>({data:rows[table].find(r=>Object.entries(equal).every(([k,v])=>r[k]===v))||null,error:null}),insert:async row=>{if(storageError)return {error:storageError};writes.push({table,row});rows[table].push(row);return {error:null};}};return q;}};
 const {prepareFriendDiscovery}=await loadTs('lib/friend-discovery-prepare.ts',{
  'node:crypto':{randomUUID,createHash},'@/lib/supabase':{supabaseAdmin:db},'@/lib/admin':{getAdminEmails:()=>['admin@example.test']},'@/lib/quiz-data':{metroOf:()=> 'boston',METRO_CENTERS:{boston:{}}},'@/lib/city-events-server':{cityEvents:async()=>({status:'ready',fetchedAt:new Date(now).toISOString(),events:inventory().events})},'@/lib/supabase-pagination':{fetchAllSupabaseRows:async fn=>{const r=await fn(0,999);if(r.error)throw Error('failed');return r.data;}},'@/lib/daily-activity-digest':{collectDailyActivityCandidates:async()=>daily},'@/lib/campaign-owner-review-adapter':{prepareOwnerReview:async()=>({prepared:true,recipientCount:1,memberMetricsIncluded:false})},'@/lib/email':{signUnsubToken:()=> 'synthetic'},'@/lib/friend-event-campaign':{signFriendEventToken:()=> 'synthetic-signed-token'},'@/lib/friend-event-sender':{friendCampaignHash},'@/lib/friend-discovery-edition':policy,'@/lib/friend-discovery-message':{renderFriendDiscoveryMessage:(_e,items,links,name)=>(renderedName=name,renderPrepared(_e,items,links,name))},
 });
 const first=await prepareFriendDiscovery('weekend',1,now);assert.equal(renderedName,'Sam Example');assert.equal(writes[0].row.manifest.version,'friend-discovery-friday-copy-v2-2026-11-26');assert.equal(first.sendReady,false);assert.equal(first.authorizedRecipients,0);assert.equal(first.candidateRecipients,1);assert.equal(writes.length,1);assert.equal(writes[0].table,'friend_announcement_drafts');assert.equal(writes[0].row.manifest.purpose,'friend_discovery_review');assert.doesNotMatch(JSON.stringify(first.sample),/recipient@example|synthetic-signed-token/);
 assert.match(writes[0].row.manifest.entries[0].email.text,/^Hey Sam,/);
 const again=await prepareFriendDiscovery('weekend',1,now);assert.equal(again.manifestHash,first.manifestHash);assert.equal(writes.length,1);
 const frozen=rows.friend_announcement_drafts[0];const currentVersion=frozen.manifest.version;frozen.manifest.version='old-friday-copy';frozen.manifest_hash=friendCampaignHash(frozen.manifest);await assert.rejects(()=>prepareFriendDiscovery('weekend',1,now),/integrity mismatch/);frozen.manifest.version=currentVersion;frozen.manifest_hash=friendCampaignHash(frozen.manifest);
 daily=[{user:candidate}];const overlap=await prepareFriendDiscovery('weekend',2,now);assert.equal(overlap.prepared,false);assert.equal(overlap.counts.dailyOverlapExcluded,1);daily=[];
 rows.friend_event_deliveries.push({id:'prior',user_id:user.id,campaign_id:first.campaign,channel:'email',status:'accepted',claimed_at:new Date(now-4*86400000).toISOString()});
 const fresh=await prepareFriendDiscovery('weekend',2,now);assert.equal(fresh.sampleItems.some(i=>i.key===first.sampleItems[0].key),false);
 rows.friend_event_deliveries[0].claimed_at=new Date(now-3600000).toISOString();const cooldown=await prepareFriendDiscovery('ideas',1,now);assert.equal(cooldown.prepared,false);assert.equal(cooldown.counts.recentCampaignExcluded,1);
 rows.friend_event_deliveries=[];storageError={code:'failed'};await assert.rejects(()=>prepareFriendDiscovery('ideas',3,now),/storage failed/);storageError=null;assert.equal((await prepareFriendDiscovery('ideas',3,now)).prepared,true);
});

test('approved Friday copy personalizes safely, uses one signed primary CTA and preserves ideas copy',async()=>{
 const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const {renderFriendDiscoveryMessage:render}=await loadTs('lib/friend-discovery-message.ts',{'@/lib/email':{escapeHtml}});
 const key='synthetic-signing-secret-only-1234567890';
 const token=signFriendEventToken({purpose:'attribution',userId:user.id,deliveryId:randomUUID(),channel:'email',expires:Date.now()+60000},key);
 let itemCalls=0;const links={item:()=>{itemCalls++;return 'https://notcupid.com/hub';},browse:'https://notcupid.com/go/friend-events?token='+encodeURIComponent(token),unsubscribe:'https://notcupid.com/unsubscribe?u='+user.id+'&t=synthetic'};
 const events=policy.selectDiscoveryItems(user,{...inventory(),plans:[]},'weekend',now);
 assert.equal(events[0].area,'Public event venue');
 const named=render('weekend',events,links,'  Sam Example  ');
 assert.equal(named.subject,'What’s happening near you this weekend?');
 assert.match(named.text,/^Hey Sam,\n\nCurious what’s happening near you this weekend\? Here are a couple of things worth stepping out for:/);
 assert.match(named.text,/Pick your vibe\. Find a plan nearby or someone to go with\./);
 assert.equal((named.html.match(/See what’s happening on NotCupid →/g)||[]).length,1);
 assert.equal((named.html.match(/https:\/\/notcupid.com\/go\/friend-events/g)||[]).length,1);
 assert.equal(itemCalls,0);assert.match(named.text,/Sat, Nov 21, 1:00 PM ET · Public event venue/);
 assert.equal(friendEventDestination(verifyFriendEventToken(token,'attribution',Date.now(),key)),'/hub?discover=1');
 assert.match(named.text,/An outside event/);assert.doesNotMatch(named.text,/A member-created plan/);
 assert.match(render('weekend',events,links,null).text,/^Hey there,/);
 assert.match(render('weekend',events,links,'  ').html,/>Hey there,</);
 const mixed=render('weekend',policy.selectDiscoveryItems(user,inventory(),'weekend',now),links,'<img src=x>');
 assert.doesNotMatch(mixed.html,/<img/);assert.match(mixed.html,/&lt;img/);assert.match(mixed.text,/A member-created plan/);assert.match(mixed.text,/Back Bay/);
 assert.equal(mixed.from,'NotCupid <match@notcupid.com>');assert.equal(mixed.replyTo,'match@notcupid.com');assert.equal(mixed.unsubscribeUrl,links.unsubscribe);assert.match(mixed.text,/109 California Ave, Quincy, MA 02169/);
 const ideas=render('ideas',events,links,'Sam Example');assert.equal(ideas.subject,'A few ideas for your week in Boston');assert.doesNotMatch(ideas.text,/Hey Sam|Pick your vibe/);
});
