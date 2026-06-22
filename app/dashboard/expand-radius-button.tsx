'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

// Radius selector shown in the "in the queue" / roster state. Lets a user set
// how far out they want to match — TIGHTER than the 15mi default (5–10mi for
// people who only want someone close) or wider (up to 75) when the local pool
// is thin. Picking a value re-runs the roster.
const LADDER = [5, 10, 15, 25, 50, 75];

export default function ExpandRadiusButton({ radius, maxRadius }: { radius: number; maxRadius: number }) {
  const [r, setR] = useState(radius);
  const [busy, setBusy] = useState(false);
  const options = LADDER.filter((v) => v <= maxRadius);

  async function choose(value: number) {
    if (busy || value === r) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/set-radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius: value }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && data.radius) {
        setR(data.radius);
        // Give the new radius a beat, then reload to surface a fresh roster.
        setTimeout(() => window.location.reload(), 700);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.7rem' }}>
        match distance — searching within <strong style={{ color: '#2563ff' }}>{r} mi</strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        {options.map((v) => {
          const active = v === r;
          return (
            <button
              key={v}
              onClick={() => choose(v)}
              disabled={busy}
              style={{
                background: active ? '#2563ff' : 'var(--h-surface)',
                color: active ? '#fff' : 'var(--h-accent)',
                border: `1.5px solid ${active ? '#2563ff' : 'var(--h-border)'}`,
                borderRadius: 999,
                padding: '0.5rem 1rem',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.62rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy && !active ? 0.6 : 1,
                transition: 'all 0.12s',
              }}
            >
              {v} mi
            </button>
          );
        })}
      </div>
      <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--h-text-faint)', marginTop: '0.7rem', lineHeight: 1.45 }}>
        closer = fewer but nearer matches · wider = a bigger pool. the algo re-runs every 20 min.
      </div>
    </div>
  );
}
