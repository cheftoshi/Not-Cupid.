import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptDate, canChat, dateEligible, locationFor, newLocationDraft, people, saveLocation, seedInvitations, visibleTo } from '../design-previews/connection-home/model.ts';
const date = () => seedInvitations().find(p=>p.id==='blind-date');
test('date preview requires reciprocal gender preferences and adult profiles',()=>{
  assert.equal(dateEligible(date(),people.jamie),true);
  assert.equal(dateEligible(date(),people.noah),false);
  assert.equal(dateEligible(date(),{...people.jamie,seeks:['Woman']}),false);
  assert.equal(dateEligible(date(),{...people.jamie,gender:'Man'}),false);
  assert.equal(dateEligible(date(),{...people.jamie,age:17}),false);
});
test('requesting a date does not grant guest or host a private chat',()=>{
  const pending={...date(),requests:[{user:'jamie',status:'pending'}]};
  assert.equal(canChat(pending,'jamie'),false);
  assert.equal(canChat(pending,'noah'),false);
});
test('only host can accept a pending eligible guest',()=>{
  const pending={...date(),requests:[{user:'jamie',status:'pending'}]};
  assert.equal(acceptDate(pending,'taylor','jamie'),pending);
  assert.equal(acceptDate(pending,'noah','taylor'),pending);
  assert.equal(acceptDate({...pending,requests:[{user:'jamie',status:'passed'}]},'noah','jamie').confirmed,undefined);
});
test('acceptance creates exactly two participants and closes other requests',()=>{
  const pending={...date(),requests:[{user:'jamie',status:'pending'},{user:'taylor',status:'pending'}]};
  const confirmed=acceptDate(pending,'noah','jamie');
  assert.equal(confirmed.capacity,2);
  assert.deepEqual(confirmed.members,['noah','jamie']);
  assert.equal(confirmed.requests.find(r=>r.user==='taylor').status,'passed');
  assert.equal(acceptDate(confirmed,'noah','taylor'),confirmed);
  assert.equal(canChat(confirmed,'jamie'),true);
  assert.equal(canChat(confirmed,'noah'),true);
  assert.equal(canChat(confirmed,'taylor'),false);
  assert.equal(visibleTo(confirmed,'taylor'),false);
  assert.equal(visibleTo(confirmed,'jamie'),true);
});
test('friendship chat requires membership but does not use dating preferences',()=>{
  const plan=seedInvitations().find(p=>p.id==='lunch');
  assert.equal(canChat(plan,'jamie'),true);
  assert.equal(canChat(plan,'noah'),false);
});
test('location requires a neighborhood and public venue confirmation',()=>{
  assert.throws(()=>saveLocation({...newLocationDraft(),neighborhood:''},'friends'),/neighborhood/);
  assert.throws(()=>saveLocation({...newLocationDraft(),neighborhood:'Unrecognized area'},'friends'),/neighborhood/);
  assert.throws(()=>saveLocation({...newLocationDraft(),choice:'venue',venue:'  '},'friends'),/public meeting place/);
  assert.throws(()=>saveLocation({...newLocationDraft(),choice:'venue',venue:'Sample café'},'friends'),/Confirm/);
  const saved=saveLocation({...newLocationDraft(),choice:'venue',venue:' Sample café ',publicPlace:true,visibility:'public'},'friends');
  assert.deepEqual(saved,{neighborhood:'Back Bay',venue:'Sample café',visibility:'public'});
});
test('decide together clears any stale venue; date locations cannot be public',()=>{
  assert.equal(saveLocation({...newLocationDraft(),venue:'Old place'},'friends').venue,null);
  const saved=saveLocation({...newLocationDraft(),choice:'venue',venue:'Sample café',publicPlace:true,visibility:'public'},'date');
  assert.equal(saved.visibility,'participants');
});
test('pending date guests see neighborhood only, including with a public flag',()=>{
  const plan=seedInvitations().find(p=>p.id==='coffee-date');
  const pending={...plan,location:{...plan.location,visibility:'public'},requests:[{user:'jamie',status:'pending'}]};
  assert.deepEqual(locationFor(pending,'jamie'),{neighborhood:'Back Bay',venue:null,status:'hidden'});
  assert.equal(locationFor(pending,'noah').venue,plan.location.venue);
  const confirmed=acceptDate(pending,'noah','jamie');
  assert.equal(locationFor(confirmed,'jamie').venue,plan.location.venue);
  assert.equal(locationFor(confirmed,'taylor').venue,null);
});
test('friend venue follows visibility, membership, and withdrawal',()=>{
  const privatePlan=seedInvitations().find(p=>p.id==='lunch');
  assert.equal(locationFor(privatePlan,'jamie').venue,privatePlan.location.venue);
  assert.equal(locationFor(privatePlan,'noah').venue,null);
  const withdrawn={...privatePlan,members:privatePlan.members.filter(id=>id!=='jamie')};
  assert.equal(locationFor(withdrawn,'jamie').venue,null);
  const publicPlan=seedInvitations().find(p=>p.id==='walk');
  assert.equal(locationFor(publicPlan,'noah').venue,publicPlan.location.venue);
});
test('no selected venue is honestly labeled decide together',()=>{
  assert.deepEqual(locationFor(date(),'jamie'),{neighborhood:'Beacon Hill',venue:null,status:'decide'});
});
