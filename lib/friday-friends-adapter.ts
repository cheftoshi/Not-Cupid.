import { Resend } from 'resend';
import { supabaseAdmin as db } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { friendCampaignHash } from '@/lib/friend-event-sender';
import { recordFriendEventProviderEvent } from '@/lib/friend-event-provider';
import { checkFriendEventSuppression } from '@/lib/friend-event-suppression';
import { ownerReviewEmail, ownerReviewHash, validOwnerReview } from '@/lib/campaign-owner-review';
import { neutralFriendDiscoveryReview } from '@/lib/friend-discovery-privacy';
import { currentFridayEntry } from '@/lib/friday-friends-current';
import { FRIDAY_FRIENDS_VERSION, isFridaySendWindow } from '@/lib/friday-friends-policy';
import { executeFridayFriends, type FridayManifest, type FridayEntry } from '@/lib/friday-friends-executor';
export async function runFridayFriends(campaign:string, expectedHash:string, deadline:number) {
 const enabled=()=>process.env.FRIDAY_FRIENDS_SEND_VERSION===FRIDAY_FRIENDS_VERSION&&Number.isFinite(deadline)&&Date.now()<deadline;
 if(!enabled()||!process.env.RESEND_API_KEY)return {attempted:0,accepted:0,stopped:'disabled'};
 const provider=new Resend(process.env.RESEND_API_KEY);
 const {data:row,error}=await db.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
 if(error||!row||row.manifest_hash!==expectedHash||friendCampaignHash(row.manifest)!==expectedHash||row.recipient_count!==row.manifest.entries?.length||Date.parse(row.expires_at)!==row.manifest.expires)return {attempted:0,accepted:0,stopped:'frozen_draft_unavailable'};
 const manifest=row.manifest as FridayManifest;
 const suppression=async(email:string)=>{
  await new Promise(resolve=>setTimeout(resolve,700));
  return await checkFriendEventSuppression(email,address=>provider.suppressions.get(address))==='clear';
 };
 const approved=async(m:FridayManifest,hash:string)=>{
  if(!enabled()||!isFridaySendWindow(m.fridayDay)||m.expires<=Date.now())return false;
  const [{data:c,error:ce},{data:o,error:oe}]=await Promise.all([db.from('friend_event_campaigns').select('*').eq('id',campaign).maybeSingle(),db.from('campaign_owner_reviews').select('*').eq('source_campaign',campaign).maybeSingle()]);
  const now=Date.now(),date=(v:string)=>Date.parse(v||'');
  if(ce||oe||!c||!o||!c.send_enabled||c.audience_policy!=='weekly_discovery'||c.content_version!==FRIDAY_FRIENDS_VERSION||c.manifest_hash!==hash||c.recipient_count!==m.entries.length||!(date(c.approved_at)<=now)||!(date(c.content_approved_at)>0)||!(date(c.send_approved_at)>date(c.content_approved_at))||!(date(c.send_approved_at)<=now)||!(date(c.expires_at)>now)||!(date(c.provider_permission_reviewed_at)<=now)||(c.provider_permission_basis||'').trim().length<20)return false;
  // An accepted test alone is not a visual/content approval. The operator must
  // explicitly verify this exact owner hash after its receipt, then approve sends.
  if(!validOwnerReview(o.manifest)||ownerReviewHash(o.manifest)!==o.manifest_hash||o.manifest.sourceHash!==hash||o.manifest.sourceCampaign!==campaign||o.manifest.userId!==o.user_id||o.manifest_hash!==c.friday_owner_review_hash||!o.provider_id||!(date(o.accepted_at)>0)||!(date(o.accepted_at)<=now)||!(date(c.friday_owner_test_verified_at)>=date(o.accepted_at))||!(date(c.friday_owner_test_verified_at)<=date(c.content_approved_at))||!(date(c.friday_owner_test_verified_at)<=now))return false;
  const neutral=neutralFriendDiscoveryReview(o.manifest.email);
  if(neutral.text!==o.manifest.email.text||neutral.html!==o.manifest.email.html)return false;
  const email=ownerReviewEmail(),admins=getAdminEmails();if(!email||!admins.includes(email))return false;
  const {data:owner,error:ue}=await db.from('users').select('*').eq('id',o.user_id).maybeSingle();
  if(ue||!owner||owner.email!==email||owner.is_test||owner.is_blocked||owner.deleted_at||!owner.friend_opted_in_at||owner.email_notifications!==true||owner.notifications_paused_at)return false;
  const [{data:local,error:le},{data:p,error:pe}]=await Promise.all([db.from('friend_event_suppressions').select('reason').eq('user_id',o.user_id).eq('channel','email').maybeSingle(),db.from('friend_event_preferences').select('email_enabled').eq('user_id',o.user_id).maybeSingle()]);
  if(le||pe||local)return false;
  if(p?.email_enabled===false){const {data:a,error:ae}=await db.from('friend_event_preference_audit').select('id').eq('user_id',o.user_id).eq('channel','email').eq('enabled',false).limit(1);if(ae||a?.length)return false;}
  if(!await suppression(email))return false;
  await new Promise(resolve=>setTimeout(resolve,700));
  const delivery=await provider.emails.get(o.provider_id);
  return !delivery.error&&delivery.data?.id===o.provider_id&&['delivered','opened','clicked'].includes(delivery.data.last_event)&&enabled()&&isFridaySendWindow(m.fridayDay);
 };
 const validate=async(e:FridayEntry)=>await currentFridayEntry(e,campaign)&&!!e.email&&await suppression(e.email.to);
 return executeFridayFriends(manifest,expectedHash,{
  now:Date.now,approved,validEntry:validate,pace:async()=>{},
  state:async e=>{const {data:d,error:de}=await db.from('friend_event_deliveries').select('campaign_id,user_id,channel,status,provider_id').eq('id',e.deliveryId).maybeSingle();if(de)throw Error('Receipt unavailable');if(!d)return 'new';return d.campaign_id===campaign&&d.user_id===e.userId&&d.channel==='email'&&['accepted','delivered'].includes(d.status)&&d.provider_id?'accepted':'uncertain';},
  claim:async(e,m,hash)=>{const {data,error:ce}=await db.rpc('claim_friday_friend_delivery',{p_user:e.userId,p_campaign:m.campaign,p_admin_emails:getAdminEmails(),p_delivery:e.deliveryId,p_manifest_hash:hash});if(ce)throw Error('Friday claim unavailable');return data===e.deliveryId;},
  submit:async(e,m)=>{
   // Recheck after claiming and after any provider pacing. No other worker can
   // submit this claim; a crash here retains it for reconciliation.
   if(!await validate(e)||!await approved(m,expectedHash)||!enabled()||!isFridaySendWindow(m.fridayDay)||m.expires<=Date.now())throw Error('Changed after claim');
   const mail=e.email!;
   const {data,error:se}=await provider.emails.send({from:mail.from,to:mail.to,replyTo:mail.replyTo,subject:mail.subject,html:mail.html,text:mail.text,headers:{'List-Unsubscribe':`<${mail.unsubscribePostUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'campaign',value:campaign},{name:'friend_event_delivery_id',value:e.deliveryId}]},{idempotencyKey:`friend-events:${e.deliveryId}`});
   if(se||!data?.id)throw Error('Unknown provider outcome');return data.id;
  },
  receipt:async(e,id)=>{const ok=await recordFriendEventProviderEvent({type:'email.sent',created_at:new Date().toISOString(),data:{email_id:id,tags:{campaign,friend_event_delivery_id:e.deliveryId}}},`submission:${e.deliveryId}`);if(!ok)throw Error('Receipt reconciliation required');}
 });
}
