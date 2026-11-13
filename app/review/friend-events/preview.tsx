'use client';
import { useEffect, useRef, useState } from 'react';
import EventDiscovery, { type DiscoveryStatus } from '@/app/hub/event-discovery';
import type { CityEvent } from '@/lib/city-events';
import type { ConnectionPlan } from '@/lib/connection-plans';
import h from '@/app/hub/plans-home.module.css';
import s from './preview.module.css';
const now = Date.parse('2026-11-10T17:00:00Z');
const events: CityEvent[] = [
  ['A little jazz, a late night','Example listening room','music',0,24],
  ['Laugh until the last train','Example comedy stage','arts',1,18],
  ['A night under the arena lights','Example arena','sports',2,null],
  ['Sunday sounds, together','Example community stage','music',5,0],
  ['The small-stage spectacular','Example theater','arts',3,32],
  ['A weekend on the sidelines','Example sports field','sports',4,0],
  ['One more song before home','Example music hall','music',6,21],
].map(([title,venue,category,day,price],i) => ({id:`synthetic-${i}`,title:String(title),venue:String(venue),category:category as CityEvent['category'], startsAt:new Date(now+Number(day)*86400000+6*3600000).toISOString(),url:'https://www.ticketmaster.com/',price:price === null ? null : {min:Number(price),max:Number(price),currency:'USD'}}));
const curatedEvents: CityEvent[] = Array.from({length:40},(_,i)=>({
  id:`live:curated:synthetic-${i}`, title:`Synthetic community event ${i+1}`, venue:`Example public venue ${i+1}`,
  category: (['music','arts','sports','food','outdoors','community'] as const)[i%6],
  startsAt:new Date(now+(i===39?30:i%7)*86400000+6*3600000).toISOString(),url:`https://example.test/events/${i}`,
  price:i%2===0?{min:0,max:0,currency:'USD'}:null,sourceLabel:'Synthetic local organizer',sourceCheckedAt:new Date(now).toISOString(),curated:true,
}));
const initialPlan: ConnectionPlan = {id:'synthetic-member-plan',title:'Example member invitation',authorId:'synthetic-member',authorName:'Sample member',kind:'event',category:'friends',created_at:new Date(now).toISOString(),externalEventId:'synthetic-1',isMine:false,eligible:true,datingFriendly:false,responses:{yes:1,maybe:0,no:0},capacity:4};
export default function Preview(){
  const [ready,setReady] = useState(false);
  const [curatedMode,setCuratedMode] = useState(false);
  const [highlight,setHighlight] = useState('');
  useEffect(() => {const params=new URLSearchParams(globalThis.location.search);setCuratedMode(params.get('curated')==='1');setHighlight(params.get('event')||'');setReady(true);}, []);
  const [status,setStatus] = useState<DiscoveryStatus>('ready');
  const [empty,setEmpty] = useState(false);
  const [plans,setPlans] = useState<ConnectionPlan[]>([initialPlan]);
  const [selected,setSelected] = useState<CityEvent|null>(null);
  const [opened,setOpened] = useState<ConnectionPlan|null>(null);
  const [published,setPublished] = useState(false);
  const [closed,setClosed] = useState(false);
  const [key,setKey] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const focus = useRef<HTMLElement|null>(null);
  useEffect(() => {if(selected || opened){focus.current=document.activeElement as HTMLElement; dialog.current?.showModal();}else {dialog.current?.close();focus.current?.focus();}},[selected,opened]);
  const close = () => {setSelected(null);setOpened(null);setPublished(false);};
  return <main className={h.home} data-preview-ready={ready}><div className={h.wrap}>
    <aside className={s.review}><strong>LOCAL DESIGN PLAYGROUND · SYNTHETIC DATA</strong><p>Sample events · nothing is sent or saved.</p><details><summary>Playground controls</summary><div><label>Test state <select aria-label="Test state" value={empty ? 'empty' : status} onChange={e => {setEmpty(e.target.value==='empty');setStatus(e.target.value==='empty'?'ready':e.target.value as DiscoveryStatus);}}><option value="ready">Loaded</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="unavailable">Error</option></select></label><button onClick={() => {close();setPlans([initialPlan]);setStatus('ready');setEmpty(false);setClosed(false);setKey(k=>k+1);}}>Reset playground</button><button onClick={() => {document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Toggle theme</button></div></details></aside>
    {closed ? <button onClick={() => setClosed(false)}>Open event discovery</button> : <EventDiscovery key={key} city="Boston" events={empty?[]:curatedMode?curatedEvents:events} highlight={highlight} plans={plans} status={status} fetchedAt={new Date(now).toISOString()} now={now} onRetry={()=>{setStatus('ready');setEmpty(false);}} onChoose={setSelected} onOpen={setOpened} onClose={()=>setClosed(true)}/>}
    <section id="home-invitations" className={s.member}><span>MEMBER PLANS · SAMPLE ONLY</span><h2>People make the plan.</h2><p>Real member invitations and existing chats remain a separate destination below discovery.</p><button onClick={()=>setOpened(initialPlan)}>Inspect sample member invitation</button></section>
    <dialog ref={dialog} className={s.dialog} onCancel={close} aria-labelledby="review-title"><button className={s.close} onClick={close} aria-label="Close review">×</button>
      <p className={s.eyebrow}>In-memory simulation · nothing is sent</p><h2 id="review-title">{opened ? 'Sample invitation' : published ? 'Mock invitation saved' : 'Make it a plan.'}</h2>
      <h3>{selected?.title || opened?.title}</h3>
      {opened ? <><p>This represents an existing member plan. In the real app, eligibility, available places and RSVP decide access to its participant-only chat.</p><p>{opened.body || "Anyone up for going together?"}</p><p>Group size: {opened.capacity}, including the host.</p><p>No private meeting place or real member data is shown here.</p><button onClick={close}>Back to events</button></> : published ? <><p>Your sample plan is now attached to this card in this browser session. No account, API write, email or ticket purchase occurred.</p><button onClick={close}>Back to events</button></> : <form key={selected?.id} onSubmit={e=>{e.preventDefault();if(!selected)return;const values=new FormData(e.currentTarget);setPlans(p=>p.some(x=>x.externalEventId===selected.id && x.isMine)?p:[...p,{...initialPlan,id:`mine-${selected.id}`,externalEventId:selected.id,title:selected.title,body:String(values.get('body')),capacity:Number(values.get('capacity')),isMine:true,authorName:'You'}]);setPublished(true);}}><p>The real app opens the existing invitation form, rechecks the event, and publishes only after your explicit action.</p><label>Your invitation<textarea name="body" required maxLength={200} defaultValue="Anyone up for going together? Let’s meet there."/></label><label>Group size, including you<select name="capacity" defaultValue="4">{[2,3,4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}</select></label><p>Meeting-place details stay participant-only. Admission is separate.</p><button type="submit">Save mock invitation</button><button type="button" onClick={close}>Cancel</button></form>}
    </dialog>
  </div></main>;
}
