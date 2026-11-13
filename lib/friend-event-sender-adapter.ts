import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { friendLocationContext } from '@/lib/friend-location';
import { sendPushToUserDetailed } from '@/lib/push';
import { checkFriendEventSuppression } from '@/lib/friend-event-suppression';
import { recordFriendEventProviderEvent } from '@/lib/friend-event-provider';
import type { FriendSenderDependencies, FrozenFriendDelivery } from '@/lib/friend-event-sender';

// Deliberately unreferenced by all routes/cron. Constructing does not send.
// Production execution needs a future explicit operator handoff after exact review.
export function friendEventSenderDependencies(purpose: 'weekly_discovery' | 'friend_line_announcement' = 'weekly_discovery'): FriendSenderDependencies {
  const announcement=purpose==='friend_line_announcement';
  const enabled=()=> announcement ? process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED==='true' : process.env.FRIEND_EVENT_SEND_ENABLED==='true';
  const provider = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  return {
    async approval(campaign) {
      if(!enabled()) return null;
      const {data,error}=await supabaseAdmin.from('friend_event_campaigns').select('*').eq('id',campaign).maybeSingle();
      if(error||!data||(data.audience_policy||'weekly_discovery')!==purpose) return null;
      if(announcement && (!campaign.startsWith('friend_events_announcement_') || !Number.isFinite(Date.parse(data.provider_permission_reviewed_at||'')) || Date.parse(data.provider_permission_reviewed_at)>Date.now() || (data.provider_permission_basis||'').trim().length<20)) return null;
      return {audiencePolicy:purpose,manifestHash:data.manifest_hash,recipientCount:data.recipient_count,contentApprovedAt:Date.parse(data.content_approved_at||''),sendApprovedAt:Date.parse(data.send_approved_at||''),expires:Date.parse(data.expires_at),enabled:data.send_enabled && Number.isFinite(Date.parse(data.approved_at || '')) && Date.parse(data.approved_at) <= Date.now()};
    },
    async eligible(entry) {
      const admins=getAdminEmails(); if(!admins.length) return false;
      const {data:user,error}=await supabaseAdmin.from('users').select('*').eq('id',entry.userId).maybeSingle();
      if(error||!user||user.is_test||user.is_blocked||user.deleted_at||!user.friend_opted_in_at||admins.includes((user.email||'').trim().toLowerCase())) return false;
      if(announcement && (entry.channel!=='email'||user.email_notifications!==true||user.notifications_paused_at||user.email!==entry.email?.to)) return false;
      if(!announcement && (await friendLocationContext(user)).metro!=='boston') return false;
      const {data:p,error:pe}=await supabaseAdmin.from('friend_event_preferences').select('*').eq('user_id',entry.userId).maybeSingle();
      if(pe) return false;
      if(announcement) {
        if(p?.email_enabled===false) {
          const {data:optouts,error:oe}=await supabaseAdmin.from('friend_event_preference_audit').select('id').eq('user_id',entry.userId).eq('channel','email').eq('enabled',false).limit(1);
          if(oe||optouts?.length) return false;
        }
        return true;
      }
      if(!p||p.consent_version!=='friend-events-v1') return false;
      if(entry.channel==='email') return !!p.email_enabled&&user.email_notifications===true&&!user.notifications_paused_at&&user.email===entry.email?.to;
      if(!p.push_enabled) return false;
      const {data:sub,error:se}=await supabaseAdmin.from('push_subscriptions').select('id').eq('user_id',entry.userId).limit(1);
      return !se&&!!sub?.length;
    },
    async suppression(entry) {
      const {data,error}=await supabaseAdmin.from('friend_event_suppressions').select('reason').eq('user_id',entry.userId).eq('channel',entry.channel).maybeSingle();
      if(error) return 'unknown'; if(data) return 'blocked';
      if(entry.channel==='push') return 'clear';
      if(!provider||!entry.email) return 'unknown';
      const result=await checkFriendEventSuppression(entry.email.to,email=>provider.suppressions.get(email));
      // Do not mutate settings or clear a stored suppression from this read check.
      return result==='clear'?'clear':result==='unknown'?'unknown':'blocked';
    },
    async claim(entry,campaign,hash) {
      const args={p_user:entry.userId,p_campaign:campaign,p_admin_emails:getAdminEmails(),p_delivery:entry.deliveryId,p_manifest_hash:hash};
      const {data,error}=announcement ? await supabaseAdmin.rpc('claim_friend_line_announcement',args) : await supabaseAdmin.rpc('claim_frozen_friend_event_delivery',{...args,p_channel:entry.channel});
      if(error) throw new Error('Delivery claim failed'); return data===entry.deliveryId;
    },
    async submit(entry,campaign) {
      if(!enabled()) throw new Error('Sending is disabled');
      if(announcement && entry.channel!=='email') throw new Error('Announcement is email-only');
      if(entry.channel==='push'&&entry.push) {
        const result=await sendPushToUserDetailed(entry.userId,entry.push);
        return {accepted:result.delivered}; // provider acceptance, never device display
      }
      if(!provider||!entry.email) throw new Error('Email provider unavailable');
      const e=entry.email;
      const {data,error}=await provider.emails.send({from:e.from,to:e.to,replyTo:e.replyTo,subject:e.subject,html:e.html,text:e.text,headers:{'List-Unsubscribe':`<${e.unsubscribePostUrl||e.unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'campaign',value:campaign},{name:'friend_event_delivery_id',value:entry.deliveryId}]},{idempotencyKey:`friend-events:${entry.deliveryId}`});
      if(error||!data?.id) throw new Error('Provider result requires reconciliation');
      return {accepted:true,providerId:data.id};
    },
    async recordAccepted(entry:FrozenFriendDelivery,providerId) {
      if(entry.channel==='email') {
        if(!providerId) throw new Error('Missing provider receipt');
        const {data:row,error}=await supabaseAdmin.from('friend_event_deliveries').select('campaign_id').eq('id',entry.deliveryId).maybeSingle();
        if(error||!row) throw new Error('Delivery receipt unavailable');
        const recorded=await recordFriendEventProviderEvent({type:'email.sent',created_at:new Date().toISOString(),data:{email_id:providerId,tags:{campaign:row.campaign_id,friend_event_delivery_id:entry.deliveryId}}},`submission:${entry.deliveryId}`);
        if(!recorded) throw new Error('Could not record receipt');
      } else {
        const {error}=await supabaseAdmin.from('friend_event_deliveries').update({status:'accepted',accepted_at:new Date().toISOString()}).eq('id',entry.deliveryId).eq('status','claimed');
        if(error) throw new Error('Could not record push acceptance');
      }
    },
  };
}
