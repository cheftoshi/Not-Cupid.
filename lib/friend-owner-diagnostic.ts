import { supabaseAdmin } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { Resend } from 'resend';
import { checkFriendEventSuppression } from '@/lib/friend-event-suppression';

// Temporary, read-only incident diagnostic. Only the owner's verified account;
// no caller-selected recipient, identifiers, credentials, or provider payloads.
export async function diagnoseOwnerAnnouncementExclusion() {
 const at=new Date().toISOString();
 const {data:user,error}=await supabaseAdmin.from('users')
  .select('id,email,is_test,is_blocked,deleted_at,friend_opted_in_at,email_notifications,notifications_paused_at')
  .eq('id','10804fc4-6506-431a-8282-a2dfcff01b41').maybeSingle();
 if(error||!user)return {at,reason:'account_lookup_unavailable'};
 const admins=getAdminEmails();
 if(!admins.length)return {at,reason:'admin_configuration_unavailable'};
 if(admins.includes(user.email.trim().toLowerCase()))return {at,reason:'admin_excluded'};
 if(user.is_test||user.is_blocked||user.deleted_at)return {at,reason:'account_excluded'};
 if(!user.friend_opted_in_at)return {at,reason:'not_friend_member'};
 if(!user.email_notifications||user.notifications_paused_at)return {at,reason:'email_preferences_excluded'};
 if(!process.env.RESEND_API_KEY)return {at,reason:'provider_unavailable'};
 const provider=new Resend(process.env.RESEND_API_KEY);
 const status=await checkFriendEventSuppression(user.email,email=>provider.suppressions.get(email));
 return {at,reason:status==='clear'?'admin_and_provider_clear':status==='unknown'?'provider_lookup_unavailable':status==='provider_suppressed'?'provider_suppressed':'provider_'+status};
}
