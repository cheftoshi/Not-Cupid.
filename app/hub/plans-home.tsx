'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJsonWithTimeout } from '@/lib/fetch-helpers';
import { ConnectionPlan, liveConnectionPlans, planHasEnded, planChatAllowed, planEndpoint } from '@/lib/connection-plans';
import { CreateInvitation, DateInvitation, MeetingPlace, LocationEditor } from './plan-controls';
import { useChatRealtime } from '@/lib/use-chat-realtime';
import s from './plans-home.module.css';

type Message = { id: string; body: string; name: string; isMe: boolean; clientId?: string | null };

function PlanChat({ plan, active }: { plan: ConnectionPlan; active: boolean }) {
  const id = plan.id;
  const endpoint = planEndpoint(plan) + (plan.connectionKind === 'date' ? '/messages' : '/comments');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const inFlight = useRef(false);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const busy = useRef(false);
  const messageRevision = useRef(0);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const revision = messageRevision.current;
    try {
      const { response, data } = await fetchJsonWithTimeout(endpoint, { cache: 'no-store' });
      if (!response.ok || !Array.isArray(data?.comments)) throw Error('Could not load the chat. Check your connection and retry.');
      if (revision === messageRevision.current) setMessages(data.comments);
      setTopic(data.realtimeTopic || null); setLoaded(true); setError('');
    } catch { setError('Could not load the chat. Your draft is still here.'); }
    finally { inFlight.current = false; }
  }, [endpoint]);
  const connected = useChatRealtime(active ? topic : null, load);
  useEffect(() => {
    if (!active) return;
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, connected ? 60_000 : 15_000);
    return () => window.clearInterval(timer);
  }, [load, connected, active]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim(); if (!body || busy.current) return;
    busy.current = true; setSending(true); setError('');
    if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
    const key = retry.current.key;
    try {
      const { response, data } = await fetchJsonWithTimeout(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, client_id: key }),
      });
      if (!response.ok || !data?.comment?.id) throw Error('Send not confirmed.');
      messageRevision.current++;
      setMessages(previous => [...previous.filter(m => m.id !== data.comment.id && m.clientId !== key), data.comment]);
      setDraft(current => current.trim() === body ? '' : current); retry.current = null;
    } catch { setError('Send not confirmed. Your text is saved here; retry uses the same message ID.'); }
    finally { busy.current = false; setSending(false); }
  }
  return <section className={s.chat} aria-label="Plan chat">
    <p className={s.muted}>{plan.connectionKind === 'date' ? 'Private conversation for your confirmed date.' : 'Visible to the host and joined participants.'} Agree on the details before heading out.</p>
    {!loaded && !error && <p role="status">Loading conversation…</p>}
    {error && <div className={s.error} role="alert">{error} <button type="button" onClick={() => void load()}>Reload chat</button></div>}
    <div className={s.messages}>
      {messages.map(m => <div key={m.id} className={s.message}><small>{m.isMe ? 'You' : m.name}</small><p>{m.body}</p></div>)}
      {loaded && !error && messages.length === 0 && <p className={s.muted}>Be the first to say hello.</p>}
    </div>
    <form className={s.composer} onSubmit={send}>
      <label>Message the plan<textarea value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} /></label>
      <button className={s.primary} disabled={sending || !draft.trim() || plan.state === 'cancelled'}>{plan.state === 'cancelled' ? 'Date cancelled' : sending ? 'Sending…' : 'Send message'}</button>
    </form>
  </section>;
}

