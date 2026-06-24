'use client';

import { useState } from 'react';
import { METRO_CENTERS, METRO_ZIP } from '@/lib/quiz-data';

// Location controls — change your city (repoints your pool) + (love only) your
// match radius. Lives WHERE you're looking (the Love dashboard + the Friends
// hub), NOT on the hub home base. Reusable; accent flips blue↔orange per line.

const CITY_OPTIONS = (Object.keys(METRO_ZIP) as Array<keyof typeof METRO_ZIP>)
  .map((key) => ({ key: key as string, ...METRO_CENTERS[key] }))
  .sort((a, b) => (a.state === b.state ? a.city.localeCompare(b.city) : a.state.localeCompare(b.state)));

const RADIUS_LADDER = [5, 10, 15, 25, 50, 75];

export default function LocationControls({
  city, currentMetro, radius = 15, showRadius = false, accent = '#2563ff',
}: {
  city?: string | null; currentMetro?: string | null; radius?: number; showRadius?: boolean; accent?: string;
}) {
  const [picker, setPicker] = useState(false);
  const [cityBusy, setCityBusy] = useState<string | null>(null);
  const [r, setR] = useState(radius);
  const [rBusy, setRBusy] = useState(false);

  async function changeCity(metro: string) {
    setCityBusy(metro);
    try {
      const res = await fetch('/api/profile/set-city', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metro }) });
      if (res.ok) window.location.reload(); else setCityBusy(null);
    } catch { setCityBusy(null); }
  }
  async function changeRadius(v: number) {
    const prev = r; setR(v); setRBusy(true);
    try {
      const res = await fetch('/api/profile/set-radius', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ radius: v }) });
      if (!res.ok) setR(prev); else window.location.reload();
    } catch { setR(prev); } finally { setRBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
      <button type="button" onClick={() => setPicker(true)}
        style={{ background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', color: 'var(--h-text-dim)' }}>
        📍 {city || 'set your city'} <span style={{ color: accent, fontWeight: 700 }}>· change</span>
      </button>

      {showRadius && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>within</span>
          {RADIUS_LADDER.map((v) => (
            <button key={v} type="button" onClick={() => changeRadius(v)} disabled={rBusy}
              style={{ background: v === r ? accent : 'var(--h-surface-2)', color: v === r ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${v === r ? accent : 'var(--h-border)'}`, borderRadius: 8, padding: '0.25rem 0.5rem', cursor: rBusy ? 'wait' : 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem' }}>{v}</button>
          ))}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', color: 'var(--h-text-faint)' }}>mi</span>
        </div>
      )}

      {picker && (
        <div onClick={() => setPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,16,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--h-surface)', borderRadius: 20, maxWidth: 460, width: '100%', maxHeight: '82vh', overflow: 'auto', padding: '1.5rem', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: 'var(--h-text)' }}>your city</span>
              <button onClick={() => setPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--h-text-faint)' }}>✕</button>
            </div>
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              we’re live in <b>{CITY_OPTIONS.length} cities</b> across New England + NYC. tap any to set where you match &amp; see events — your matches &amp; friends stay put.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {CITY_OPTIONS.map((c) => {
                const isCurrent = c.key === currentMetro;
                return (
                  <button key={c.key} onClick={() => { if (!isCurrent) changeCity(c.key); }} disabled={!!cityBusy || isCurrent}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: isCurrent ? 'var(--h-surface-2)' : 'var(--h-surface)', border: `1px solid ${isCurrent ? accent : 'var(--h-border)'}`, borderRadius: 10, padding: '0.6rem 0.85rem', cursor: isCurrent ? 'default' : (cityBusy ? 'wait' : 'pointer') }}>
                    <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '0.95rem', color: 'var(--h-text)' }}>{c.city}<span style={{ color: 'var(--h-text-faint)', fontSize: '0.78rem' }}>, {c.state}</span></span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isCurrent ? accent : 'var(--h-text-faint)' }}>{cityBusy === c.key ? '…' : isCurrent ? '✓ current' : 'switch →'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
