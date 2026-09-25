import { after, NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { accessibleDatePlan } from '@/lib/date-plan-server';
import { dateParticipant } from '@/lib/date-plan-policy';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/push';
import { chatRealtimeTopic,broadcastChatRefresh } from '@/lib/chat-realtime';

export const dynamic='force-dynamic';
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const {id}=await params,plan=await accessibleDatePlan(user,id);
    if(!plan||!plan.guest_id||!dateParticipant(plan,user.id))return NextResponse.json({error:'Chat opens only after the host accepts.'},{status:403});
    const {data,error}=await supabaseAdmin.from('connection_date_messages').select('id,user_id,body,created_at,client_id').eq('plan_id',id).order('created_at',{ascending:false}).limit(200);
    if(error)return NextResponse.json({error:'Could not load this conversation.'},{status:503});
    return NextResponse.json({comments:(data||[]).reverse().map(m=>({id:m.id,body:m.body,created_at:m.created_at,isMe:m.user_id===user.id,name:m.user_id===user.id?'You':'Your date',clientId:m.user_id===user.id?m.client_id:null})),realtimeTopic:chatRealtimeTopic('date-plan',id)});
  }catch{return NextResponse.json({error:'Could not verify this conversation.'},{status:503});}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const limit=await rateLimit({key:`date-message:${user.id}`,windowSec:3600,maxAttempts:120,blockSec:900});
  if(!limit.ok)return NextResponse.json({error:'Please wait before sending more messages.'},{status:429});
  try{
    const {id}=await params,plan=await accessibleDatePlan(user,id);
    if(!plan||!plan.guest_id||plan.state!=='confirmed'||!dateParticipant(plan,user.id))return NextResponse.json({error:'This date chat is not open.'},{status:403});
    const body=await req.json().catch(()=>({}));
    if(!/^[0-9a-f-]{36}$/i.test(body.client_id||'')||typeof body.body!=='string'||!body.body.trim()||body.body.length>1000)return NextResponse.json({error:'Check your message and try again.'},{status:400});
    const {data,error}=await supabaseAdmin.rpc('connection_date_action',{p_plan:id,p_user:user.id,p_action:'message',p_body:body.body,p_client:body.client_id});
    if(error||!data?.id)return NextResponse.json({error:'Message not confirmed. Retry with the same message.'},{status:409});
    if(data.changed)after(async()=>{
      await Promise.allSettled([broadcastChatRefresh('date-plan',id),sendPushToUser(user.id===plan.host_id?plan.guest_id!:plan.host_id,{title:'A new message in your date plan',body:'Open your private conversation on NotCupid.',url:`/hub?date=${id}`,tag:`date-chat-${id}`})]);
    });
    return NextResponse.json({ok:true,comment:{id:data.id,body:data.body,created_at:data.created_at,isMe:true,name:'You',clientId:body.client_id}});
  }catch{return NextResponse.json({error:'Could not send this message. Your draft is still here.'},{status:503});}
}
