'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/feedback';
import { FRIEND_ACTIVITIES, FRIEND_TIME_WINDOWS, friendActivity, type FriendActivityKey, type FriendTimeWindow } from '@/lib/friend-taxonomy';
import { METRO_CENTERS } from '@/lib/quiz-data';
import s from './friend-hub.module.css';

type Props = {
  onOpenScene: () => void;
  onOpenCommunities: () => void;
  onStartPlan: () => void;
  onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void;
};

const KIND_LABEL: Record<string, string> = {
  event: 'plan', club: 'recurring club', community: 'community', intent: 'people down',
};

function whenLabel(route: any) {
  if (route.kind === 'intent') return String(route.timeWindow || 'this_week').replaceAll('_', ' ');
  if (route.happensAt) return new Date(route.happensAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (route.cadence && route.cadence !== 'ongoing') return route.cadence;
  return route.area || 'local';
}

function localYmd(daysAhead = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function tripDateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TRAVEL_METROS = Object.entries(METRO_CENTERS).sort(([, first], [, second]) =>
  `${first.state} ${first.label}`.localeCompare(`${second.state} ${second.label}`)
);

export default function FriendDiscoveryCard({ onOpenScene, onOpenCommunities, onStartPlan, onRsvp }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<FriendActivityKey | null>(null);
  const [timeWindow, setTimeWindow] = useState<FriendTimeWindow>('this_week');
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showTravel, setShowTravel] = useState(false);
  const [travelBusy, setTravelBusy] = useState(false);
  const [destinationMetro, setDestinationMetro] = useState('');
  const [destinationArea, setDestinationArea] = useState('');
  const [startsOn, setStartsOn] = useState(localYmd(7));
  const [endsOn, setEndsOn] = useState(localYmd(10));

  const load = useCallback(async (activity?: FriendActivityKey | null) => {
    setLoading(true);
    try {
      const query = activity ? `?activity=${encodeURIComponent(activity)}` : '';
      const response = await fetch(`/api/friend/discover${query}`);
      if (response.ok) {
        const next = await response.json();
        setData(next);
        if (!selected && next.selected) setSelected(next.selected);
      }
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setIntent() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/friend/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_intent', activityKey: selected, timeWindow, note }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast(body.error || 'could not post that signal', 'error'); return; }
      setNote('');
      toast(`you’re down for ${friendActivity(selected).label} — routing it now 🤝`, 'success');
      await load(selected);
    } finally { setBusy(false); }
  }

  async function closeIntent() {
    if (!data?.myIntent?.id || busy) return;
    setBusy(true);
    try {
      await fetch('/api/friend/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_intent', id: data.myIntent.id }),
      });
      await load(selected);
    } finally { setBusy(false); }
  }

  function openTravel() {
    const trip = data?.location?.trip;
    const firstMetro = TRAVEL_METROS.find(([key]) => key !== data?.location?.homeMetro)?.[0] || '';
    setDestinationMetro(trip?.destination_metro || firstMetro);
    setDestinationArea(trip?.destination_area || '');
    setStartsOn(trip?.starts_on || localYmd(7));
    setEndsOn(trip?.ends_on || localYmd(10));
    setShowTravel(true);
  }

  async function saveTravel() {
    if (!destinationMetro || travelBusy) return;
    setTravelBusy(true);
    try {
      const response = await fetch('/api/friend/travel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', destinationMetro, destinationArea, startsOn, endsOn }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast(body.error || 'could not save travel mode', 'error'); return; }
      toast(`trip saved — ${body.label || 'your destination'} is on deck ✈️`, 'success');
      window.location.reload();
    } finally { setTravelBusy(false); }
  }

  async function cancelTravel() {
    const tripId = data?.location?.trip?.id;
    if (!tripId || travelBusy) return;
    setTravelBusy(true);
    try {
      const response = await fetch('/api/friend/travel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id: tripId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast(body.error || 'could not cancel that trip', 'error'); return; }
      toast('travel mode off — back to your home Friend Line', 'success');
      window.location.reload();
    } finally { setTravelBusy(false); }
  }

  async function joinIntent(route: any) {
    if (busy || route.joined) return;
    setBusy(true);
    try {
      const response = await fetch('/api/friend/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_intent', id: route.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast(body.error || 'could not join that signal', 'error'); return; }
      toast(body.activityId ? 'you’re down too — a forming plan is live on the Scene' : `you’re down too — ${route.authorName} got the nudge`, 'success');
      await load(selected);
    } finally { setBusy(false); }
  }

  async function joinClub(route: any) {
    if (busy || route.joined || route.membershipStatus === 'pending') { onOpenCommunities(); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/friend/clubs/${route.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast(body.error || 'could not join that club', 'error'); return; }
      toast(body.status === 'member' ? 'you’re in — the club chat is ready 🎉' : 'request sent to the organizer', 'success');
      await load(selected);
    } finally { setBusy(false); }
  }

  function openCommunity(route: any) {
    fetch('/api/friend/discover', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'community_open', id: route.id }),
    }).catch(() => {});
  }

  const routes = (data?.routes || []).slice(0, 6);
  const shownActivities = showAll ? FRIEND_ACTIVITIES : FRIEND_ACTIVITIES.slice(0, 9);

  return (
    <section className={s.card} style={{ padding: '1rem', marginBottom: '1rem', overflow: 'hidden', background: 'linear-gradient(135deg, color-mix(in srgb, var(--h-surface) 91%, #fff0e5), var(--h-surface))' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className={s.sideHd}>your social signal</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.65rem', lineHeight: 1, margin: '0.2rem 0 0' }}>what are you down for?</h2>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--h-text-dim)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.86rem', lineHeight: 1.45 }}>
            Say one thing. We&apos;ll route it to a plan, recurring group, trusted community, or people who want the same thing.
          </p>
        </div>
        {data?.myIntent && (
          <div style={{ border: '1px solid rgba(255,106,31,0.35)', background: 'rgba(255,106,31,0.08)', borderRadius: 14, padding: '0.65rem 0.75rem', minWidth: 180 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d2530f' }}>live signal</div>
            <div style={{ fontWeight: 750, marginTop: '0.15rem' }}>{data.myIntent.activity.emoji} {data.myIntent.activity.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--h-text-dim)', marginTop: '0.15rem' }}>{String(data.myIntent.timeWindow).replaceAll('_', ' ')} · {data.myIntent.interestedCount} down too</div>
            <button onClick={closeIntent} disabled={busy} style={{ marginTop: '0.35rem', padding: 0, border: 0, background: 'none', color: '#a74712', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '0.53rem', textDecoration: 'underline' }}>close signal</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', border: '1px solid rgba(255,106,31,0.28)', background: 'rgba(255,106,31,0.055)', borderRadius: 14, padding: '0.65rem 0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 210 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.52rem', letterSpacing: '0.11em', textTransform: 'uppercase', color: '#a74712' }}>
              {data?.location?.trip ? (data.location.isTraveling ? '✈ travel friend line active' : '✈ upcoming trip saved') : '✈ going somewhere?'}
            </div>
            {data?.location?.trip ? (
              <div style={{ marginTop: '0.18rem', fontSize: '0.84rem', color: 'var(--h-text-dim)' }}>
                <strong style={{ color: 'var(--h-text)' }}>{data.location.isTraveling ? data.location.label : (METRO_CENTERS[data.location.trip.destination_metro]?.label || data.location.trip.destination_metro)}</strong>
                {' · '}{tripDateLabel(data.location.trip.starts_on)}–{tripDateLabel(data.location.trip.ends_on)}
                {' · '}{data.location.isTraveling ? 'plans, groups and matches route there now' : 'activates 30 days before arrival'}
              </div>
            ) : (
              <div style={{ marginTop: '0.18rem', fontSize: '0.82rem', color: 'var(--h-text-dim)' }}>Find locals, other visitors, plans and communities before you arrive. Your home city stays unchanged.</div>
            )}
          </div>
          <button onClick={openTravel} disabled={travelBusy} className={s.pulseBtnGhost}>{data?.location?.trip ? 'change trip' : 'add a trip'}</button>
          {data?.location?.trip && <button onClick={cancelTravel} disabled={travelBusy} className={s.pulseBtnGhost} style={{ color: '#a74712' }}>cancel</button>}
        </div>

        {showTravel && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.45rem', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,106,31,0.2)' }}>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--h-text-dim)' }}>
              destination metro
              <select value={destinationMetro} onChange={(event) => setDestinationMetro(event.target.value)} className={s.inputStyle}>
                {TRAVEL_METROS.filter(([key]) => key !== data?.location?.homeMetro).map(([key, center]) => <option key={key} value={key}>{center.label}, {center.state}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--h-text-dim)' }}>
              neighborhood / area (optional)
              <input value={destinationArea} onChange={(event) => setDestinationArea(event.target.value)} maxLength={60} placeholder="Back Bay, Brooklyn…" className={s.inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--h-text-dim)' }}>
              arrival
              <input type="date" min={localYmd()} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className={s.inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--h-text-dim)' }}>
              departure
              <input type="date" min={startsOn || localYmd()} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={s.inputStyle} />
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
              <button onClick={saveTravel} disabled={travelBusy || !destinationMetro || !startsOn || !endsOn} className={s.poppyBtn}>{travelBusy ? 'saving…' : 'route my Friend Line →'}</button>
              <button onClick={() => setShowTravel(false)} disabled={travelBusy} className={s.pulseBtnGhost}>close</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem', marginTop: '0.9rem' }}>
        {shownActivities.map((activity) => (
          <button key={activity.key} onClick={() => { setSelected(activity.key); load(activity.key); }} className={s.chip}
            style={{ cursor: 'pointer', borderColor: selected === activity.key ? '#ff6a1f' : undefined, background: selected === activity.key ? 'rgba(255,106,31,0.12)' : 'var(--h-surface)' }}>
            {activity.emoji} {activity.label}
          </button>
        ))}
        <button onClick={() => setShowAll((value) => !value)} className={s.chip} style={{ cursor: 'pointer', background: 'transparent' }}>{showAll ? 'less' : '+ more'}</button>
      </div>

      {selected && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--h-border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {FRIEND_TIME_WINDOWS.map((window) => (
              <button key={window.key} onClick={() => setTimeWindow(window.key)} className={s.chip}
                style={{ cursor: 'pointer', background: timeWindow === window.key ? '#0b0b0b' : 'var(--h-surface)', color: timeWindow === window.key ? '#fff' : 'var(--h-text)' }}>
                {window.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.55rem', flexWrap: 'wrap' }}>
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} placeholder="optional: beginner pace, after work, etc."
              className={s.inputStyle} style={{ flex: '1 1 230px' }} />
            <button onClick={setIntent} disabled={busy} className={s.poppyBtn} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'routing…' : data?.myIntent ? 'update my signal →' : 'put me in →'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '0.95rem', borderTop: '1px solid var(--h-border)', paddingTop: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
          <div className={s.sideHd}>best ways in right now</div>
          {data?.counts && <span style={{ marginLeft: 'auto', color: 'var(--h-text-faint)', fontSize: '0.68rem' }}>{data.counts.plans} plans · {data.counts.clubs + data.counts.communities} groups · {data.counts.people} people</span>}
        </div>
        {loading ? (
          <div style={{ color: 'var(--h-text-dim)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.84rem' }}>routing what&apos;s nearby…</div>
        ) : routes.length === 0 ? (
          <div style={{ border: '1px dashed var(--h-border)', borderRadius: 14, padding: '0.8rem' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--h-text-dim)' }}>Nothing concrete is live for this yet. Your signal seeds demand so the right plan or group can form.</div>
            <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.55rem', flexWrap: 'wrap' }}>
              <button onClick={onStartPlan} className={s.poppyBtn}>start the first plan</button>
              <button onClick={onOpenCommunities} className={s.pulseBtn}>add a community</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.48rem' }}>
            {routes.map((route: any, index: number) => {
              const activity = friendActivity(route.activityKey);
              const action = route.kind === 'event' ? 'I’m in' : route.kind === 'club' ? (route.joined ? 'open' : route.membershipStatus === 'pending' ? 'requested' : route.joinMode === 'open' ? 'join' : 'request') : route.kind === 'community' ? 'open' : route.joined ? 'you’re down' : 'same here';
              const content = (
                <>
                  <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 11, background: index === 0 ? 'rgba(255,106,31,0.13)' : 'var(--h-surface-3)', fontSize: '1.15rem', flexShrink: 0 }}>{activity.emoji}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 760, lineHeight: 1.2 }}>{route.title}</span>
                    <span style={{ display: 'block', marginTop: '0.16rem', color: 'var(--h-text-dim)', fontSize: '0.72rem' }}>{KIND_LABEL[route.kind]} · {whenLabel(route)}{route.memberCount ? ` · ${route.memberCount} in` : ''}</span>
                    {route.reasons?.length > 0 && <span style={{ display: 'block', marginTop: '0.13rem', color: '#a74712', fontFamily: "'DM Mono',monospace", fontSize: '0.5rem' }}>{route.reasons.join(' · ')}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d2530f' }}>{action} →</span>
                </>
              );
              const style = { width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', textAlign: 'left' as const, border: `1px solid ${index === 0 ? 'rgba(255,106,31,0.38)' : 'var(--h-border)'}`, borderRadius: 14, background: index === 0 ? 'rgba(255,255,255,0.58)' : 'var(--h-surface-2)', padding: '0.62rem 0.7rem', color: 'var(--h-text)', textDecoration: 'none', cursor: 'pointer' };
              if (route.kind === 'community') return <a key={`${route.kind}-${route.id}`} href={route.url} target="_blank" rel="noopener noreferrer" onClick={() => openCommunity(route)} style={style}>{content}</a>;
              return <button key={`${route.kind}-${route.id}`} disabled={busy || (route.kind === 'intent' && route.joined)} onClick={() => {
                if (route.kind === 'event') { onRsvp(route.id, 'yes'); toast('you’re in — it’s on your board 🎟️', 'success'); }
                else if (route.kind === 'club') joinClub(route);
                else joinIntent(route);
              }} style={{ ...style, opacity: busy ? 0.68 : 1 }}>{content}</button>;
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
          <button onClick={onOpenScene} className={s.pulseBtnGhost}>see all plans</button>
          <button onClick={onOpenCommunities} className={s.pulseBtnGhost}>browse communities</button>
        </div>
      </div>
    </section>
  );
}
