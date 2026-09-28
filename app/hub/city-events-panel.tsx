'use client';
import { useEffect, useState } from 'react';
import { CityEvent, EventWindow, eventInWindow, eventPrice } from '@/lib/city-events';
import { planWhen } from '@/lib/plan-discovery';
import { ConnectionPlan } from '@/lib/connection-plans';
import { fetchJsonWithTimeout } from '@/lib/fetch-helpers';
import s from './plans-home.module.css';

export default function CityEventsPanel({ city, plans, onChoose, onOpen, onClose }: {
  city: string | null; plans: ConnectionPlan[];
  onChoose: (event: CityEvent) => void; onOpen: (plan: ConnectionPlan) => void; onClose: () => void;
}) {
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [window, setWindow] = useState<EventWindow>('week');
  const [category, setCategory] = useState('all');
  const [free, setFree] = useState(false);
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [highlight, setHighlight] = useState('');
  useEffect(() => { setHighlight(new URLSearchParams(globalThis.location.search).get('event') || ''); }, []);
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchJsonWithTimeout('/api/friend/events', { cache: 'no-store' }).then(({ response, data }) => {
      if (cancelled) return;
      setEvents(response.ok && Array.isArray(data?.events) ? data.events : []);
      setStatus(response.ok ? data.status : 'unavailable');
    }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; };
  }, [city, retry]);
  const visible = events.filter(e => eventInWindow(e, window) && (category === 'all' || e.category === category) && (!free || e.price?.max === 0))
    .sort((a, b) => Number(b.id === highlight) - Number(a.id === highlight));
  return <section className={s.eventDiscovery} aria-label="Find something to do">
    <div className={s.sectionHead}><div><span className={s.eyebrow}>Around your city · outside events</span>
      <h2>Find something to do</h2></div><button type="button" onClick={onClose}>Close discovery</button></div>
    <p>Discover an event in {city || 'your city'}, then invite people to go together. These are Ticketmaster listings, not NotCupid member plans.</p>
    <div className={s.eventFilters}>
      <label>When<select value={window} onChange={e => setWindow(e.target.value as EventWindow)}>
        <option value="today">Today</option><option value="weekend">This weekend</option><option value="week">Next 7 days</option>
      </select></label>
      <label>Interests<select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="all">All interests</option><option value="music">Music</option><option value="arts">Arts & comedy</option><option value="sports">Sports</option>
      </select></label>
      <label className={s.check}><input type="checkbox" checked={free} onChange={e => setFree(e.target.checked)} />Listed as free only</label>
    </div>
    {status === 'loading' && <p role="status">Looking for local events…</p>}
    {status === 'ready' && highlight && !events.some(e => e.id === highlight) && <p role="status">That event is no longer in your current city results. Check your selected city or choose another idea.</p>}
    {status !== 'loading' && status !== 'ready' && <div role="status"><p>Outside events are unavailable right now. Member plans and chats are still available.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Retry events</button></div>}
    {status === 'ready' && !visible.length && <p role="status">No events match these filters. Try another day, or post your own idea.</p>}
    <div className={s.eventGrid}>{visible.slice(0, 18).map(event => {
      const existing = plans.filter(p => p.externalEventId === event.id && p.eligible &&
        (!p.expires_at || Date.parse(p.expires_at) > Date.now()) &&
        (p.isMine || p.myResponse === 'yes' || !p.capacity || p.responses.yes < p.capacity));
      return <article key={event.id} className={s.eventCard}>
        <span className={s.eyebrow}>Ticketmaster · {event.category}</span><h3>{event.title}</h3>
        <p>{planWhen(event.startsAt)}<br />{event.venue}</p><small>{eventPrice(event)}</small>
        <a href={event.url} target="_blank" rel="noopener noreferrer">Event details & tickets ↗</a>
        {existing.slice(0, 2).map(p => <button key={p.id} onClick={() => onOpen(p)}>{p.isMine ? 'Open your plan & chat' : `View ${p.authorName?.split(' ')[0] || 'a member'}’s invitation`}</button>)}
        {!existing.some(p => p.isMine) && <button className={s.primary} onClick={() => onChoose(event)}>Find people to go with</button>}
      </article>;
    })}</div>
    <p className={s.muted}>Joining a NotCupid plan does not buy admission. Check current availability, age restrictions and details with Ticketmaster before going. Listings can change.</p>
  </section>;
}
