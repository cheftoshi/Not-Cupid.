import { friendCampaignHash, type FrozenFriendDelivery } from '@/lib/friend-event-sender';
import { FRIDAY_FRIENDS_VERSION, isFridaySendWindow, FRIDAY_PILOT_MAX_RECIPIENTS, FRIDAY_RUNTIME_BUDGET_MS, FRIDAY_IO_TIMEOUT_MS, FRIDAY_CLAIM_RESERVE_MS } from '@/lib/friday-friends-policy';
import type { DiscoveryItem } from '@/lib/friend-discovery-edition';
export type FridayEntry = FrozenFriendDelivery & {recommendations: DiscoveryItem[]};
export type FridayManifest = {purpose:'friend_discovery_review'; campaign:string; version:string; edition:'weekend'; cadence:'once-weekly'; fridayDay:string; windowStart:number; windowEnd:number; expires:number; preparedAt:string; entries:FridayEntry[]};
export type FridayDependencies = {
 now():number;
 deadline?:number;
 approved(m:FridayManifest, hash:string):Promise<boolean>;
 validEntry(e:FridayEntry):Promise<boolean>;
 state(e:FridayEntry):Promise<'new'|'accepted'|'uncertain'>;
 claim(e:FridayEntry, m:FridayManifest, hash:string):Promise<boolean>;
 submit(e:FridayEntry,m:FridayManifest):Promise<string>;
 receipt(e:FridayEntry,providerId:string):Promise<void>;
 pace():Promise<void>;
};
// Timeouts never retry. A late claim/receipt may still settle; retain its ledger.
// Do not wrap the entire submit adapter: it bounds its individual checks/send so
// a timed-out pre-send check cannot continue later into provider submission.
export async function boundedFridayIO<T>(work:()=>Promise<T>):Promise<T> {
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Friday I/O timeout')),FRIDAY_IO_TIMEOUT_MS);})]);}
 finally {if(timer!==undefined)clearTimeout(timer);}
}
// This separate worker never changes a review manifest's purpose or uses the
// announcement audience. No retries of claimed/failed/unknown outcomes, even
// with a new scheduler invocation. Accepted receipts can be skipped on resume.
export async function executeFridayFriends(input:FridayManifest, expectedHash:string, deps:FridayDependencies) {
 const m=structuredClone(input), hash=friendCampaignHash(m);
 const result={attempted:0,accepted:0,alreadyAccepted:0,stopped:''};
 const open=()=>m.expires>deps.now()&&isFridaySendWindow(m.fridayDay,deps.now())&&deps.now()>=m.windowStart&&deps.now()<m.windowEnd;
 const deadline=Math.min(deps.deadline??Infinity,deps.now()+FRIDAY_RUNTIME_BUDGET_MS,m.expires,m.windowEnd);
 const ids=new Set(),people=new Set();
 if(hash!==expectedHash||m.purpose!=='friend_discovery_review'||m.version!==FRIDAY_FRIENDS_VERSION||m.edition!=='weekend'||m.cadence!=='once-weekly'||!/^friend_events_announcement_discovery_\d{8}_weekend_friday_r\d{1,2}$/.test(m.campaign)||!Array.isArray(m.entries)||!m.entries.length||m.expires!==m.windowEnd||m.windowEnd-m.windowStart!==900000||!m.entries.every(e=>{if(e.channel!=='email'||!e.email||e.push||ids.has(e.deliveryId)||people.has(e.userId)||!e.recommendations?.length)return false;ids.add(e.deliveryId);people.add(e.userId);return true;}))return {...result,stopped:'invalid_frozen_friday'};
 if(m.entries.length>FRIDAY_PILOT_MAX_RECIPIENTS)return {...result,stopped:'pilot_size_exceeded'};
 try {
  if(!open())return {...result,stopped:'outside_friday_window'};
  if(!await boundedFridayIO(()=>deps.approved(m,hash)))return {...result,stopped:'approval_or_owner_test_required'};
  // Preflight the complete remaining audience. No silent recipient substitution.
  for(const e of m.entries){const state=await boundedFridayIO(()=>deps.state(e));if(state==='uncertain')return {...result,stopped:'reconcile_claim_before_retry'};if(state==='new'&&!await boundedFridayIO(()=>deps.validEntry(e)))return {...result,stopped:'audience_or_inventory_changed'};}
  for(const e of m.entries){
   const state=await boundedFridayIO(()=>deps.state(e));
   if(state==='accepted'){result.alreadyAccepted++;continue;}
   if(state!=='new')return {...result,stopped:'reconcile_claim_before_retry'};
   await boundedFridayIO(()=>deps.pace());
   if(!open()||!await boundedFridayIO(()=>deps.approved(m,hash)))return {...result,stopped:'window_or_approval_changed'};
   if(!await boundedFridayIO(()=>deps.validEntry(e)))return {...result,stopped:'audience_or_inventory_changed'};
   if(!open())return {...result,stopped:'outside_friday_window'};
   if(!Number.isFinite(deadline)||deadline-deps.now()<FRIDAY_CLAIM_RESERVE_MS)return {...result,stopped:'insufficient_runtime_before_claim'};
   if(!await boundedFridayIO(()=>deps.claim(e,m,hash)))return {...result,stopped:'claim_unavailable'};
   // Losing time or approval after claiming is conservative: retain the claim.
   if(!open()||deps.now()>=deadline||!await boundedFridayIO(()=>deps.approved(m,hash)))return {...result,stopped:'changed_after_claim_reconcile'};
   if(deps.now()>=deadline)return {...result,stopped:'changed_after_claim_reconcile'};
   result.attempted++;
   const providerId=await deps.submit(e,m);
   if(!providerId)return {...result,stopped:'uncertain_provider_outcome'};
   await boundedFridayIO(()=>deps.receipt(e,providerId));
   result.accepted++;
  }
  return {...result,stopped:'complete'};
 }catch{return {...result,stopped:'uncertain_outcome_reconcile_before_retry'};}
}