function PlanCard({ plan, onChange, onOpen }: { plan: ConnectionPlan; onChange: () => Promise<void>; onOpen: (plan: ConnectionPlan) => void }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const canChat = plan.isMine || plan.myResponse === 'yes';
  const full = plan.capacity != null && plan.responses.yes >= plan.capacity;
  const ended = planHasEnded(plan);
  async function cancel() {
    if (pending.current || !window.confirm('Cancel this plan? Tell participants in the conversation so they know not to travel.')) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const {response,data}=await fetchJsonWithTimeout(planEndpoint(plan),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel'})});
      if(!response.ok||!data?.ok)throw Error(data?.error||'Cancellation was not confirmed.');
      await onChange();
    } catch(e) {setError(e instanceof Error?e.message:'Cancellation was not confirmed.');}
    finally {pending.current=false;setBusy(false);}
  }
  async function respond(response: 'yes' | 'no') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { response: res, data } = await fetchJsonWithTimeout(`/api/friend/activities/${plan.id}/rsvp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'set', response: plan.myResponse === response ? null : response }),
      });
      if (!res.ok || !data?.ok) throw Error(data?.error || 'Could not save your response. Refresh the plans before trying again.');
      await onChange();
      if (data.myResponse === 'yes') onOpen({ ...plan, myResponse: data.myResponse, responses: data.responses });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your response.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <article className={s.card} aria-label={plan.title} id={`home-plan-${plan.id}`}>
    <div className={s.host}>{plan.authorPhoto && <img src={plan.authorPhoto} alt="" loading="lazy" referrerPolicy="no-referrer" />}<span>{plan.authorName || 'A member'}{plan.isMine ? ' · Your plan' : ' is making a plan'}</span></div>
    <span className={s.badge}>{plan.datingFriendly ? 'Dating-friendly' : 'Friends'}</span>
    <span className={s.badge}>{plan.capacity === 2 ? 'One-on-one' : 'Group plan'}</span>
    <h2>{plan.title}</h2>
    {plan.body && <p>{plan.body}</p>}
    <div className={s.details}>
      <div>{plan.happens_at ? new Date(plan.happens_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Find a time together'}</div>
      <MeetingPlace plan={plan}/>
      <div>{plan.responses.yes} joined{plan.capacity ? ` · ${Math.max(0, plan.capacity - plan.responses.yes)} spots left` : ''}{ended ? ' · Past plan' : ''}</div>
    </div>
    {plan.datingFriendly && <p className={s.muted}>Open to a date, not a confirmed match. A yes joins the plan chat; it does not create a Love match.</p>}
    <div className={s.actions}>
      {!plan.isMine && <>
        <button className={s.primary} disabled={busy || (!plan.eligible && plan.myResponse !== 'yes') || (ended && plan.myResponse !== 'yes') || (full && plan.myResponse !== 'yes')}
          onClick={() => void respond('yes')}>{plan.myResponse === 'yes' ? 'Withdraw my yes' : ended ? 'Plan ended' : full ? 'Plan full' : 'Yes, I’m interested'}</button>
        {plan.myResponse !== 'yes' && <button disabled={busy} onClick={() => void respond('no')}>{plan.myResponse === 'no' ? 'Undo pass' : 'No thanks'}</button>}
      </>}
      {canChat && <button onClick={() => onOpen(plan)}>Open conversation ↗</button>}
      {plan.isMine && !ended && <button disabled={busy} onClick={()=>void cancel()}>Cancel plan</button>}
    </div>
    {!plan.eligible && <p className={s.muted}>This plan has audience requirements. No response has been sent.</p>}
    {error && <p className={s.error} role="alert">{error}</p>}
  </article>;
}

export default function PlansHome({city,firstName='friend',initialFilter='friends'}:{city:string|null;firstName?:string;initialFilter?:string}){
  const [plans,setPlans]=useState<ConnectionPlan[]>([]),[rooms,setRooms]=useState<ConnectionPlan[]>([]),[areas,setAreas]=useState<string[]>([]),[origin,setOrigin]=useState(''),[near,setNear]=useState(''),[radius,setRadius]=useState('all'),[filter,setFilter]=useState(initialFilter),[creating,setCreating]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[roomId,setRoomId]=useState<string|null>(null),[sheet,setSheet]=useState(false),[narrow,setNarrow]=useState(false),[editing,setEditing]=useState(false),[opened,setOpened]=useState<string[]>([]);
  const pending=useRef(false),aside=useRef<HTMLElement>(null),returnFocus=useRef<HTMLElement|null>(null),deepLinked=useRef(false);
  const load=useCallback(async()=>{
    if(pending.current)return;pending.current=true;setError('');
    try{const suffix=near?'&near='+encodeURIComponent(near):'';
      const [feed,inbox,dates]=await Promise.all([fetchJsonWithTimeout('/api/friend/activities?surface=home'+suffix,{cache:'no-store'}),fetchJsonWithTimeout('/api/friend/activities?surface=home&scope=conversations',{cache:'no-store'}),fetchJsonWithTimeout('/api/date-plans?surface=home'+suffix,{cache:'no-store'})]);
      for(const r of [feed,inbox,dates])if(!r.response.ok||!Array.isArray(r.data?.activities))throw Error(r.data?.error||'Could not load invitations. Please retry.');
      const all:ConnectionPlan[]=[...feed.data.activities,...dates.data.activities];const conversations:ConnectionPlan[]=[...inbox.data.activities,...dates.data.activities.filter(planChatAllowed)];
      setAreas(feed.data.areas||[]);setOrigin(feed.data.origin||'');
      if(!deepLinked.current){const search=new URLSearchParams(window.location.search),date=search.get('date'),id=date||search.get('plan');if(id&&/^[a-f0-9-]{36}$/i.test(id)){
        const found=await fetchJsonWithTimeout(date?'/api/date-plans?plan='+id:'/api/friend/activities?surface=home&plan='+id,{cache:'no-store'});const p=found.data?.activities?.[0];
        if(found.response.ok&&p){if(!all.some(x=>x.id===p.id))all.unshift(p);if(planChatAllowed(p)){if(!conversations.some(x=>x.id===p.id))conversations.unshift(p);setRoomId(id);setOpened([id]);setSheet(true);}else setFilter('all');}
        else setNotice('That invitation is no longer available to you.');
      }deepLinked.current=true;}
      setPlans(all);setRooms(conversations);
    }catch(e){setError(e instanceof Error?e.message:'Could not load invitations.');}finally{pending.current=false;setLoading(false);}
  },[near]);
  useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>clearInterval(timer);},[load]);
  useEffect(()=>{const mq=matchMedia('(max-width: 900px)');const update=()=>setNarrow(mq.matches);update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);},[]);
  useEffect(()=>{if(!sheet||!narrow)return;const panel=aside.current;panel?.querySelector<HTMLElement>('button')?.focus();const key=(e:KeyboardEvent)=>{
    if(e.key==='Escape')setSheet(false);
    if(e.key==='Tab'&&panel){const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')).filter(n=>n.getClientRects().length);const a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b?.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a?.focus();}}
  };document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);returnFocus.current?.focus();};},[sheet,narrow]);
  const all=[...new Map([...rooms,...plans].map(p=>[p.id,p])).values()],room=all.find(p=>p.id===roomId&&planChatAllowed(p));
  const upcoming=all.find(p=>planChatAllowed(p)&&!planHasEnded(p)&&p.state!=='cancelled');
  const live=filter==='mine'?all.filter(p=>p.isMine||planChatAllowed(p)||p.myResponse==='pending'):liveConnectionPlans(plans);
  const shown=live.filter(p=>filter==='mine'||(filter==='passed'?p.myResponse==='no':p.myResponse!=='no'&&(filter==='all'||(filter==='dating'?p.connectionKind==='date':p.connectionKind!=='date')))).filter(p=>filter==='mine'||radius==='all'||(p.distanceMiles!=null&&p.distanceMiles<=Number(radius)));
  const requests=plans.reduce((n,p)=>n+(p.requests?.length||0),0);
  function open(p:ConnectionPlan){returnFocus.current=document.activeElement as HTMLElement;setRoomId(p.id);setOpened(prev=>prev.includes(p.id)?prev:[...prev,p.id]);setSheet(true);setEditing(false);}
  return <main className={s.home} data-perf-region="hub"><div className={s.wrap}>
    <header className={s.header}><div><span className={s.eyebrow}>Your home · {city||'Your local community'}</span><h1>Good to see you, {firstName}.</h1><p>A familiar face. A new connection. Something to look forward to.</p></div><button className={s.primary} onClick={()=>setCreating(!creating)}>＋ Invite someone</button></header>
    <div className={s.highlights}><button onClick={()=>upcoming?open(upcoming):setCreating(true)}><span className={s.eyebrow}>Coming up</span><strong>{upcoming?.title||'Leave a little room for good company.'}</strong><small>{upcoming?'Continue the conversation ↗':'Your next get-together starts with an invitation.'}</small></button><button onClick={()=>{if(requests)setFilter('mine');else if(rooms[0])open(rooms[0]);else setFilter('all');}}><span className={s.eyebrow}>Your connections</span><strong>{requests?requests+' date request'+(requests===1?'':'s')+' to review':rooms.length?rooms.length+' conversation'+(rooms.length===1?'':'s')+' to come back to':'A little closer to your people.'}</strong><small>{requests?'You choose who joins your date.':'Pick up where you left off.'}</small></button></div>
    {creating&&<CreateInvitation areas={areas} origin={origin} onClose={()=>setCreating(false)} onCreated={()=>{setCreating(false);setFilter('mine');setNotice('Your invitation is published.');void load();}}/>}
    {error&&<div role="alert" className={s.error}>{error} <button onClick={()=>void load()}>Retry plans</button></div>}{notice&&<div role="status" className={s.notice}>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
    <div className={s.columns}><section className={s.feed} aria-label="Discover invitations"><div className={s.sectionHead}><div><span className={s.eyebrow}>A little closer to your people</span><h2>Around you</h2></div><Link href="/friends">Change city in Friend Line</Link></div>
      <div className={s.locationFilters}><label>Near<select value={near||origin} onChange={e=>setNear(e.target.value)}>{!areas.includes(origin)&&<option value={origin}>{origin||'Your area'}</option>}{areas.map(a=><option key={a}>{a}</option>)}</select></label><label>Distance<select value={radius} onChange={e=>setRadius(e.target.value)}><option value="all">Whole city</option>{[1,5,10,25].map(n=><option key={n} value={n}>Within {n} mi</option>)}</select></label></div><small className={s.muted}>Approximate neighborhood-to-neighborhood distance, not directions or live location. Unknown distances appear under Whole city.</small>
      <nav className={s.filters} aria-label="Filter plans">{[['all','Discover'],['friends','Friends'],['dating','Dates'],['mine','Your invitations'],['passed','Passed']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</nav>
      {loading&&<p role="status">Loading member invitations…</p>}<div className={s.grid}>{shown.map(p=>p.connectionKind==='date'?<DateInvitation key={p.id} plan={p} onChange={load} onOpen={open}/>:<PlanCard key={p.id} plan={p} onChange={load} onOpen={open}/>)}</div>
      {!loading&&!error&&!shown.length&&<section className={s.empty}><h2>Be the start of something.</h2><p>No invitations in this view yet. Try a wider distance or invite someone for a walk, lunch, or a date.</p><button onClick={()=>setCreating(true)}>Create a real invitation</button></section>}
    </section>
    {narrow&&sheet&&<div className={s.backdrop} onClick={()=>setSheet(false)} aria-hidden="true"/>}
    <aside ref={aside} className={s.sidebar+' '+(sheet?s.sheetOpen:'')} role={narrow&&sheet?'dialog':undefined} aria-modal={narrow&&sheet?true:undefined} aria-label="Your conversations"><div className={s.sectionHead}><div><span className={s.eyebrow}>Keep the connection going</span><h2>Your conversations</h2></div>{narrow&&<button aria-label="Close conversations" onClick={()=>setSheet(false)}>×</button>}</div>
      <div className={s.roomList}>{rooms.map(p=><button key={p.id} aria-pressed={room?.id===p.id} onClick={()=>open(p)}>{p.title}<small>{p.connectionKind==='date'?'Private date':'Plan chat'}</small></button>)}</div>
      {room?<><div className={s.roomTitle}><h3>{room.title}</h3>{room.partner&&<div className={s.profile}><strong>{room.partner.name}{room.partner.age?', '+room.partner.age:''}</strong>{room.partner.photo&&<img src={room.partner.photo} alt="" referrerPolicy="no-referrer"/>}<p>{room.partner.bio}</p><small>{room.partner.interests.join(' · ')}</small></div>}<MeetingPlace plan={room}/>{room.isMine&&!editing&&<button onClick={()=>setEditing(true)}>{room.location?'Edit meeting place':'Set meeting place'}</button>}</div>{editing&&room.isMine&&<LocationEditor key={room.id} plan={room} areas={areas} onSaved={load} onClose={()=>setEditing(false)}/>}</>:<p className={s.muted}>Join a plan or accept a date request. Your conversation will open here.</p>}
      {opened.map(id=>{const p=all.find(item=>item.id===id&&planChatAllowed(item));return p?<div key={id} hidden={room?.id!==id}><PlanChat plan={p} active={room?.id===id&&(!narrow||sheet)}/></div>:null;})}
    </aside></div>
    {narrow&&<button className={s.mobileChat} onClick={()=>{if(room)open(room);else if(rooms[0])open(rooms[0]);else setSheet(true);}}>Conversations · {rooms.length}</button>}
    <footer className={s.footer}><button disabled={loading} onClick={()=>void load()}>Refresh invitations</button><Link href="/hub?view=coach">Ask your AI coach</Link><Link href="/dashboard">Love Line</Link><Link href="/friends">Friend Line</Link><Link href="/safety">Safety & help</Link></footer>
  </div></main>;
}
