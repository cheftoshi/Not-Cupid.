import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateParticipant,dateRequestEligible,dateVenue,publicDatePerson } from '../lib/date-plan-policy.ts';
import {validatePlanLocation,visiblePlanVenue} from '../lib/plan-location.ts';
import {planChatAllowed,liveConnectionPlans} from '../lib/connection-plans.ts';
const p={id:'date',host_id:'host',guest_id:null,state:'open',mode:'blind',venue:'Private sample venue',genders:['f'],is_test:false,expires_at:'2026-10-01T00:00:00Z',happens_at:null};
const now=Date.parse('2026-09-24');
test('free date requests require adult, realm, requested gender, open state, and a future date',()=>{
 const user={id:'guest',gender:'f',age:25,is_test:false};
 assert.equal(dateRequestEligible(p,user,now),true);
 for(const u of [{...user,age:17},{...user,gender:undefined},{...user,gender:'m'},{...user,is_test:true},{...user,id:'host'}]) assert.equal(dateRequestEligible(p,u,now),false);
 for(const row of [{...p,state:'confirmed'},{...p,state:'cancelled'},{...p,expires_at:'2026-09-20'},{...p,happens_at:'2026-09-20'}])assert.equal(dateRequestEligible(row,user,now),false);
});
test('blind profile projection withholds identity, photo, and bio rather than CSS hiding',()=>{
 const person={id:'private-id',name:'Test Identity',photo_url:'private-photo',bio:'private-bio',age:25,gender:'f',hobbies:['Coffee']};
 const hidden=publicDatePerson(person,true);
 for(const value of ['private-id','Test Identity','private-photo','private-bio'])assert.ok(!JSON.stringify(hidden).includes(value));
 assert.equal(hidden.age,25);assert.equal(hidden.name,'A little mystery');assert.equal(publicDatePerson(person,false).name,'Test');
});
test('date venue and chat reveal only to the host and the accepted guest',()=>{
 assert.equal(dateVenue(p,'guest'),null);assert.equal(dateVenue(p,'host'),p.venue);
 const accepted={...p,state:'confirmed',guest_id:'guest'};
 assert.equal(dateVenue(accepted,'guest'),p.venue);assert.equal(dateVenue(accepted,'other'),null);
 assert.equal(dateParticipant(accepted,'other'),false);
 assert.equal(planChatAllowed({connectionKind:'date',isMine:true,canChat:false}),false);
 assert.equal(planChatAllowed({connectionKind:'date',canChat:true}),true);
});
test('private friendship venues follow active membership, not historical comments or maybe',()=>{
 const venue={venue:'Test meeting place',visibility:'participants'};
 for(const response of [null,'maybe','no'])assert.equal(visiblePlanVenue(venue,null,false,response).location,null);
 assert.equal(visiblePlanVenue(venue,null,false,'yes').location,venue.venue);
 assert.equal(visiblePlanVenue(venue,null,true,null).location,venue.venue);
 assert.equal(visiblePlanVenue({...venue,visibility:'public'},null,false,null).location,venue.venue);
});
test('location validates area, public-place confirmation, visibility and length',()=>{
 const valid={area:'Back Bay',location:'Sample café',visibility:'participants',public_place:true};
 assert.equal(validatePlanLocation(valid,['Back Bay']).location,'Sample café');
 for(const input of [{...valid,area:'Elsewhere'},{...valid,public_place:false},{...valid,visibility:'anything'},{...valid,location:'x'.repeat(121)}])assert.throws(()=>validatePlanLocation(input,['Back Bay']));
 assert.equal(validatePlanLocation({...valid,location:''},['Back Bay']).location,null);
});
test('confirmed and cancelled dates stay out of discovery',()=>{
 const base={kind:'event',created_at:'2026-09-24',expires_at:'2026-10-01'};
 assert.deepEqual(liveConnectionPlans([{...base,id:'open',state:'open'},{...base,id:'closed',state:'confirmed'},{...base,id:'cancelled',state:'cancelled'}],now).map(p=>p.id),['open']);
});
test('date database locks acceptance and preserves sender retry IDs without Love charges',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260925011141_connection_plan_location_privacy.sql',import.meta.url),'utf8');
 assert.match(sql,/for update/);assert.match(sql,/unique\(plan_id,user_id,client_id\)/);assert.match(sql,/state='confirmed'/);assert.match(sql,/from public,anon,authenticated/);
 assert.doesNotMatch(sql,/stripe|love_pick_ledger|paid_entitlements/);
});
