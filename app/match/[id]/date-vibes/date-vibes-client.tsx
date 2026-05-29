'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import { INTEREST_OPTIONS, type Activity, type Interest } from '@/lib/activities';

interface Props {
  matchId: string;
  currentUserId: string;
  partnerName: string;
}

interface ServerState {
  myInterests: Interest[];
  partnerInterests: Interest[];
  deck: Activity[];
  mutualMatches: Activity[];
  counts: { deck: number; mutual: number; partnerHasPicked: boolean; iPicked: boolean };
}

export default function DateVibesClient({ matchId, currentUserId, partnerName }: Props) {
  const [state, setState] = useState<ServerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'picker' | 'deck'>('loading');
  const [picked, setPicked] = useState<Interest[]>([]);
  const [saving, setSaving] = useState(false);
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [celebrate, setCelebrate] = useState<Activity | null>(null);

  // Initial load
  useEffect(() => {
    refresh().then((s) => {
      if (!s) return;
      if (s.myInterests.length === 0) {
        setPhase('picker');
      } else {
        setPicked(s.myInterests);
        setPhase('deck');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(): Promise<ServerState | null> {
    try {
      const res = await fetch(`/api/match/${matchId}/date-vibes`);
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setState(data);
      setError(null);
      return data;
    } catch (e: any) {
      setError(e.message || 'Could not load');
      return null;
    }
  }

  async function saveInterests() {
    if (picked.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/match/${matchId}/date-vibes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: picked }),
      });
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'save failed');
      const fresh = await refresh();
      if (fresh) {
        setPhase('deck');
        setSwipeIdx(0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function swipe(decision: 'yes' | 'no') {
    if (!state || swipeIdx >= state.deck.length) return;
    const activity = state.deck[swipeIdx];
    const idAtSwipe = activity.id;
    setSwipeIdx((i) => i + 1);
    try {
      const res = await fetch(`/api/match/${matchId}/date-vibes/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: idAtSwipe, decision }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && data.mutual) {
        setCelebrate(activity);
        // Re-fetch to update mutualMatches list
        refresh();
      }
    } catch {
      /* swipe is optimistic; ignore network blip */
    }
  }

  if (phase === 'loading' && !state) {
    return <CenteredMsg text="loading the vibes…" />;
  }
  if (error && !state) {
    return <CenteredMsg text={`couldn't load: ${error}`} tone="error" />;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8f5ff', padding: '2rem 1.25rem 4rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Header partnerName={partnerName} matchId={matchId} />

        {state && state.mutualMatches.length > 0 && (
          <MutualMatches matches={state.mutualMatches} partnerName={partnerName} />
        )}

        {phase === 'picker' && (
          <Picker
            picked={picked}
            onToggle={(v) => setPicked((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
            onSave={saveInterests}
            saving={saving}
            partnerInterests={state?.partnerInterests || []}
            partnerName={partnerName}
          />
        )}

        {phase === 'deck' && state && (
          <Deck
            deck={state.deck}
            idx={swipeIdx}
            partnerName={partnerName}
            onSwipe={swipe}
            onChangeInterests={() => { setPicked(state.myInterests); setPhase('picker'); }}
          />
        )}

        {error && state && (
          <p style={{ marginTop: 18, color: '#d94f3d', fontFamily: 'DM Mono, monospace', fontSize: 12, textAlign: 'center' }}>{error}</p>
        )}
      </div>

      {celebrate && (
        <CelebrateModal activity={celebrate} partnerName={partnerName} onClose={() => setCelebrate(null)} />
      )}
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────
function Header({ partnerName, matchId }: { partnerName: string; matchId: string }) {
  const first = partnerName.split(' ')[0];
  return (
    <div style={{ marginBottom: 24 }}>
      <a href={`/match/${matchId}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5b4fa0', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
        ← back to chat with {first}
      </a>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#0e0c1a', margin: '14px 0 6px 0', lineHeight: 1.1 }}>
        Date vibes <span style={{ color: '#8b7fd4' }}>·</span> you &amp; {first}
      </h1>
      <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
        Swipe through things you'd actually do together. When you both swipe ✓ on the same thing, it's locked in as a "we both want this." No one sees the other's no's.
      </p>
    </div>
  );
}

// ─── Mutual matches strip ───────────────────────────────────────────────
function MutualMatches({ matches, partnerName }: { matches: Activity[]; partnerName: string }) {
  const first = partnerName.split(' ')[0];
  return (
    <div style={{ background: 'linear-gradient(135deg, #ede9ff, #fff)', border: '1px solid rgba(139,127,212,0.4)', borderRadius: 14, padding: 18, marginBottom: 24 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5b4fa0', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
        ✦ you both want this {matches.length > 1 ? `(${matches.length})` : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid rgba(14,12,26,0.06)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#0e0c1a', fontWeight: 500, lineHeight: 1.3 }}>{a.title}</div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#7a7590', marginTop: 4 }}>
                {[a.venue, a.whenLabel].filter(Boolean).join(' · ')}
              </div>
            </div>
            {a.url && (
              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5b4fa0', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                tickets →
              </a>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, color: '#7a7590', margin: '12px 0 0 0' }}>
        send {first} a message and lock in the time →
      </p>
    </div>
  );
}

// ─── Interest picker ────────────────────────────────────────────────────
function Picker({
  picked, onToggle, onSave, saving, partnerInterests, partnerName,
}: {
  picked: Interest[];
  onToggle: (v: Interest) => void;
  onSave: () => void;
  saving: boolean;
  partnerInterests: Interest[];
  partnerName: string;
}) {
  const first = partnerName.split(' ')[0];
  const partnerHas = new Set(partnerInterests);
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(14,12,26,0.08)', borderRadius: 14, padding: 24 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#8b7fd4', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
        pick your interests
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0e0c1a', margin: '0 0 8px 0', lineHeight: 1.2 }}>
        What's your speed? Pick 3-8.
      </h2>
      <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', fontSize: 13, marginTop: 0, marginBottom: 18, lineHeight: 1.5 }}>
        We'll use both of your picks to filter the activity deck.
        {partnerInterests.length > 0
          ? <> {first} has already picked {partnerInterests.length}. The <span style={{ color: '#5b4fa0' }}>⋆</span> shows overlap.</>
          : <> {first} hasn't picked yet — that's fine, the deck still works.</>
        }
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        {INTEREST_OPTIONS.map((opt) => {
          const on = picked.includes(opt.value);
          const overlap = partnerHas.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              style={{
                background: on ? '#0e0c1a' : '#fff',
                color: on ? '#f8f5ff' : '#0e0c1a',
                border: `1px solid ${on ? '#0e0c1a' : 'rgba(14,12,26,0.13)'}`,
                padding: '10px 16px',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}{overlap && <span style={{ marginLeft: 6, color: on ? '#c8c4dc' : '#5b4fa0' }}>⋆</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || picked.length === 0}
        style={{
          background: '#0e0c1a',
          color: '#f8f5ff',
          border: 'none',
          padding: '14px 28px',
          fontFamily: 'DM Mono, monospace',
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: picked.length === 0 ? 'not-allowed' : (saving ? 'wait' : 'pointer'),
          opacity: picked.length === 0 ? 0.4 : (saving ? 0.7 : 1),
          width: '100%',
        }}
      >
        {saving ? 'saving…' : `lock in ${picked.length || 0} → start swiping`}
      </button>
    </div>
  );
}

// ─── Swipe deck ─────────────────────────────────────────────────────────
function Deck({
  deck, idx, partnerName, onSwipe, onChangeInterests,
}: {
  deck: Activity[];
  idx: number;
  partnerName: string;
  onSwipe: (d: 'yes' | 'no') => void;
  onChangeInterests: () => void;
}) {
  const card = deck[idx];
  const remaining = deck.length - idx;

  if (!card) {
    return (
      <div style={{ background: '#fff', border: '1px solid rgba(14,12,26,0.08)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#0e0c1a', margin: '0 0 10px 0' }}>You're through the deck.</h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px 0' }}>
          Want more options? Add some interests, or refresh later — new live events drop in regularly.
        </p>
        <button type="button" onClick={onChangeInterests} style={btnSecondary}>change interests</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#7a7590', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {remaining} left in deck
        </div>
        <button type="button" onClick={onChangeInterests} style={{ background: 'transparent', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#5b4fa0', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          edit interests
        </button>
      </div>

      <ActivityCard card={card} />

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="button" onClick={() => onSwipe('no')} style={{ ...btnSecondary, flex: 1 }}>
          ✕  pass
        </button>
        <button type="button" onClick={() => onSwipe('yes')} style={{ ...btnPrimary, flex: 1 }}>
          ✓  I'm in
        </button>
      </div>
    </div>
  );
}

function ActivityCard({ card }: { card: Activity }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(14,12,26,0.08)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 32px -16px rgba(91,79,160,0.25)' }}>
      {card.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#8b7fd4', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {card.category}{sourceBadge(card.source)}
          </span>
          {card.whenLabel && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0e0c1a', fontWeight: 600 }}>{card.whenLabel}</span>
          )}
        </div>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0e0c1a', margin: '0 0 10px 0', lineHeight: 1.25 }}>
          {card.title}
        </h3>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', fontSize: 14, lineHeight: 1.55, margin: '0 0 14px 0' }}>
          {card.blurb}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {card.venue && (
            <span style={{ background: '#ede9ff', color: '#5b4fa0', padding: '4px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em' }}>
              📍 {card.venue}
            </span>
          )}
          {card.tags.map((t) => (
            <span key={t} style={{ background: '#f8f5ff', color: '#7a7590', padding: '4px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em' }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CelebrateModal({ activity, partnerName, onClose }: { activity: Activity; partnerName: string; onClose: () => void }) {
  const first = partnerName.split(' ')[0];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,12,26,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 440, width: '100%', padding: 28, textAlign: 'center', border: '2px solid #8b7fd4' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✦</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5b4fa0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
          you both said yes
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#0e0c1a', margin: '0 0 12px 0', lineHeight: 1.2 }}>
          {activity.title}
        </h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px 0' }}>
          You and {first} both want this. Message them and lock in the time.
        </p>
        <button type="button" onClick={onClose} style={btnPrimary}>keep swiping</button>
      </div>
    </div>
  );
}

function sourceBadge(source: Activity['source']): string {
  switch (source) {
    case 'ticketmaster':    return ' · live';
    case 'yelp':            return ' · trending';
    case 'boston-calendar': return " · editor's pick";
    default:                return '';
  }
}

function CenteredMsg({ text, tone }: { text: string; tone?: 'error' }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f8f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: tone === 'error' ? '#d94f3d' : '#7a7590', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{text}</p>
    </main>
  );
}

// ─── Inline button styles (shared) ───────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  background: '#0e0c1a',
  color: '#f8f5ff',
  border: 'none',
  padding: '16px 24px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: '#7a7590',
  border: '1px solid rgba(14,12,26,0.13)',
  padding: '16px 24px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
};
