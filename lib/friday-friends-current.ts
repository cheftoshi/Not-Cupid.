import { supabaseAdmin as db } from '@/lib/supabase';
import { getAdminEmails } from '@/lib/admin';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';
import { collectDailyActivityCandidates } from '@/lib/daily-activity-digest';
import { cityEvents } from '@/lib/city-events-server';
import { selectDiscoveryItems } from '@/lib/friend-discovery-edition';
import { friendCampaignHash } from '@/lib/friend-event-sender';
import { verifyFriendEventToken, friendEventDestination } from '@/lib/friend-event-campaign';
import { verifyUnsubToken } from '@/lib/email';
import { renderFriendDiscoveryMessage } from '@/lib/friend-discovery-message';
import type { FridayEntry } from '@/lib/friday-friends-executor';
// Read-only current validation. Do not prepare a new artifact or silently change
// frozen selections when space, title, time, source or recipient eligibility changes.
export async function currentFridayEntry(e:FridayEntry, campaign:string, now=Date.now()) {
 const admins=getAdminEmails();if(!admins.length||!e.email)return false;
 const {data:u,error}=await db.from('users').select('*').eq('id',e.userId).maybeSingle();
 if(error||!u||u.is_test||u.is_blocked||u.deleted_at||!u.friend_opted_in_at||u.age<18||!u.age||u.email_notifications!==true||u.notifications_paused_at||u.email!==e.email.to||admins.includes((u.email||'').trim().toLowerCase()))return false;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const horizon=new Date(now+30*86400000).toISOString().slice(0,10);
 const {data:trip,error:te}=await db.from('friend_trips').select('destination_metro,starts_on').eq('user_id',u.id).eq('status','active').gte('ends_on',today).order('starts_on').limit(1).maybeSingle();
 if(te)return false;
 const metro=METRO_CENTERS[u.discovery_metro]?u.discovery_metro:trip&&trip.starts_on<=horizon&&METRO_CENTERS[trip.destination_metro]?trip.destination_metro:metroOf(u.zip);
 if(metro!=='boston')return false;
 const all=(table:string,fields:string,order='id')=>fetchAllSupabaseRows<any>((from,to)=>db.from(table).select(fields).order(order).range(from,to));
 const [{data:p,error:pe},{data:s,error:se},users,plans,rsvps,reports,catalog,daily,digests,deliveries]=await Promise.all([
  db.from('friend_event_preferences').select('email_enabled,consent_version').eq('user_id',u.id).maybeSingle(),db.from('friend_event_suppressions').select('reason').eq('user_id',u.id).eq('channel','email').maybeSingle(),
  all('users','id,email,is_test,is_blocked,deleted_at'),all('friend_activities','id,author_id,title,category,area,metro,kind,is_test,capacity,happens_at,expires_at,external_event_id,audience_gender,audience_age_min,audience_age_max'),
  fetchAllSupabaseRows<any>((from,to)=>db.from('friend_activity_rsvps').select('activity_id,user_id,response').order('activity_id').order('user_id').range(from,to)),all('user_reports','id,reporter_id,reported_id'),cityEvents('boston',true),collectDailyActivityCandidates(new Date(now)),
  fetchAllSupabaseRows<any>((from,to)=>db.from('activity_digest_deliveries').select('id,created_at,item_counts').eq('user_id',u.id).gte('created_at',new Date(now-7*86400000).toISOString()).order('id').range(from,to)),
  fetchAllSupabaseRows<any>((from,to)=>db.from('friend_event_deliveries').select('id,campaign_id,claimed_at').eq('user_id',u.id).eq('channel','email').gte('claimed_at',new Date(now-30*86400000).toISOString()).order('id').range(from,to))
 ]);
 if(pe||se||s||p?.email_enabled!==true||p.consent_version!=='friend-events-v1'||catalog.status!=='ready'||daily.some(d=>d.user.id===u.id)||digests.some(d=>Date.parse(d.created_at)>now-86400000)||Date.parse(u.activity_digest_sent_at||'')>now-86400000)return false;
 const previous=deliveries.filter(d=>d.campaign_id!==campaign);
 if(previous.some(d=>Date.parse(d.claimed_at)>now-7*86400000))return false;
 const seen=new Set<string>();
 for(const id of new Set(previous.map(d=>d.campaign_id))){const {data:d,error:de}=await db.from('friend_announcement_drafts').select('manifest').eq('id',id).maybeSingle();if(de)return false;for(const item of d?.manifest?.entries?.find((v:any)=>v.userId===u.id)?.recommendations||[]){seen.add(item.key);if(item.relatedEventId)seen.add('event:'+item.relatedEventId);}}
 const plansAllowed=!digests.some(d=>Number(d.item_counts?.plans)>0);
 for(const item of e.recommendations){
  const selected=selectDiscoveryItems(u,{users,plans:plansAllowed?plans.filter(v=>item.kind==='plan'&&v.id===item.id):[],rsvps,reports,events:item.kind==='plan'?catalog.events:catalog.events.filter(v=>v.id===item.id),admins,seen},'weekend',now);
  const current=selected.find(v=>v.key===item.key);
  if(!current||friendCampaignHash(current)!==friendCampaignHash(item))return false;
 }
 const matches=[...e.email.text.matchAll(/https:\/\/notcupid\.com\/go\/friend-events\?token=([^\s"<]+)/g)];
 if(matches.length!==1)return false;
 const browse=matches[0][0],token=verifyFriendEventToken(decodeURIComponent(matches[0][1]),'attribution',now);
 if(!token||token.userId!==u.id||token.deliveryId!==e.deliveryId||token.channel!=='email'||friendEventDestination(token)!=='/hub?discover=1')return false;
 const unsubscribe=new URL(e.email.unsubscribeUrl);
 if(unsubscribe.origin!=='https://notcupid.com'||unsubscribe.pathname!=='/unsubscribe'||unsubscribe.searchParams.get('u')!==u.id||!verifyUnsubToken(u.id,unsubscribe.searchParams.get('t'))||e.email.unsubscribePostUrl!==e.email.unsubscribeUrl.replace('/unsubscribe?','/api/unsubscribe?'))return false;
 const rendered=renderFriendDiscoveryMessage('weekend',e.recommendations,{item:()=>{throw Error('Unexpected item CTA');},browse,unsubscribe:e.email.unsubscribeUrl},u.name);
 return ['subject','text','html','from','replyTo','unsubscribeUrl','unsubscribePostUrl'].every(k=>(rendered as any)[k]===(e.email as any)[k]);
}
