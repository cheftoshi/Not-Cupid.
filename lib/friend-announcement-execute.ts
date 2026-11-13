import { supabaseAdmin } from '@/lib/supabase';
import { friendCampaignHash,executeFrozenFriendCampaign } from '@/lib/friend-event-sender';
import { friendEventSenderDependencies } from '@/lib/friend-event-sender-adapter';

// No environment or database approval is created here. A started attempt remains
// locked even after failure/timeout, requiring reconciliation, never blind retry.
export async function executePreparedFriendAnnouncement(campaign:string,hash:string,deadline:number) {
 if(process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED!=='true')return {stopped:'disabled',attempted:0,accepted:0};
 const {data:row,error}=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
 if(error||!row||row.manifest_hash!==hash||friendCampaignHash(row.manifest)!==hash||row.manifest.purpose!=='friend_line_announcement'||row.manifest.campaign!==campaign||row.recipient_count!==row.manifest.entries.length||row.manifest.expires!==Date.parse(row.expires_at)||row.manifest.expires<=Date.now())return {stopped:'invalid_frozen_draft',attempted:0,accepted:0};
 const raw=friendEventSenderDependencies('friend_line_announcement');
 const approved=await raw.approval(campaign);
 if(!approved?.enabled||approved.audiencePolicy!=='friend_line_announcement'||!Number.isFinite(approved.contentApprovedAt)||!Number.isFinite(approved.sendApprovedAt)||!Number.isFinite(approved.expires)||!Number.isFinite(deadline)||approved.manifestHash!==hash||approved.recipientCount!==row.recipient_count||approved.contentApprovedAt<=0||approved.sendApprovedAt<=approved.contentApprovedAt||approved.sendApprovedAt>Date.now()||approved.expires<=Date.now()||deadline<=Date.now())return {stopped:'exact_approval_required',attempted:0,accepted:0};
 const lock=await supabaseAdmin.rpc('start_friend_announcement_execution',{p_campaign:campaign,p_hash:hash});
 if(lock.error||lock.data!==true)return {stopped:'execution_locked_or_unapproved',attempted:0,accepted:0};
 let nextProvider=0;
 const pace=async()=>{const wait=nextProvider-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));if(Date.now()>=deadline)throw new Error('Execution deadline');nextProvider=Date.now()+700;};
 const deps={...raw,approval:async(id:string)=>Date.now()>=deadline?null:raw.approval(id),suppression:async(...args:Parameters<typeof raw.suppression>)=>{await pace();return raw.suppression(...args);},submit:async(...args:Parameters<typeof raw.submit>)=>{
   await pace();
   const current=await raw.approval(campaign);
   if(!current?.enabled||current.audiencePolicy!=='friend_line_announcement'||current.manifestHash!==hash||current.recipientCount!==row.recipient_count||!Number.isFinite(current.contentApprovedAt)||!Number.isFinite(current.sendApprovedAt)||current.contentApprovedAt<=0||current.sendApprovedAt<=current.contentApprovedAt||current.sendApprovedAt>Date.now()||!Number.isFinite(current.expires)||current.expires<=Date.now()||!await raw.eligible(args[0]))throw new Error('Approval or eligibility changed after pacing');
   if(Date.now()>=deadline||Date.now()>=row.manifest.expires||Date.now()>=current.expires)throw new Error('Send window expired');
   return raw.submit(...args);
  }};
 let result;
 try{result=await executeFrozenFriendCampaign(row.manifest,deps);}catch{result={stopped:'uncertain_outcome_reconcile_before_retry',attempted:null,accepted:null};}
 const finish=await supabaseAdmin.rpc('finish_friend_announcement_execution',{p_campaign:campaign,p_hash:hash,p_result:result});
 return {...result,reconciliationRequired:!!finish.error||result.stopped!=='complete'};
}
