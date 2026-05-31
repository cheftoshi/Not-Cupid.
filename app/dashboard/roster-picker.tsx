'use client';

import { useEffect, useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import { relationshipStyleLabel } from '@/lib/quiz-data';
import ExpandRadiusButton from './expand-radius-button';

// The waiting-state experience: instead of being assigned one match, the user
// sees their top compatible people and CHOOSES who to connect with. First pick
// wins — picking creates the match (you pre-accepted) and notifies them. If the
// roster is empty, falls back to the queue message + widen-search.
type Candidate = {
  id: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; zip: string | null; relationship_style: string | null; score: number;
};

export default function RosterPicker({ radius, maxRadius }: { radius: number; maxRadius: number }) {
  const [roster, setRoster] = useState<Candidate[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch('/api/match/roster');
      const data = await parseResponse<any>(res);
      setRoster(Array.isArray(data.roster) ? data.roster : []);
    } catch {
      setRoster([]);
    }
  }

  async function pick(c: Candidate) {
    if (picking) return;
    setPicking(c.id);
    setNotice(null);
    try {
      const res = await fetch('/api/match/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c.id }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && data.ok) {
        // Match created — reload so the dashboard shows the match card.
        window.location.reload();
        return;
      }
      // Conflict (taken / already matched) — show why + refresh the roster.
      setNotice(data.error || 'That didn’t work — refreshed your options.');
      setPicking(null);
      load();
    } catch {
      setNotice('Something went wrong. Try again.');
      setPicking(null);
    }
  }

  // Loading
  if (roster === null) {
    return (
      <div style={emptyWrap}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6b76' }}>
          finding your people…
        </p>
      </div>
    );
  }

  // Empty roster → queue message + widen search (the prior behavior).
  if (roster.length === 0) {
    return (
      <div style={emptyWrap}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>✦</div>
        <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.75rem', color: '#0b0b0b', margin: '0 0 0.5rem' }}>in the queue.</h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6b6b76', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 440, margin: '0 auto' }}>
          the algorithm re-runs every 20 minutes, scanning the pool for your people. fresh picks land here the moment they do.
        </p>
        <ExpandRadiusButton radius={radius} maxRadius={maxRadius} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.5rem' }}>
          ✦ your top {roster.length} — you choose
        </div>
        <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.6rem', color: '#0b0b0b', margin: '0 0 0.4rem' }}>
          pick who you want to meet.
        </h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6b6b76', fontSize: '0.85rem', margin: 0 }}>
          one at a time — choose one and we&apos;ll let them know. the rest stay in your pool.
        </p>
      </div>

      {notice && (
        <div style={{ background: '#fff1e8', border: '1px solid rgba(255,106,31,0.4)', color: '#9a4a12', borderRadius: 12, padding: '0.7rem 0.9rem', marginBottom: '1rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.9rem' }}>
        {roster.map((c) => {
          const first = (c.name || 'someone').split(' ')[0];
          const style = relationshipStyleLabel(c.relationship_style);
          return (
            <div key={c.id} style={{ background: '#fff', border: '1px solid rgba(11,11,11,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '1 / 1', background: '#e8edff', position: 'relative' }}>
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#2563ff', fontSize: '0.85rem' }}>no photo</div>
                )}
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(11,11,11,0.82)', color: '#fff', borderRadius: 999, padding: '3px 9px', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', fontWeight: 600 }}>
                  {c.score}<span style={{ color: '#ff6a1f' }}>%</span>
                </div>
              </div>
              <div style={{ padding: '0.8rem 0.85rem 0.95rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.05rem', color: '#0b0b0b', fontWeight: 700 }}>
                  {first}{c.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#6b6b76' }}>, {c.age}</span> : null}
                </div>
                {c.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b6b76', lineHeight: 1.3 }}>{c.archetype}</div>}
                {style && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', color: '#1b46c9' }}>💞 {style}</div>}
                <button
                  onClick={() => pick(c)}
                  disabled={!!picking}
                  style={{
                    marginTop: 'auto', background: picking === c.id ? '#1b46c9' : '#0b0b0b', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: picking ? 'wait' : 'pointer',
                    opacity: picking && picking !== c.id ? 0.4 : 1,
                  }}
                >
                  {picking === c.id ? 'connecting…' : `choose ${first} →`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a96a8' }}>
        not feeling these? the roster refreshes as new people join.
      </p>
    </div>
  );
}

const emptyWrap: React.CSSProperties = {
  background: '#fff',
  border: '1px dashed #e5e1ec',
  borderRadius: 20,
  padding: '3rem 2rem',
  textAlign: 'center',
  marginBottom: '3rem',
};
