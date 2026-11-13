import { supabaseAdmin } from '@/lib/supabase';
import { collectFriendAnnouncementAudience } from '@/lib/friend-announcement-preflight';
import { freezeFriendAnnouncement } from '@/lib/friend-announcement-freeze';
import { friendCampaignHash } from '@/lib/friend-event-sender';
import type { FrozenFriendCampaign } from '@/lib/friend-event-sender';

function review(row:{id:string;manifest:FrozenFriendCampaign;manifest_hash:string;recipient_count:number;expires_at:string}) {
 const manifest=row.manifest;
 if(friendCampaignHash(manifest)!==row.manifest_hash||manifest.entries.length!==row.recipient_count||manifest.campaign!==row.id||manifest.purpose!=='friend_line_announcement'||manifest.expires!==Date.parse(row.expires_at)||manifest.expires<=Date.now())throw new Error('Frozen draft integrity mismatch');
 const email=manifest.entries[0]?.email;if(!email)throw new Error('Missing frozen email');
 // Every exact personalized message remains stored server-side. Only link shapes,
 // full shared copy and aggregate counts are returned, never member identifiers.
 const redact=(s:string)=>s.replace(/https:\/\/notcupid\.com\/go\/friend-events\?token=[^\s"<]+/g,'https://notcupid.com/go/friend-events?token=[recipient-specific-signed-token]')
  .replace(/https:\/\/notcupid\.com\/(?:api\/)?unsubscribe\?[^\s"<]+/g,'https://notcupid.com/unsubscribe?u=[recipient-id]&t=[signed-unsubscribe-token]');
 return {prepared:true,sendReady:false,campaign:row.id,manifestHash:row.manifest_hash,recipientCount:row.recipient_count,expires:row.expires_at,
  from:email.from,replyTo:email.replyTo,subject:email.subject,text:redact(email.text),html:redact(email.html),
  links:{cta:'https://notcupid.com/go/friend-events?token=[recipient-specific-signed-token]',destination:'https://notcupid.com/hub?discover=1',unsubscribe:'https://notcupid.com/unsubscribe?u=[recipient-id]&t=[signed-unsubscribe-token]',oneClickHeader:'https://notcupid.com/api/unsubscribe?u=[recipient-id]&t=[signed-unsubscribe-token]'},
  audience:'Real Friend Line members across cities with email notifications on, not paused, excluding admin/test/blocked/deleted, explicit topic opt-outs, local/provider suppression and recent delivery claims.',
  remainingGates:['Provider permission review','Exact frozen content/links/audience/count approval','Separate execution approval'],noSendOrApprovalCreated:true};
}
export async function prepareFriendAnnouncement(campaign:string,expires:number) {
 const existing=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
 if(existing.error)throw new Error('Draft lookup failed');
 if(existing.data){if(Date.parse(existing.data.expires_at)!==expires)throw new Error('Use a new draft id for changed expiry');return review(existing.data);}
 const audience=await collectFriendAnnouncementAudience();
 if(!audience.complete||!('recipients'in audience)||!audience.recipients?.length)return {prepared:false,sendReady:false,blocked:('blocked'in audience?audience.blocked:'No eligible audience')};
 const manifest=freezeFriendAnnouncement({campaign,version:'friend-announcement-weekend-2026-11-13-v3-clean',expires,recipients:audience.recipients});
 const row={id:campaign,manifest,manifest_hash:friendCampaignHash(manifest),audience_hash:audience.audienceHash,recipient_count:manifest.entries.length,expires_at:new Date(expires).toISOString()};
 const result=await supabaseAdmin.from('friend_announcement_drafts').insert(row);
 if(result.error){
  // A concurrent identical request cannot replace a frozen draft.
  if(result.error.code!=='23505')throw new Error('Draft storage failed');
  const raced=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
  if(raced.error||!raced.data||Date.parse(raced.data.expires_at)!==expires)throw new Error('Concurrent draft mismatch');
  return review(raced.data);
 }
 return review(row);
}
