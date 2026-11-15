import { randomUUID, createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { cityEvents } from '@/lib/city-events-server';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';
import { collectDailyActivityCandidates } from '@/lib/daily-activity-digest';
import { prepareOwnerReview } from '@/lib/campaign-owner-review-adapter';
import { signUnsubToken } from '@/lib/email';
import { signFriendEventToken } from '@/lib/friend-event-campaign';
import { friendCampaignHash } from '@/lib/friend-event-sender';
import { discoveryEditionId, easternDate, selectDiscoveryItems, FRIEND_DISCOVERY_VERSION, type DiscoveryEdition } from '@/lib/friend-discovery-edition';
import { renderFriendDiscoveryMessage } from '@/lib/friend-discovery-message';

// Review artifacts only. No campaign/approval/delivery insert, sender or scheduler.
// The distinct purpose is deliberately rejected by all existing member executors.
export async function prepareFriendDiscovery(edition: DiscoveryEdition, revision=1, now=Date.now()) {
  if (!Number.isInteger(revision)||revision<1||revision>20) throw Error('Invalid revision');
  const campaign=discoveryEditionId(edition,now)+`_r${revision}`;
  const existing=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();
  if(existing.error)throw Error('Draft lookup failed');
  const review=async(row:any)=>{
    const m=row.manifest;
    if(m.purpose!=='friend_discovery_review'||m.campaign!==campaign||m.version!==FRIEND_DISCOVERY_VERSION||friendCampaignHash(m)!==row.manifest_hash||m.entries.length!==row.recipient_count||m.expires!==Date.parse(row.expires_at))throw Error('Draft integrity mismatch');
    const redact=(value:string)=>value.replace(/https:\/\/notcupid\.com\/go\/friend-events\?token=[^\s"<]+/g,'https://notcupid.com/go/friend-events?token=[signed-recipient-and-destination-token]').replace(/https:\/\/notcupid\.com\/unsubscribe\?[^\s"<]+/g,'https://notcupid.com/unsubscribe?u=[recipient]&t=[signed-token]');
    let ownerReview:unknown;
    try{ownerReview=await prepareOwnerReview(campaign,m.expires);}catch{ownerReview={prepared:false,required:true,memberMetricsIncluded:false,blocked:'Existing owner eligibility/suppression/configuration checks must pass; no substitute recipient'};}
    return {prepared:true,sendReady:false,recurringEnabled:false,authorizedRecipients:0,campaign,manifestHash:row.manifest_hash,candidateRecipients:row.recipient_count,edition,expires:row.expires_at,expired:m.expires<=now,preparedAt:m.preparedAt,counts:m.counts,
      sample:{...m.entries[0].email,to:undefined,text:redact(m.entries[0].email.text),html:redact(m.entries[0].email.html),unsubscribeUrl:'[recipient-specific global unsubscribe]',unsubscribePostUrl:'[recipient-specific one-click global unsubscribe]'},
      sampleItems:m.entries[0].recommendations,ownerReview,remainingGates:['Existing consent promises at most once weekly; explicit twice-weekly consent/audience policy required','Exact weekdays, ET times and delivery windows','Provider permission and recipient suppression recheck','Fresh inventory, capacity, safety and daily-overlap recheck immediately before execution','Exact rendered messages, audience and count content approval, then separate send approval','Separate approved recurring executor with atomic cadence/overlap claims and bounded retry/reconciliation policy'],noSendOrApprovalCreated:true};
  };
  if(existing.data)return review(existing.data);
  const admins=getAdminEmails();if(!admins.length)throw Error('Admin exclusions unavailable');
  const all=(table:string,fields:string,order='id')=>fetchAllSupabaseRows<any>((from,to)=>supabaseAdmin.from(table).select(fields).order(order).range(from,to));
  const [users,prefs,suppressed,plans,rsvps,reports,trips,deliveries,digests,drafts,daily,catalog]=await Promise.all([
    all('users','id,email,zip,discovery_metro,age,gender,is_lgbtq,is_test,is_blocked,deleted_at,friend_opted_in_at,email_notifications,notifications_paused_at,activity_digest_sent_at'),
    all('friend_event_preferences','user_id,email_enabled,consent_version','user_id'),fetchAllSupabaseRows<any>((from,to)=>supabaseAdmin.from('friend_event_suppressions').select('user_id,channel').order('user_id').order('channel').range(from,to)),
    all('friend_activities','id,author_id,title,category,area,metro,kind,is_test,capacity,happens_at,expires_at,external_event_id,audience_gender,audience_age_min,audience_age_max'),
    fetchAllSupabaseRows<any>((from,to)=>supabaseAdmin.from('friend_activity_rsvps').select('activity_id,user_id,response').order('activity_id').order('user_id').range(from,to)),
    all('user_reports','id,reporter_id,reported_id'),all('friend_trips','id,user_id,destination_metro,starts_on,ends_on,status'),
    all('friend_event_deliveries','id,user_id,campaign_id,channel,status,claimed_at'),all('activity_digest_deliveries','id,user_id,status,created_at,item_counts'),
    all('friend_announcement_drafts','id,manifest,prepared_at'),collectDailyActivityCandidates(new Date(now)),cityEvents('boston',true),
  ]);
  if(catalog.status!=='ready')throw Error('Fresh moderated catalogue unavailable');
  const today=easternDate(now),windowEnd=new Date(now+30*86400000).toISOString().slice(0,10);
  const metro=(u:any)=>{const trip=trips.filter(t=>t.user_id===u.id&&t.status==='active'&&t.ends_on>=today&&t.starts_on<=windowEnd&&METRO_CENTERS[t.destination_metro]).sort((a,b)=>a.starts_on.localeCompare(b.starts_on))[0];return METRO_CENTERS[u.discovery_metro]?u.discovery_metro:trip?.destination_metro||metroOf(u.zip);};
  const opted=new Set(prefs.filter(p=>p.email_enabled===true&&p.consent_version==='friend-events-v1').map(p=>p.user_id));
  const blocked=new Set(suppressed.filter(s=>s.channel==='email').map(s=>s.user_id));
  const dailyUsers=new Set(daily.map(d=>d.user.id));
  const recentDaily=new Set(digests.filter(d=>['queued','sent'].includes(d.status)&&Date.parse(d.created_at)>now-86400000).map(d=>d.user_id));
  // Existing daily rows do not retain item IDs: conservatively avoid repeating any
  // member-plan recommendation to a recipient with a recent daily plan section.
  const dailyPlans=new Set(digests.filter(d=>['queued','sent'].includes(d.status)&&Date.parse(d.created_at)>now-7*86400000&&Number(d.item_counts?.plans)>0).map(d=>d.user_id));
  const recentDeliveries=deliveries.filter(d=>d.channel==='email'&&Date.parse(d.claimed_at)>now-30*86400000);
  const cooldown=new Set(recentDeliveries.filter(d=>Date.parse(d.claimed_at)>now-72*3600000).map(d=>d.user_id));
  const counts={preferenceAndSafetyEligible:0,dailyOverlapExcluded:0,recentCampaignExcluded:0,noFreshItems:0};
  const entries:any[]=[];const expires=now+6*3600000;
  for(const u of users.sort((a,b)=>a.id.localeCompare(b.id))){
    if(u.is_test||u.is_blocked||u.deleted_at||admins.includes((u.email||'').trim().toLowerCase())||!u.friend_opted_in_at||u.email_notifications!==true||u.notifications_paused_at||!u.age||u.age<18||!opted.has(u.id)||blocked.has(u.id)||metro(u)!=='boston'||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(u.email||''))continue;
    counts.preferenceAndSafetyEligible++;
    if(dailyUsers.has(u.id)||recentDaily.has(u.id)||(u.activity_digest_sent_at&&easternDate(Date.parse(u.activity_digest_sent_at))===today)){counts.dailyOverlapExcluded++;continue;}
    if(cooldown.has(u.id)){counts.recentCampaignExcluded++;continue;}
    const seen=new Set<string>();
    for(const d of recentDeliveries.filter(d=>d.user_id===u.id)){const prior=drafts.find(r=>r.id===d.campaign_id)?.manifest?.entries?.find((e:any)=>e.userId===u.id);for(const item of prior?.recommendations||[]){seen.add(item.key);if(item.relatedEventId)seen.add(`event:${item.relatedEventId}`);}}
    const selected=selectDiscoveryItems(u,{users,plans:dailyPlans.has(u.id)?[]:plans,rsvps,reports,events:catalog.events,admins,seen},edition,now);
    if(!selected.length){counts.noFreshItems++;continue;}
    const deliveryId=randomUUID();
    const url=(target:Record<string,string>={})=>'https://notcupid.com/go/friend-events?token='+encodeURIComponent(signFriendEventToken({purpose:'attribution',userId:u.id,deliveryId,channel:'email',expires:expires+30*86400000,...target}));
    const unsubscribe=`https://notcupid.com/unsubscribe?u=${encodeURIComponent(u.id)}&t=${encodeURIComponent(signUnsubToken(u.id,expires+90*86400000))}`;
    entries.push({deliveryId,userId:u.id,channel:'email',recommendations:selected,email:{to:u.email,...renderFriendDiscoveryMessage(edition,selected,{item:i=>url(i.kind==='plan'?{planId:i.id}:{eventId:i.id}),browse:url(),unsubscribe})}});
  }
  if(!entries.length)return {prepared:false,sendReady:false,recurringEnabled:false,authorizedRecipients:0,edition,counts,blocked:'No eligible recipients with fresh non-overlapping items; no draft or campaign created'};
  if(new Set(entries.map(e=>e.email.to.toLowerCase())).size!==entries.length)throw Error('Duplicate recipient mailbox');
  const manifest={purpose:'friend_discovery_review',campaign,version:FRIEND_DISCOVERY_VERSION,edition,revision,preparedAt:new Date(now).toISOString(),catalogFetchedAt:catalog.fetchedAt,expires,counts,entries};
  const row={id:campaign,manifest,manifest_hash:friendCampaignHash(manifest),audience_hash:createHash('sha256').update(JSON.stringify(entries.map(e=>[e.userId,e.email.to]))).digest('hex'),recipient_count:entries.length,expires_at:new Date(expires).toISOString()};
  const inserted=await supabaseAdmin.from('friend_announcement_drafts').insert(row);
  if(inserted.error){if(inserted.error.code!=='23505')throw Error('Draft storage failed');const raced=await supabaseAdmin.from('friend_announcement_drafts').select('*').eq('id',campaign).maybeSingle();if(raced.error||!raced.data)throw Error('Concurrent draft unavailable');return review(raced.data);}
  return review(row);
}
