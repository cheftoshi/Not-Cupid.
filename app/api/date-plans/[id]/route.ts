import { after, NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { accessibleDatePlan } from '@/lib/date-plan-server';
import { dateRequestEligible } from '@/lib/date-plan-policy';
import { validatePlanLocation } from '@/lib/plan-location';
import { planAreasForMetro } from '@/lib/neighborhoods';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  const limit = await rateLimit({key:`date-action:${user.id}`,windowSec:3600,maxAttempts:60,blockSec:900});
  if (!limit.ok) return NextResponse.json({error:'Please wait before changing another date.'},{status:429});
  const {id}=await params;
  try {
    const plan=await accessibleDatePlan(user,id);
    if (!plan) return NextResponse.json({error:'This date is no longer available.'},{status:404});
    const body=await req.json().catch(()=>({}));
    if (!['request','withdraw','accept','pass','cancel','report'].includes(body.action)) return NextResponse.json({error:'Choose a valid response.'},{status:400});
    if (body.action==='request'&&!dateRequestEligible(plan,user)) return NextResponse.json({error:'This invitation is not open to your profile.'},{status:403});
    if (body.request_id && !/^[0-9a-f-]{36}$/i.test(body.request_id)) return NextResponse.json({error:'Invalid request.'},{status:400});
    const {data,error}=await supabaseAdmin.rpc('connection_date_action',{p_plan:id,p_user:user.id,p_action:body.action,p_request:body.request_id||null});
    if (error) return NextResponse.json({error:'That date changed or is unavailable. Refresh before trying again.'},{status:409});
    if (data?.changed) after(async()=>{
      const latest=await supabaseAdmin.from('connection_date_plans').select('guest_id').eq('id',id).maybeSingle();
      const recipient=body.action==='request'?plan.host_id:body.action==='accept'?latest.data?.guest_id:body.action==='cancel'?(user.id===plan.host_id?plan.guest_id:plan.host_id):null;
      if(recipient&&recipient!==user.id) await sendPushToUser(recipient,{title:body.action==='request'?'Someone is interested in your date':body.action==='accept'?'Your date is confirmed':'Your date was cancelled',body:'Open NotCupid to review your invitation.',url:`/hub?date=${id}`,tag:`date-plan-${id}`}).catch(()=>{});
    });
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:'Could not verify this date. Please retry.'},{status:503}); }
}

export async function PATCH(req: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const limit=await rateLimit({key:`date-location:${user.id}`,windowSec:3600,maxAttempts:30,blockSec:900});
  if(!limit.ok)return NextResponse.json({error:'Please wait before editing another meeting place.'},{status:429});
  const {id}=await params;
  try{
    const plan=await accessibleDatePlan(user,id);
    if(!plan||plan.host_id!==user.id)return NextResponse.json({error:'Only the host can set the meeting place.'},{status:403});
    const body=await req.json().catch(()=>({}));
    const location=validatePlanLocation({...body,visibility:'participants'},planAreasForMetro(plan.metro));
    const {error}=await supabaseAdmin.from('connection_date_plans').update({area:location.area,venue:location.location}).eq('id',id).eq('host_id',user.id);
    return NextResponse.json(error?{error:'Meeting place update was not confirmed.'}:{ok:true},{status:error?503:200});
  }catch{return NextResponse.json({error:'Check the neighborhood and confirm the public meeting place.'},{status:400});}
}
