import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {loadTs} from './helpers/load-ts.mjs';
import {signUnsubToken,verifyUnsubToken} from '../lib/email.ts';
import {signFriendEventToken,verifyFriendEventToken} from '../lib/friend-event-campaign.ts';
import {renderFriendAnnouncementMessage,FRIEND_ANNOUNCEMENT_BODY} from '../lib/friend-announcement-message.ts';
import {friendCampaignHash} from '../lib/friend-event-sender.ts';
const {freezeFriendAnnouncement}=await loadTs('lib/friend-announcement-freeze.ts',{'node:crypto':{randomUUID},'./friend-announcement-message':{renderFriendAnnouncementMessage},'./email':{signUnsubToken},'./friend-event-campaign':{signFriendEventToken}});
const key='synthetic-attribution-signing-key-only-12345';const now=Date.now();
const user='10000000-0000-0000-0000-000000000001',delivery='20000000-0000-0000-0000-000000000001';
const input=()=>({campaign:'friend_events_announcement_synthetic',version:'copy-v1',expires:now+60000,recipients:[{userId:user,email:'synthetic@example.test',deliveryId:delivery}]});
const deps={now,signAttribution:p=>signFriendEventToken(p,key),signUnsubscribe:(id,expires)=>signUnsubToken(id,expires)};

test('freeze signs personalized attribution and existing global unsubscribe without sending',()=>{
 const previous=process.env.MATCH_LINK_SECRET;process.env.MATCH_LINK_SECRET='synthetic-global-unsubscribe-key-only';
 try{
 const m=freezeFriendAnnouncement(input(),deps);assert.equal(m.purpose,'friend_line_announcement');assert.equal(m.entries.length,1);const e=m.entries[0];assert.equal(e.channel,'email');assert.equal(e.email.subject,'Got plans this weekend?');assert.equal(e.email.to,'synthetic@example.test');
 const cta=new URL(e.email.text.match(/https:\/\/notcupid\.com\/go\/friend-events\?token=\S+/)[0]);
 assert.deepEqual(verifyFriendEventToken(cta.searchParams.get('token'),'attribution',now,key),{purpose:'attribution',userId:user,deliveryId:delivery,channel:'email',expires:m.expires+30*86400000});
 assert(verifyFriendEventToken(cta.searchParams.get('token'),'attribution',m.expires+86400000,key),'CTA survives send window');
 const unsub=new URL(e.email.unsubscribeUrl);assert.equal(unsub.pathname,'/unsubscribe');assert.equal(unsub.searchParams.get('u'),user);assert(verifyUnsubToken(user,unsub.searchParams.get('t')));assert(!verifyUnsubToken(randomUUID(),unsub.searchParams.get('t')));
 const post=new URL(e.email.unsubscribePostUrl);assert.equal(post.pathname,'/api/unsubscribe');assert.equal(post.search,unsub.search);
 assert.equal(e.email.html.split('<hr>')[0].replace(/<[^>]*>/g,'\n').split('\n').filter(Boolean).join('\n\n'),FRIEND_ANNOUNCEMENT_BODY);
 const route=readFileSync(new URL('../app/go/friend-events/route.ts',import.meta.url),'utf8');assert.match(route,/new URL\('\/hub\?discover=1', req.url\)/);
 }finally{if(previous===undefined)delete process.env.MATCH_LINK_SECRET;else process.env.MATCH_LINK_SECRET=previous;}
});
test('injected IDs and signers produce deterministic deeply frozen manifest detached from caller',()=>{
 const source=input();const fake={now,signAttribution:()=> 'fake-attribution',signUnsubscribe:()=> 'fake-unsubscribe'};
 const a=freezeFriendAnnouncement(source,fake),b=freezeFriendAnnouncement(source,fake);assert.equal(friendCampaignHash(a),friendCampaignHash(b));
 source.recipients[0].email='changed@example.test';assert.equal(a.entries[0].email.to,'synthetic@example.test');
 assert(Object.isFrozen(a));assert(Object.isFrozen(a.entries));assert(Object.isFrozen(a.entries[0]));assert(Object.isFrozen(a.entries[0].email));assert.throws(()=>{a.entries[0].email.subject='Changed';});
 const generated=freezeFriendAnnouncement({...input(),recipients:[{userId:user,email:'synthetic@example.test'}]},{...fake,newDeliveryId:()=>delivery});assert.equal(friendCampaignHash(generated),friendCampaignHash(a));
});
test('invalid or duplicate recipients, identifiers and timing are rejected before signing',()=>{
 let signed=0;const fake={now,signAttribution:()=>{signed++;return 'fake';},signUnsubscribe:()=>{signed++;return 'fake';}};
 const cases=[{campaign:'friend_events_weekly'},{version:''},{expires:now},{linkExpires:now},{unsubscribeExpires:now},{recipients:[]},
 {recipients:[{userId:'invalid',email:'synthetic@example.test',deliveryId:delivery}]},
 {recipients:[{userId:user,email:'synthetic@example.test',deliveryId:'invalid'}]},
 {recipients:[{userId:user,email:'bad\r\n@example.test',deliveryId:delivery}]},
 {recipients:[input().recipients[0],{userId:user,email:'other@example.test',deliveryId:randomUUID()}]},
 {recipients:[input().recipients[0],{userId:randomUUID(),email:'SYNTHETIC@example.test',deliveryId:randomUUID()}]},
 {recipients:[input().recipients[0],{userId:randomUUID(),email:'other@example.test',deliveryId:delivery}]}];
 for(const patch of cases)assert.throws(()=>freezeFriendAnnouncement({...input(),...patch},fake));assert.equal(signed,0);
});
