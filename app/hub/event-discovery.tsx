'use client';
import { useEffect, useRef, useState } from 'react';
import { trackOutsideEvent } from '@/lib/outside-event-tracking-client';
import { CityEvent, EventWindow, eventInWindow, eventPrice } from '@/lib/city-events';
import { ConnectionPlan } from '@/lib/connection-plans';
import { planWhen } from '@/lib/plan-discovery';
import s from './event-discovery.module.css';

export type DiscoveryStatus = 'loading' | 'ready' | 'unavailable';
const labels = { music: 'Music', arts: 'Arts & comedy', sports: 'Sports', food: 'Food', outdoors: 'Outdoors', community: 'Community' };
export function EventArtwork({ category }: { category: CityEvent['category'] }) {
  return <svg viewBox="0 0 320 150" className={s.art} aria-hidden="true" focusable="false">
    {category === 'music' ? <><circle cx="235" cy="75" r="87" fill="currentColor" opacity=".12"/>{[0,1,2,3,4,5,6,7].map(i => <path key={i} d={`M ${90+i*22} 25 Q ${20+i*22} 75 ${90+i*22} 125`} fill="none" stroke="currentColor" strokeWidth="5"/>)}</>
    : category === 'arts' ? <><path d="M100 140 155 15 245 140Z" fill="currentColor" opacity=".16"/><path d="m177 28 18 36 40-2-28 29 9 39-35-18-34 21 6-40-30-27 40-1Z" fill="none" stroke="currentColor" strokeWidth="6"/><circle cx="275" cy="36" r="15" fill="currentColor"/></>
    : <><circle cx="207" cy="75" r="62" fill="none" stroke="currentColor" strokeWidth="5"/><ellipse cx="207" cy="75" rx="28" ry="62" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M145 75h124M160 34q47 35 94 0M160 116q47-35 94 0" fill="none" stroke="currentColor" strokeWidth="4"/></>}
  </svg>;
}
export default function EventDiscovery({ city, events, plans, status, fetchedAt, highlight = '', onRetry, onChoose, onOpen, onClose, now = Date.now() }: {
  city: string | null; events: CityEvent[]; plans: ConnectionPlan[]; status: DiscoveryStatus;
  fetchedAt?: string; highlight?: string; onRetry: () => void; onChoose: (event: CityEvent) => void;
  onOpen: (plan: ConnectionPlan) => void; onClose?: () => void; now?: number;
}) {
  const root = useRef<HTMLElement>(null);
  const [window, setWindow] = useState<EventWindow>('upcoming');
  const [category, setCategory] = useState('all');
  const [free, setFree] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const reset = () => { trackOutsideEvent('filter',{filter:'reset',value:'all'}); setWindow('upcoming'); setCategory('all'); setFree(false); setQuery(''); setLimit(6); };
  const visible = events.filter(e => eventInWindow(e, window, now) && (category === 'all' || e.category === category) && (!free || e.price?.max === 0) && `${e.title} ${e.venue}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => Number(b.id === highlight) - Number(a.id === highlight) || Date.parse(a.startsAt) - Date.parse(b.startsAt));
  // A rendered card is not an impression: it must be at least half visible for
  // 500ms in a foreground tab. Re-observe after filters/pagination change.
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const clear = (el: Element) => { const timer = timers.get(el); if (timer) clearTimeout(timer); timers.delete(el); };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        clear(entry.target);
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || document.visibilityState !== 'visible') continue;
        timers.set(entry.target, setTimeout(() => {
          if (document.visibilityState === 'visible') {
            const id = entry.target.getAttribute('data-event-id');
            if (id) trackOutsideEvent('impression',{eventId:id});
            else trackOutsideEvent('panel_open');
          }
          timers.delete(entry.target);
        },500));
      }
    }, {threshold:0.5});
    const targets = [...root.current.querySelectorAll('[data-event-id], [data-discovery-heading]')];
    targets.forEach(el=>observer.observe(el));
    const visibility = () => { timers.forEach((_,el)=>clear(el)); if (document.visibilityState === 'visible') {observer.disconnect(); targets.forEach(el=>observer.observe(el));} };
    document.addEventListener('visibilitychange',visibility);
    return () => {observer.disconnect();timers.forEach((_,el)=>clear(el));document.removeEventListener('visibilitychange',visibility);};
  }, [events, status, window, category, free, query, limit]);
  const checked = fetchedAt && Number.isFinite(Date.parse(fetchedAt)) ? new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'}).format(new Date(fetchedAt)) : null;
  return <section ref={root} className={s.discovery} aria-label="Find something to do">
    <header className={s.hero}>
      <div className={s.topline}><span className={s.kicker}>Friend line / {city || 'Your city'}</span>{onClose && <button onClick={onClose} type="button">Close discovery</button>}</div>
      <h2 data-discovery-heading>Good plans.<br/><span>New friends.</span></h2>
      <p>Find something you’re into, then find someone to go with.</p>
      <div className={s.heroFoot}><span>Outside events. Your invitation.</span><a href="#home-invitations">See member plans ↓</a></div>
      <span className={s.heroStamp} aria-hidden="true">GO<br/>TOGETHER ↗</span>
    </header>
    <div className={s.content}>
      <p className={s.attribution}>Outside events, not NotCupid member invitations. Category illustrations, not event photos.</p>
      <div className={s.filters}>
        <label>When<select aria-label="When" value={window} onChange={e => {trackOutsideEvent('filter',{filter:'when',value:e.target.value});setWindow(e.target.value as EventWindow);setLimit(6);}}><option value="upcoming">Upcoming</option><option value="today">Today</option><option value="weekend">This weekend</option><option value="week">Next 7 days</option></select></label>
        <label>What<select aria-label="What" value={category} onChange={e => {trackOutsideEvent('filter',{filter:'category',value:e.target.value});setCategory(e.target.value);setLimit(6);}}><option value="all">All interests</option>{Object.entries(labels).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        <label className={s.search}>Event or venue<input type="search" placeholder="Find your kind of plan" value={query} onChange={e => {setQuery(e.target.value);setLimit(6);}}/></label>
        <label className={s.check}><input type="checkbox" checked={free} onChange={e => {trackOutsideEvent('filter',{filter:'free',value:e.target.checked?'yes':'no'});setFree(e.target.checked);setLimit(6);}}/>Listed as free</label>
      </div>
      <div className={s.results}><p role="status">{status === 'ready' ? `${visible.length} ${visible.length === 1 ? 'idea' : 'ideas'} to go out` : status === 'loading' ? 'Finding your next outing…' : 'Events temporarily unavailable'}</p><button onClick={reset}>Reset filters</button></div>
      {status === 'loading' && <div className={s.state}><span className={s.loading} aria-hidden="true">✳</span><h3>Loading local events</h3><p>Looking for events around {city || 'your city'}.</p></div>}
      {status === 'unavailable' && <div className={s.state}><h3>Events are unavailable right now</h3><p>We couldn’t load outside events. Your member plans and chats are still available.</p><button className={s.primary} onClick={onRetry}>Retry events</button></div>}
      {status === 'ready' && highlight && !events.some(e => e.id === highlight) && <p role="status">That event is no longer in your current city results. Choose another idea or check your city.</p>}
      {status === 'ready' && !visible.length && <div className={s.state}><h3>No events match these filters</h3><p>Try another date or interest, or meet through a member plan below.</p><button onClick={reset}>Show all ideas</button></div>}
      {status === 'ready' && <div className={s.grid}>{visible.slice(0,limit).map(event => {
        const existing = plans.filter(p => p.externalEventId === event.id && p.eligible && p.state !== 'cancelled' && (!p.expires_at || Date.parse(p.expires_at) > now) && (!p.happens_at || Date.parse(p.happens_at) > now) && (p.isMine || p.myResponse === 'yes' || !p.capacity || p.responses.yes < p.capacity));
        const date = new Date(event.startsAt);
        return <article className={s.card} key={event.id} data-category={event.category} data-event-id={event.id}>
          <div className={s.poster}><EventArtwork category={event.category}/><time className={s.date} dateTime={event.startsAt}><span>{new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'America/New_York'}).format(date)}</span><strong>{new Intl.DateTimeFormat('en-US',{day:'numeric',timeZone:'America/New_York'}).format(date)}</strong></time><span className={s.category}>{labels[event.category]}</span></div>
          <div className={s.cardBody}><span className={s.kicker}>Outside event · {event.sourceLabel || 'Ticketmaster'}</span><h3>{event.title}</h3><p className={s.when} suppressHydrationWarning>{planWhen(event.startsAt)}</p><p>{event.venue}</p><p className={s.price}>{eventPrice(event)}</p>{event.sourceCheckedAt && <p>Source checked {new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'}).format(new Date(event.sourceCheckedAt))}</p>}<a onClick={() => trackOutsideEvent('source_click',{eventId:event.id})} href={event.url} target="_blank" rel="noopener noreferrer">Current details & admission ↗<span className={s.srOnly}> (opens new tab)</span></a>
          <div className={s.actions}>{existing.length > 0 && <><p className={s.memberLabel}>Member invitations for this event</p>{existing.map(p => <button key={p.id} onClick={e => { e.currentTarget.focus(); trackOutsideEvent('invitation_open',{eventId:event.id}); onOpen(p); }}>{p.isMine ? 'Open your plan & chat' : `View ${p.authorName?.split(' ')[0] || 'a member'}’s invitation`} →</button>)}</>}{!existing.some(p => p.isMine) && <button className={existing.length ? '' : s.primary} onClick={e => { e.currentTarget.focus(); trackOutsideEvent('plan_start',{eventId:event.id}); onChoose(event); }}>{existing.length ? 'Or start your own invitation' : 'Find people to go with'} <span aria-hidden="true">↗</span></button>}</div></div>
        </article>;
      })}</div>}
      {status === 'ready' && visible.length > limit && <button className={s.more} onClick={() => setLimit(n => n+6)}>Show more ideas ({visible.length-limit} remaining)</button>}
      <footer className={s.footer}>{status === 'ready' && checked && <p suppressHydrationWarning>Last checked {checked} · Times shown in Eastern time.</p>}<p>Choosing an event opens an invitation to review. Nothing is posted until you publish. Joining a plan does not buy admission. Check availability, age restrictions and current prices with the event source.</p></footer>
    </div>
  </section>;
}
