import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { Resend } from 'resend';
import { checkFriendEventSuppression } from '@/lib/friend-event-suppression';

// Read-only diagnostics. No sender imports, writes, consent changes or activation.
export async function collectFriendAnnouncementAudience() {
 const at=new Date().toISOString();const admins=getAdminEmails();
 if(!admins.length) return {at,complete:false,blocked:'admin_configuration_unavailable'};
 async function all(table:string,fields:string,order='id') {
  const rows:any[]=[];
  for(let page=0;page<100;page++) {
   const {data,error}=await supabaseAdmin.from(table).select(fields).order(order).range(page*500,page*500+499);
   if(error) throw new Error('Audience lookup unavailable');rows.push(...data);if(data.length<500)return rows;
  }
  throw new Error('Audience pagination limit');
 }
 const users=await all('users','id,email,is_test,is_blocked,deleted_at,friend_opted_in_at,email_notifications,notifications_paused_at');
 const prefs=await all('friend_event_preferences','user_id,email_enabled','user_id');
 const disabled=new Set(prefs.filter(p=>p.email_enabled===false).map(p=>p.user_id));
 const audit=await all('friend_event_preference_audit','id,user_id,channel,enabled');
 const topicOptouts=new Set(audit.filter(a=>a.channel==='email'&&a.enabled===false&&disabled.has(a.user_id)).map(a=>a.user_id));
 const suppressionRows=await all('friend_event_suppressions','user_id,channel','user_id');
 const suppressed=new Set(suppressionRows.filter(s=>s.channel==='email').map(s=>s.user_id));
 const deliveryRows=await all('friend_event_deliveries','id,user_id,channel,claimed_at');
 const recentIds=new Set(deliveryRows.filter(r=>r.channel==='email'&&Date.parse(r.claimed_at)>Date.now()-7*86400000).map(r=>r.user_id));
 const friend=users.filter(u=>u.friend_opted_in_at&&!u.is_test&&!u.is_blocked&&!u.deleted_at&&!admins.includes((u.email||'').trim().toLowerCase()));
 const preferencePass=friend.filter(u=>u.email_notifications===true&&!u.notifications_paused_at&&typeof u.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email));
 const candidates=preferencePass.filter(u=>!topicOptouts.has(u.id)&&!suppressed.has(u.id)&&!recentIds.has(u.id));
 const counts={friendMembers:friend.length,emailPreferencePass:preferencePass.length,existingPreferenceExcluded:friend.length-preferencePass.length,topicOptOutExcluded:preferencePass.filter(u=>topicOptouts.has(u.id)).length,localSuppressionExcluded:preferencePass.filter(u=>suppressed.has(u.id)).length,recentDeliveryExcluded:preferencePass.filter(u=>recentIds.has(u.id)).length,beforeProvider:candidates.length};
 if(!process.env.RESEND_API_KEY)return {at,counts,complete:false,blocked:'provider_not_configured'};
 const provider=new Resend(process.env.RESEND_API_KEY);
 const domain=await provider.domains.list();
 if(domain.error) return {at,counts,complete:false,blocked:'provider_account_check_failed',providerErrorName:domain.error.name,providerStatusCode:domain.error.statusCode};
 const sendingDomainVerified=!!domain.data?.data?.some(d=>d.name==='notcupid.com'&&d.status==='verified');
 if(!sendingDomainVerified)return {at,counts,complete:false,blocked:'sending_domain_not_verified'};
 const clear:any[]=[];let providerExcluded=0;
 for(const u of candidates) {
  // Provider default budget is conservative; never retry failures blindly.
  await new Promise(resolve=>setTimeout(resolve,600));
  let errorName:string|undefined,statusCode:number|null|undefined;
  const status=await checkFriendEventSuppression(u.email,async email=>{const result=await provider.suppressions.get(email);errorName=result.error?.name;statusCode=result.error?.statusCode;return result;});
  if(status==='unknown')return {at,counts,complete:false,blocked:'provider_suppression_check_unavailable',checked:clear.length+providerExcluded,sendingDomainVerified,providerErrorName:errorName,providerStatusCode:statusCode};
  if(status==='clear')clear.push(u);else providerExcluded++;
 }
 const audienceHash=createHash('sha256').update(JSON.stringify(clear.map(u=>[u.id,u.email]).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
 return {recipients:clear.map(u=>({userId:u.id,email:u.email})),at,counts,complete:true,sendReady:false,finalTechnicalCount:clear.length,providerExcluded,sendingDomainVerified,audienceHash,
  remainingGates:['One-time communication/provider permission review','Exact rendered content, footer, links, audience/count approval','Separate execution approval'],
  flags:{announcementSending:process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED==='true',recurringSending:process.env.FRIEND_EVENT_SEND_ENABLED==='true'}};
}

// Public diagnostic deliberately strips all identifiers and recipient addresses.
export async function friendAnnouncementPreflight() {
 const result=await collectFriendAnnouncementAudience();
 const {recipients:_privateRecipients,...summary}=result as typeof result & {recipients?:unknown};
 return summary;
}
