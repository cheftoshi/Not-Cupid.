// Aggregate only. This module never returns member IDs or message/feedback text.
const day = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const unique = (rows, key) => new Set(rows.map(key)).size;
const counts = rows => ({observations:rows.length,members:unique(rows,r=>r.user_id)});
const group = (rows, key, summarize = counts) => Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,summarize(rows.filter(r=>key(r)===k))]));
const source = id => id?.startsWith('live:tm:') ? 'ticketmaster' : id?.startsWith('live:curated:') ? 'curated' : 'unknown';

export function summarizeFriendMeasurement(input, {start,end,adminEmails}) {
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(start)>=Date.parse(end) || !adminEmails?.length) throw Error('Invalid reporting configuration');
  const admins=new Set(adminEmails.map(s=>s.trim().toLowerCase()));
  const eligible=new Set(input.users.filter(u=>!u.is_test&&!u.is_blocked&&!u.deleted_at&&!admins.has(u.email?.trim().toLowerCase())).map(u=>u.id));
  const before=t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<Date.parse(end);
  const within=t=>before(t)&&Date.parse(t)>=Date.parse(start);
  const real=rows=>rows.filter(r=>eligible.has(r.user_id));
  const events=real(input.events).filter(r=>before(r.created_at));
  const interval=events.filter(r=>within(r.created_at));
  const deliveries=real(input.deliveries).filter(r=>before(r.claimed_at));
  const byDelivery=new Map(deliveries.map(d=>[d.id,d]));
  const attrs=input.attributions.filter(a=>byDelivery.has(a.delivery_id)&&before(a.occurred_at));
  const accepted=d=>d.accepted_at&&before(d.accepted_at);
  const observed=events.filter(e=>['outside_event_panel_open','outside_event_impression'].includes(e.event_name));
  const days=new Map();
  for(const e of observed) { const set=days.get(e.user_id)||new Set();set.add(day(e.created_at));days.set(e.user_id,set); }
  const cohorts=new Map();
  for(const [id,seen] of days) {const first=[...seen].sort()[0];const rows=cohorts.get(first)||[];rows.push({user_id:id,returned:[...seen].some(d=>d>first)});cohorts.set(first,rows);}
  const plans=input.plans.filter(p=>!p.is_test&&eligible.has(p.author_id)&&source(p.external_event_id)!=='unknown'&&before(p.created_at));
  const planIds=new Set(plans.map(p=>p.id));
  const comments=real(input.comments).filter(c=>planIds.has(c.activity_id)&&before(c.created_at));
  const feedback=real(input.feedback).filter(f=>f.plan_kind==='friend'&&planIds.has(f.plan_id)&&before(f.updated_at));
  const categoryByPlan=new Map(events.filter(e=>e.event_name==='outside_event_plan_create'&&e.metadata?.category).map(e=>[e.metadata.plan_id,e.metadata.category]));
  const dimensions=e=>({source:source(e.metadata?.event_id),category:e.metadata?.category||categoryByPlan.get(e.metadata?.plan_id)||'unknown'});
  const funnel=rows=>group(rows,r=>r.event_name,rs=>({...counts(rs),sessions:unique(rs.filter(r=>r.session_id),r=>`${r.user_id}:${r.session_id}`),plans:unique(rs.filter(r=>r.metadata?.plan_id),r=>r.metadata.plan_id)}));
  const campaigns=group(deliveries,d=>`${d.campaign_id}:${d.channel}`,ds=>{
    const ids=new Set(ds.map(d=>d.id));
    const touches=attrs.filter(a=>ids.has(a.delivery_id));
    const tagged=events.filter(e=>ids.has(e.metadata?.campaign_delivery_id)&&byDelivery.get(e.metadata.campaign_delivery_id)?.user_id===e.user_id);
    return {claimedMembers:unique(ds,d=>d.user_id),providerAcceptedMembers:unique(ds.filter(accepted),d=>d.user_id),emailDeliveredMembers:unique(ds.filter(d=>d.channel==='email'&&d.delivered_at&&before(d.delivered_at)),d=>d.user_id),currentStatuses:group(ds,d=>d.status),complaintMembers:unique(ds.filter(d=>d.complained_at&&before(d.complained_at)),d=>d.user_id),acceptedPushDevices:input.pushReceipts.filter(r=>ids.has(r.delivery_id)&&r.outcome==='accepted'&&before(r.recorded_at)).length,attributedMembers:group(touches,a=>a.event,rs=>({members:unique(rs,a=>byDelivery.get(a.delivery_id).user_id)})),intervalAttributedMembers:group(touches.filter(a=>within(a.occurred_at)),a=>a.event,rs=>({members:unique(rs,a=>byDelivery.get(a.delivery_id).user_id)})),observedFunnel:funnel(tagged),intervalObservedFunnel:funnel(tagged.filter(e=>within(e.created_at)))};
  });
  return {start,end,errors:[],truncated:false,deliveryAccounting:group(input.deliveries.filter(d=>before(d.claimed_at)),d=>`${d.campaign_id}:${d.channel}`,ds=>({ledgerRows:ds.length,providerAcceptedRows:ds.filter(accepted).length,emailDeliveredRows:ds.filter(d=>d.channel==='email'&&d.delivered_at&&before(d.delivered_at)).length,excludedFromMemberMetrics:ds.filter(d=>!eligible.has(d.user_id)).length})),intervalFunnel:funnel(interval),intervalByEvent:group(interval,e=>e.metadata?.event_id||'none',funnel),intervalBySource:group(interval,e=>dimensions(e).source,funnel),intervalByCategory:group(interval,e=>dimensions(e).category,funnel),campaigns,
    observedRetention:[...cohorts].sort().map(([firstObservedEasternDay,rows])=>({firstObservedEasternDay,members:rows.length,laterDayObservedMembers:rows.filter(r=>r.returned).length,hasCompletedLaterDay:firstObservedEasternDay<day(new Date(Date.parse(end)-86400000).toISOString())})),
    outsidePlans:{createdInInterval:plans.filter(p=>within(p.created_at)).length,chatMessagesInInterval:counts(comments.filter(c=>within(c.created_at))),plansWithTwoRealChatContributors:plans.filter(p=>unique(comments.filter(c=>c.activity_id===p.id),c=>c.user_id)>=2).length,feedbackUpdatedInInterval:counts(feedback.filter(f=>within(f.updated_at))),currentSelfReportedMet:counts(feedback.filter(f=>f.met===true)),currentSelfReportedNotMet:counts(feedback.filter(f=>f.met===false))},
    ownerReviews:{acceptedCopiesExcluded:input.ownerReviews.filter(r=>r.accepted_at&&before(r.accepted_at)).length},
    limitations:['Observational associations, not causal lift. Channels overlap; never sum channel members.','Push acceptance is not device display; organizer clicks do not establish ticket purchase or attendance.','Chat counts exclude message content. Two contributors establish a multi-person conversation, not attendance.','Feedback is mutable self-report, not verified attendance. Existing eligibility and delivery statuses are mutable.','Retention uses first observed discovery day, not signup or campaign day. Recent cohorts have incomplete follow-up; no causal or fixed-window retention rate.','Category unknown means no original creation snapshot; never infer category from a plan title.','Telemetry is best-effort. Reads are paginated, not a transactional snapshot. Owner copies are excluded from campaign attribution.']};
}
