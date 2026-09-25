import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { friendLocationContext } from '@/lib/friend-location';
import { planAreasForMetro, planAreaDistance } from '@/lib/neighborhoods';
import { validatePlanLocation } from '@/lib/plan-location';
import { dateParticipant, dateRequestEligible, dateVenue, publicDatePerson } from '@/lib/date-plan-policy';
import { DATE_PERSON_COLUMNS } from '@/lib/date-plan-server';
import { rateLimit } from '@/lib/rate-limit';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const context = await friendLocationContext(user);
  if (!user.age || user.age < 18) return NextResponse.json({ activities: [] });
  const near = req.nextUrl.searchParams.get('near');
  const origin = near && planAreasForMetro(context.metro).includes(near) ? near : context.area;
  const plan = req.nextUrl.searchParams.get('plan');
  if (plan && !/^[0-9a-f-]{36}$/i.test(plan)) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
  let q = supabaseAdmin.from('connection_date_plans').select('*').eq('is_test', user.is_test === true).order('created_at', { ascending: false }).limit(100);
  if (plan) q = q.eq('id', plan);
  else q = q.or(`and(metro.eq.${context.metro},state.eq.open,expires_at.gt.${new Date().toISOString()}),host_id.eq.${user.id},guest_id.eq.${user.id}`);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load date invitations.' }, { status: 503 });
  const ids = [...new Set((rows || []).flatMap(p => [p.host_id, ...(p.guest_id ? [p.guest_id] : [])]))];
  const [people, reports, requests] = await Promise.all([
    supabaseAdmin.from('users').select(DATE_PERSON_COLUMNS).in('id', ids.length ? ids : [user.id]).eq('is_test', user.is_test === true).gte('age', 18).is('deleted_at', null).neq('is_blocked', true),
    supabaseAdmin.from('user_reports').select('reporter_id,reported_id').or(`reporter_id.eq.${user.id},reported_id.eq.${user.id}`),
    fetchAllSupabaseRows<{id:string;plan_id:string;user_id:string;status:string}>((from,to)=>supabaseAdmin.from('connection_date_requests').select('id,plan_id,user_id,status').in('plan_id', rows?.length ? rows.map(p => p.id) : ['00000000-0000-0000-0000-000000000000']).order('id').range(from,to))
      .then(data=>({data,error:null})).catch(()=>({data:null,error:{message:'Could not load requests'}})),
  ]);
  if (people.error || reports.error || requests.error) return NextResponse.json({ error: 'Could not verify date invitations.' }, { status: 503 });
  const blocked = new Set((reports.data || []).map(r => r.reporter_id === user.id ? r.reported_id : r.reporter_id));
  const byId = new Map((people.data || []).map(p => [p.id, p]));
  const hostRequests = (requests.data || []).filter(r => rows?.some(p => p.id === r.plan_id && p.host_id === user.id) && r.status === 'pending');
  const candidates = hostRequests.length ? await supabaseAdmin.from('users').select(DATE_PERSON_COLUMNS).in('id', hostRequests.map(r => r.user_id)).eq('is_test', user.is_test === true).gte('age',18).is('deleted_at',null).neq('is_blocked',true) : {data:[],error:null};
  if (candidates.error) return NextResponse.json({ error: 'Could not load date requests.' }, { status: 503 });
  const candidatesById = new Map((candidates.data || []).map(p => [p.id, p]));
  const activities = (rows || []).filter(p => {
    if (!byId.has(p.host_id) || blocked.has(p.host_id) || (p.guest_id && (!byId.has(p.guest_id) || blocked.has(p.guest_id)))) return false;
    return dateParticipant(p,user.id) || (p.state === 'open' && p.metro === context.metro && Date.parse(p.expires_at)>Date.now() && (!p.happens_at || Date.parse(p.happens_at)>Date.now()));
  }).map(p => {
    const mine = p.host_id === user.id;
    const confirmed = !!p.guest_id && dateParticipant(p,user.id);
    const hidden = p.mode === 'blind' && !mine && !confirmed;
    const host = publicDatePerson(byId.get(p.host_id)!, hidden);
    const response = requests.data?.find(r => r.plan_id === p.id && r.user_id === user.id)?.status || null;
    return {
      id:p.id, title:p.title, body:p.body, kind:'event', category:'date', connectionKind:'date', dateMode:p.mode, state:p.state,
      area:p.area, location:dateVenue(p,user.id), locationHidden:!!p.venue && !dateParticipant(p,user.id), locationVisibility:'participants',
      distanceMiles:p.metro===context.metro?planAreaDistance(context.metro,origin,p.area):null, locationAreas:mine?planAreasForMetro(p.metro):undefined, happens_at:p.happens_at, expires_at:p.expires_at, created_at:p.created_at,
      authorName:host.name, authorPhoto:host.photo, authorProfile:host, isMine:mine, eligible:dateRequestEligible(p,user), datingFriendly:true,
      capacity:2, myResponse:confirmed?'yes':response, responses:{yes:confirmed?2:1,maybe:0,no:0}, canChat:confirmed,
      audienceGender:p.genders, partner:confirmed ? publicDatePerson(byId.get(mine?p.guest_id:p.host_id)!,false) : null,
      requests:mine ? hostRequests.filter(r=>r.plan_id===p.id && candidatesById.has(r.user_id) && !blocked.has(r.user_id)).map(r=>({id:r.id,profile:publicDatePerson(candidatesById.get(r.user_id)!,p.mode==='blind')})) : [],
    };
  });
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({key:`create-date:${user.id}`,windowSec:3600,maxAttempts:10,blockSec:900});
  if (!limit.ok) return NextResponse.json({error:'Please wait before posting another date.'},{status:429});
  const context = await friendLocationContext(user);
  if (!context.metro || !user.age || user.age<18 || !['m','f','nb'].includes(user.gender)) return NextResponse.json({error:'Complete your age, gender, and area in your profile first.'},{status:400});
  const body = await req.json().catch(()=>({}));
  try {
    const location = validatePlanLocation({...body,visibility:'participants'},planAreasForMetro(context.metro));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.client_id || '')) throw Error('Invalid invitation request.');
    const title = String(body.title || '').trim(), detail = String(body.body || '').trim();
    if (!title || title.length>140 || detail.length>1000) throw Error('Check the invitation title and description.');
    if (!['profile','blind'].includes(body.date_mode)) throw Error('Choose a date style.');
    const genders = Array.isArray(body.genders) ? [...new Set<string>(body.genders.filter((g:string)=>['m','f','nb'].includes(g)))] : [];
    if (!genders.length) throw Error('Choose who you would like to meet.');
    const when = body.happens_at ? new Date(body.happens_at) : null;
    if (when && (!Number.isFinite(when.getTime()) || when.getTime()<=Date.now())) throw Error('Choose a future time.');
    const {error} = await supabaseAdmin.from('connection_date_plans').insert({id:body.client_id,host_id:user.id,title,body:detail||null,metro:context.metro,area:location.area,venue:location.location,mode:body.date_mode,genders,happens_at:when?.toISOString()||null,expires_at:new Date(when?when.getTime()+43200000:Date.now()+14*86400000).toISOString(),is_test:user.is_test===true});
    if (error) {
      const existing = error.code==='23505' ? await supabaseAdmin.from('connection_date_plans').select('id').eq('id',body.client_id).eq('host_id',user.id).maybeSingle() : null;
      if (!existing?.data) return NextResponse.json({error:'Publication not confirmed. Retry this same invitation.'},{status:503});
    }
    return NextResponse.json({ok:true,id:body.client_id});
  } catch(e) { return NextResponse.json({error:(e as Error).message},{status:400}); }
}
