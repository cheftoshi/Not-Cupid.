import {createHash} from 'node:crypto';
export const campaign='friend_events_push_announcement_20261113_weekend_v1';
export const copy={title:'Got plans this weekend?',body:'Boston events are now in Friend. Find something you like and people to go with.',tag:campaign};
/** @param {any} user @param {{admins:string[],prefs?:any[],audit?:any[],suppressions?:any[],subscriptions?:any[]}} state */
export function eligible(user,{admins,prefs=[],audit=[],suppressions=[],subscriptions=[]}) {
 if(!admins?.length||!user||user.is_test||user.is_blocked||user.deleted_at||!user.friend_opted_in_at||user.notifications_paused_at||admins.includes((user.email||'').trim().toLowerCase()))return false;
 if(suppressions.some(s=>s.user_id===user.id&&s.channel==='push'))return false;
 const p=prefs.find(p=>p.user_id===user.id);
 if(p?.push_enabled===false&&audit.some(a=>a.user_id===user.id&&a.channel==='push'&&a.enabled===false))return false;
 return subscriptions.some(s=>s.user_id===user.id);
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export function hash(value){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export async function execute(manifest,deps){
 if(!manifest.entries.length||manifest.expires<=Date.now()||!await deps.approved(hash(manifest),manifest.entries.length))throw Error('approval unavailable');
 const result={membersAccepted:0,devicesAccepted:0,devicesRejected:0,unknown:0};
 for(const entry of manifest.entries){
  if(!await deps.approved(hash(manifest),manifest.entries.length)||!await deps.eligible(entry))throw Error('eligibility or approval changed');
  if(!await deps.claim(entry))throw Error('claim unavailable; do not retry');
  let accepted=false;
  for(const device of entry.devices){
   // A removed/re-homed subscription or newly recorded opt-out prevents send.
   if(!await deps.eligible(entry)||!await deps.deviceCurrent(entry,device))continue;
   let receipt;try{receipt=await deps.send(entry,device);}catch{result.unknown++;await deps.receipt(entry,device,'unknown');throw Object.assign(Error('uncertain outcome; reconcile, do not retry'),{partial:result});}
   if(receipt){result.devicesAccepted++;if(!accepted){accepted=true;result.membersAccepted++;await deps.finish(entry,true);}}else result.devicesRejected++;
   await deps.receipt(entry,device,receipt?'accepted':'rejected');
  }
  if(!accepted)await deps.finish(entry,false);
 }
 return result;
}
