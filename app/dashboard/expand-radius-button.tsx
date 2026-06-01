'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

const DEFAULT_RADIUS = 15;

// Shown in the "in the queue" state. Lets a waiting user widen their match
// radius in 15mi steps (up to 75) when their local pool is thin, then reloads
// to pick up any match the wider net surfaces. Once widened, a small "reset to
// 15 mi" link snaps it back to the default for people who want to stay local.
export default function ExpandRadiusButton({ radius, maxRadius }: { radius: number; maxRadius: number }) {
  const [r, setR] = useState(radius);
  const [busy, setBusy] = useState(false);
  const maxed = r >= maxRadius;

  async function expand() {
    if (busy || maxed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/expand-radius', { method: 'POST' });
      const data = await parseResponse<any>(res);
      if (res.ok && data.radius) {
        setR(data.radius);
        // Give the fresh match attempt a beat, then reload to surface it.
        setTimeout(() => window.location.reload(), 900);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy || r <= DEFAULT_RADIUS) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/reset-radius', { method: 'POST' });
      const data = await parseResponse<any>(res);
      if (res.ok && data.radius) {
        setR(data.radius);
        setTimeout(() => window.location.reload(), 900);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6b76', marginBottom: '0.7rem' }}>
        searching within <strong style={{ color: '#2563ff' }}>{r} mi</strong>
      </div>
      {maxed ? (
        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#6b6b76', lineHeight: 1.5 }}>
          you&apos;re searching the whole region (75 mi). hang tight — the algo re-runs every 20 minutes.
        </div>
      ) : (
        <button
          onClick={expand}
          disabled={busy}
          style={{
            background: '#2563ff', color: '#fff', border: 'none', borderRadius: 999,
            padding: '0.75rem 1.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem',
            letterSpacing: '0.14em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'widening…' : `widen search to ${Math.min(r + 15, maxRadius)} mi →`}
        </button>
      )}
      {r > DEFAULT_RADIUS && (
        <div style={{ marginTop: '0.7rem' }}>
          <button
            onClick={reset}
            disabled={busy}
            style={{
              background: 'none', border: 'none', cursor: busy ? 'wait' : 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#9a96a8', textDecoration: 'underline', padding: 0,
            }}
          >
            reset to {DEFAULT_RADIUS} mi
          </button>
        </div>
      )}
    </div>
  );
}
