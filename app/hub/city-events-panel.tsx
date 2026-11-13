'use client';
import { useEffect, useState } from 'react';
import type { CityEvent } from '@/lib/city-events';
import type { ConnectionPlan } from '@/lib/connection-plans';
import { fetchJsonWithTimeout } from '@/lib/fetch-helpers';
import EventDiscovery, { type DiscoveryStatus } from './event-discovery';

export default function CityEventsPanel({ city, plans, onChoose, onOpen, onClose }: {
  city: string | null; plans: ConnectionPlan[];
  onChoose: (event: CityEvent) => void; onOpen: (plan: ConnectionPlan) => void; onClose: () => void;
}) {
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>('loading');
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [highlight, setHighlight] = useState('');
  useEffect(() => { setHighlight(new URLSearchParams(globalThis.location.search).get('event') || ''); }, []);
  useEffect(() => {
    let cancelled = false;
    setStatus('loading'); setEvents([]); setFetchedAt(undefined);
    fetchJsonWithTimeout('/api/friend/events', { cache: 'no-store' }).then(({ response, data }) => {
      if (cancelled) return;
      setEvents(response.ok && Array.isArray(data?.events) ? data.events : []);
      setFetchedAt(data?.fetchedAt);
      setStatus(response.ok && data.status === 'ready' ? 'ready' : 'unavailable');
    }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; };
  }, [city, retry]);
  return <EventDiscovery city={city} events={events} plans={plans} status={status} fetchedAt={fetchedAt} highlight={highlight} onRetry={() => setRetry(n => n+1)} onChoose={onChoose} onOpen={onOpen} onClose={onClose}/>;
}
