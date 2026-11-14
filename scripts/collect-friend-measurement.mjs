// Read-only supplemental daily collector. No state writes, RPCs or provider calls.
import {summarizeFriendMeasurement} from './friend-measurement.mjs';

export async function collectFriendMeasurement(env=process.env, fetcher=fetch) {
  const start=env.NOTCUPID_REPORT_BASELINE,end=env.NOTCUPID_REPORT_END;
  if (!env.ADMIN_EMAILS?.trim()||!start||!end||!env.NEXT_PUBLIC_SUPABASE_URL||!env.SUPABASE_SERVICE_KEY) throw Error('Missing reporting configuration');
  const origin=new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  const read=async(table,select,order,filters={})=>{
    const rows=[];
    for(let offset=0;offset<100000;offset+=500) {
      const url=new URL(`/rest/v1/${table}`,origin);
      url.search=new URLSearchParams({select,order,limit:'500',offset:String(offset),...filters});
      const response=await fetcher(url,{method:'GET',redirect:'error',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_KEY}`},signal:AbortSignal.timeout(45000)});
      if(!response.ok) throw Error(`Aggregate read failed: ${table} (${response.status})`);
      const data=await response.json();if(!Array.isArray(data)) throw Error(`Invalid aggregate rows: ${table}`);
      rows.push(...data);if(data.length<500)return rows;
    }
    throw Error(`Aggregate truncated: ${table}`);
  };
  const entries=await Promise.all([
    ['users','id,email,is_test,is_blocked,deleted_at','id',{}],
    ['events','id,user_id,event_name,metadata,session_id,created_at','id',{surface:'eq.outside_events',created_at:`lt.${end}`}],
    ['deliveries','id,user_id,campaign_id,channel,status,claimed_at,accepted_at,delivered_at,complained_at','id',{claimed_at:`lt.${end}`}],
    ['attributions','delivery_id,event,occurred_at','delivery_id,event',{occurred_at:`lt.${end}`}],
    ['pushReceipts','delivery_id,device_id,outcome,recorded_at','delivery_id,device_id',{recorded_at:`lt.${end}`}],
    ['ownerReviews','source_campaign,accepted_at','source_campaign',{}],
    ['plans','id,author_id,is_test,external_event_id,created_at','id',{external_event_id:'not.is.null',created_at:`lt.${end}`}],
    ['comments','id,user_id,activity_id,created_at','id',{created_at:`lt.${end}`}],
    ['feedback','user_id,plan_id,plan_kind,met,updated_at','user_id,plan_id,plan_kind',{plan_kind:'eq.friend',updated_at:`lt.${end}`}],
  ].map(async([key,select,order,filters])=>[key,await read(({events:'app_client_events',deliveries:'friend_event_deliveries',attributions:'friend_event_attribution',pushReceipts:'friend_push_announcement_receipts',ownerReviews:'campaign_owner_reviews',plans:'friend_activities',comments:'friend_activity_comments',feedback:'plan_outcome_feedback'})[key]||key,select,order,filters)]));
  return summarizeFriendMeasurement(Object.fromEntries(entries),{start,end,adminEmails:env.ADMIN_EMAILS.split(',').filter(s=>s.trim())});
}
