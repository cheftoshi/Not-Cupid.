import { supabaseAdmin } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { Resend } from 'resend';
import { signUnsubToken } from '@/lib/email';
import { friendCampaignHash } from '@/lib/friend-event-sender';
import { checkFriendEventSuppression } from '@/lib/friend-event-suppression';
import { ownerReviewEmail, ownerReviewHash, validOwnerReview, executeOwnerReview } from '@/lib/campaign-owner-review';
import type { OwnerReviewManifest } from '@/lib/campaign-owner-review';

async function eligible(userId?:string) {
 const email=ownerReviewEmail();if(!email||!getAdminEmails().includes(email))return null;
 const {data:u,error}=await supabaseAdmin.from('users').select('*').eq('email',email).maybeSingle();
 if(error||!u||(userId&&u.id!==userId)||u.is_test||u.is_blocked||u.deleted_at||!u.friend_opted_in_at||u.email_notifications!==true||u.notifications_paused_at)return null;
 const {data:p,error:pe}=await supabaseAdmin.from('friend_event_preferences').select('email_enabled').eq('user_id',u.id).maybeSingle();if(pe)return null;
 if(p?.email_enabled===false){const {data:a,error:ae}=await supabaseAdmin.from('friend_event_preference_audit').select('id').eq('user_id',u.id).eq('channel','email').eq('enabled',false).limit(1);if(ae||a?.length)return null;}
 return u;
}
async function suppression(userId:string,email:string) {
 const {data,error}=await supabaseAdmin.from('friend_event_suppressions').select('reason').eq('user_id',userId).eq('channel','email').maybeSingle();
 if(error)return 'unknown' as const;if(data)return 'blocked' as const;
 if(!process.env.RESEND_API_KEY)return 'unknown' as const;
 await new Promise(resolve=>setTimeout(resolve,700));
 const result=await checkFriendEventSuppression(email,address=>new Resend(process.env.RESEND_API_KEY).suppressions.get(address));
 return result==='clear'?'clear' as const:result==='unknown'?'unknown' as const:'blocked' as const;
}
function review(row:any) {
 const m=row.manifest as OwnerReviewManifest;
 if(ownerReviewHash(m)!==row.manifest_hash||!validOwnerReview(m)||m.sourceCampaign!==row.source_campaign||m.userId!==row.user_id||m.expires!==Date.parse(row.expires_at))throw Error('Review integrity mismatch');
 return {prepared:true,sendReady:false,sourceCampaign:m.sourceCampaign,manifestHash:row.manifest_hash,recipientCount:1,recipientClass:'owner_review',memberMetricsIncluded:false,email:m.email,expires:row.expires_at,claimed:!!row.claimed_at,accepted:!!row.accepted_at,remainingGates:['Exact owner copy/links/recipient content approval','Separate execution approval']};
}
export async function prepareOwnerReview(campaign:string,expires:number) {
 const existing=await supabaseAdmin.from('campaign_owner_reviews').select('*').eq('source_campaign',campaign).maybeSingle();
 if(existing.error)throw Error('Review lookup failed');
 if(existing.data)return review(existing.data); // never replace or silently reissue
 const u=await eligible();if(!u||await suppression(u.id,u.email)!=='clear')throw Error('Owner unavailable or suppressed');
 const {data:source,error}=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
 if(error||!source||friendCampaignHash(source.manifest)!==source.manifest_hash||source.manifest.purpose!=='friend_line_announcement'||source.manifest.campaign!==campaign||source.manifest.entries.length!==source.recipient_count)throw Error('Source draft unavailable');
 const email=source.manifest.entries[0]?.email;if(!email)throw Error('Missing source email');
 // Copy the exact frozen campaign, not a renderer that may have since changed.
 const unsubscribeUrl=`https://notcupid.com/unsubscribe?u=${encodeURIComponent(u.id)}&t=${encodeURIComponent(signUnsubToken(u.id,expires+90*86400000))}`;
 const unsubscribePostUrl=unsubscribeUrl.replace('/unsubscribe?','/api/unsubscribe?');
 const htmlEscape=(s:string)=>s.replace(/&/g,'&amp;');
 const replace=(s:string)=>s.split(htmlEscape(email.unsubscribeUrl)).join(htmlEscape(unsubscribeUrl)).split(email.unsubscribeUrl).join(unsubscribeUrl).replace(/https:\/\/notcupid\.com\/go\/friend-events\?token=[^\s"<]+/g,'https://notcupid.com/hub?discover=1');
 const manifest:OwnerReviewManifest={purpose:'owner_campaign_review',sourceCampaign:campaign,sourceHash:source.manifest_hash,userId:u.id,expires,email:{...email,to:u.email,text:replace(email.text),html:replace(email.html),unsubscribeUrl,unsubscribePostUrl}};
 if(!validOwnerReview(manifest))throw Error('Invalid owner copy');
 const row={source_campaign:campaign,user_id:u.id,manifest,manifest_hash:ownerReviewHash(manifest),expires_at:new Date(expires).toISOString()};
 const inserted=await supabaseAdmin.from('campaign_owner_reviews').insert(row);if(inserted.error)throw Error('Review storage failed; inspect before retry');
 return review(row);
}
export async function sendOwnerReview(campaign:string,hash:string,deadline:number) {
 const enabled=()=>process.env.CAMPAIGN_OWNER_REVIEW_SEND_ENABLED==='true'&&Date.now()<deadline;
 if(!enabled())return {attempted:0,accepted:0,stopped:'disabled'};
 const {data:row,error}=await supabaseAdmin.from('campaign_owner_reviews').select('*').eq('source_campaign',campaign).maybeSingle();
 if(error||!row||row.manifest_hash!==hash)return {attempted:0,accepted:0,stopped:'missing_review'};
 review(row);const m=row.manifest as OwnerReviewManifest;
 const currentApproval=async()=>{if(!enabled())return null;const {data:a,error:ae}=await supabaseAdmin.from('campaign_owner_reviews').select('*').eq('source_campaign',campaign).maybeSingle();if(ae||!a)return null;return {manifestHash:a.manifest_hash,contentApprovedAt:Date.parse(a.content_approved_at||''),sendApprovedAt:Date.parse(a.send_approved_at||''),expires:Date.parse(a.expires_at),enabled:a.send_enabled};};
 return executeOwnerReview(m,{
  approval:currentApproval,
  eligible:async()=>!!await eligible(m.userId),suppression:()=>suppression(m.userId,m.email.to),
  claim:async()=>{const {data,error:ce}=await supabaseAdmin.rpc('claim_campaign_owner_review',{p_campaign:campaign,p_hash:hash});if(ce)throw Error('Claim failed');return data===true;},
  submit:async()=>{await new Promise(resolve=>setTimeout(resolve,700));if(!enabled()||!process.env.RESEND_API_KEY)throw Error('Disabled');const a=await currentApproval();if(!a?.enabled||a.manifestHash!==hash||!Number.isFinite(a.contentApprovedAt)||a.contentApprovedAt<=0||!Number.isFinite(a.sendApprovedAt)||a.sendApprovedAt<=a.contentApprovedAt||a.sendApprovedAt>Date.now()||a.expires<=Date.now()||m.expires<=Date.now()||!await eligible(m.userId))throw Error('Approval or eligibility changed');const e=m.email;const {data,error:se}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:e.from,to:e.to,replyTo:e.replyTo,subject:e.subject,text:e.text,html:e.html,headers:{'List-Unsubscribe':`<${e.unsubscribePostUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'recipient_class',value:'owner_review'},{name:'source_campaign',value:campaign}]},{idempotencyKey:`owner-review:${campaign}:${hash}`});if(se||!data?.id)throw Error('Unknown provider outcome');return data.id;},
  receipt:async(id)=>{const {error:re}=await supabaseAdmin.from('campaign_owner_reviews').update({provider_id:id,accepted_at:new Date().toISOString(),send_enabled:false}).eq('source_campaign',campaign).eq('manifest_hash',hash);if(re)throw Error('Receipt failed');}
 });
}
