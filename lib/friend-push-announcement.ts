import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { supabaseAdmin as db } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { signFriendEventToken } from '@/lib/friend-event-campaign';
import { isAllowedWebPushEndpoint } from '@/lib/request-security';
// Operator policy is independently tested as native ESM.
import { eligible, execute, hash, campaign, copy } from '../scripts/friend-push-policy.mjs';
async function rows(table:string,select:string) {const all:any[]=[];for(let offset=0;;offset+=500){const {data,error}=await db.from(table).select(select).order(['friend_event_preferences','friend_event_suppressions'].includes(table)?'user_id':'id').range(offset,offset+499);if(error)throw Error('Read failed');all.push(...data);if(data.length<500)return all;}}
async function state(){return {admins:getAdminEmails(),prefs:await rows('friend_event_preferences','user_id,push_enabled'),audit:await rows('friend_event_preference_audit','user_id,channel,enabled'),suppressions:await rows('friend_event_suppressions','user_id,channel'),subscriptions:await rows('push_subscriptions','id,user_id,endpoint,p256dh,auth')};}
async function current(entry:any){const s=await state();const {data,error}=await db.from('users').select('*').eq('id',entry.userId).maybeSingle();return !error&&eligible(data,s);}
export async function preparePush(){
 const existing=await db.from('friend_push_announcement_drafts').select('*').eq('id',campaign).maybeSingle();if(existing.error)throw Error('Draft lookup failed');if(existing.data)return preview(existing.data.manifest);
 const s=await state();if(!s.admins.length||!process.env.VAPID_PRIVATE_KEY||!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)throw Error('Configuration missing');
 const users=await rows('users','id,email,is_test,is_blocked,deleted_at,friend_opted_in_at,notifications_paused_at');
 const expires=Date.now()+3600000;
 const entries=users.filter(u=>eligible(u,s)).sort((a,b)=>a.id.localeCompare(b.id)).map(u=>{
  const deliveryId=randomUUID();const token=signFriendEventToken({purpose:'attribution',userId:u.id,deliveryId,channel:'push',expires:Date.now()+7*86400000});
  const devices=s.subscriptions.filter(d=>d.user_id===u.id).map(d=>({id:d.id,fingerprint:hash([d.endpoint,d.p256dh,d.auth])})).sort((a,b)=>a.id.localeCompare(b.id));
  if(s.subscriptions.some(d=>d.user_id===u.id&&!isAllowedWebPushEndpoint(d.endpoint)))throw Error('Unexpected provider endpoint');
  return {userId:u.id,deliveryId,devices,payload:{...copy,url:`https://notcupid.com/go/friend-events?token=${token}`}};
 });
 if(!entries.length)throw Error('No eligible members');
 const manifest={campaign,expires,entries};const {error}=await db.from('friend_push_announcement_drafts').insert({id:campaign,manifest_hash:hash(manifest),manifest,expires_at:new Date(expires).toISOString()});if(error)throw Error('Freeze failed');return preview(manifest);
}
function preview(m:any){return {campaign:m.campaign,manifestHash:hash(m),expires:new Date(m.expires).toISOString(),members:m.entries.length,devices:m.entries.reduce((n:number,e:any)=>n+e.devices.length,0),copy:{title:m.entries[0].payload.title,body:m.entries[0].payload.body,tag:m.entries[0].payload.tag},destination:'https://notcupid.com/hub?discover=1',tracking:'signed per-member push link; provider acceptance is not display'};}
export async function executePush(expectedHash:string){
 const {data:row,error}=await db.from('friend_push_announcement_drafts').select('*').eq('id',campaign).maybeSingle();if(error||!row||row.manifest_hash!==expectedHash||hash(row.manifest)!==expectedHash)throw Error('Frozen draft mismatch');
 const approved=async(h:string,n:number)=>{if(process.env.FRIEND_PUSH_ANNOUNCEMENT_SEND_ENABLED!=='true')return false;const {data:c,error}=await db.from('friend_event_campaigns').select('*').eq('id',campaign).maybeSingle();return !error&&c?.send_enabled&&c.manifest_hash===h&&c.recipient_count===n&&c.content_version==='friend-push-announcement-v1'&&c.audience_policy==='friend_line_announcement'&&Date.parse(c.approved_at)<=Date.now()&&Date.parse(c.expires_at)>Date.now()&&Date.parse(c.provider_permission_reviewed_at)<=Date.now()&&c.provider_permission_basis?.length>=20;};
 if(!await approved(expectedHash,row.manifest.entries.length))throw Error('Not approved');
 const lock=await db.from('friend_push_announcement_drafts').update({started_at:new Date().toISOString()}).eq('id',campaign).is('started_at',null).select('id');if(lock.error||lock.data?.length!==1)throw Error('Already attempted; reconcile before retry');
 webpush.setVapidDetails('mailto:match@notcupid.com',process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 let result:any;
 try{result=await execute(row.manifest,{
  approved,eligible:current,
  claim:async(e:any)=>{const r=await db.rpc('claim_friend_push_announcement',{p_user:e.userId,p_campaign:campaign,p_admin_emails:getAdminEmails(),p_delivery:e.deliveryId,p_manifest_hash:expectedHash});if(r.error)throw Error('Claim error');return r.data===e.deliveryId;},
  deviceCurrent:async(e:any,d:any)=>{const r=await db.from('push_subscriptions').select('*').eq('id',d.id).eq('user_id',e.userId).maybeSingle();if(r.error)throw Error('Device lookup error');return !!r.data&&hash([r.data.endpoint,r.data.p256dh,r.data.auth])===d.fingerprint;},
  send:async(e:any,d:any)=>{if(!await approved(expectedHash,row.manifest.entries.length)||!await current(e))throw Error('Changed');const r=await db.from('push_subscriptions').select('*').eq('id',d.id).eq('user_id',e.userId).maybeSingle();if(r.error||!r.data||!isAllowedWebPushEndpoint(r.data.endpoint)||hash([r.data.endpoint,r.data.p256dh,r.data.auth])!==d.fingerprint)throw Error('Device changed');try{await webpush.sendNotification({endpoint:r.data.endpoint,keys:{p256dh:r.data.p256dh,auth:r.data.auth}},JSON.stringify(e.payload),{TTL:86400,timeout:10000});return true;}catch(err:any){if([400,401,403,404,410,413].includes(err?.statusCode))return false;throw Error('Unknown provider outcome');}},
  receipt:async(e:any,d:any,outcome:string)=>{const r=await db.from('friend_push_announcement_receipts').insert({delivery_id:e.deliveryId,device_id:d.id,outcome});if(r.error)throw Error('Receipt failed');},
  finish:async(e:any,accepted:boolean)=>{const r=await db.from('friend_event_deliveries').update({status:accepted?'accepted':'failed',...(accepted?{accepted_at:new Date().toISOString()}:{})}).eq('id',e.deliveryId).eq('status','claimed');if(r.error)throw Error('Receipt failed');}
 });}catch(error:any){result={...error?.partial,stopped:'uncertain_or_changed_reconcile_no_retry'};}
 const finish=await db.from('friend_push_announcement_drafts').update({result}).eq('id',campaign);const disabled=await db.from('friend_event_campaigns').update({send_enabled:false}).eq('id',campaign);
 return {...result,ledgerRecorded:!finish.error,sendDisabled:!disabled.error};
}
