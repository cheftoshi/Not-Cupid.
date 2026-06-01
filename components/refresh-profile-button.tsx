'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

const MAX = 3;

// "Start fresh" — wipes quiz + profile + matches (both lines), keeps the
// account. Capped at 3 per account; shows remaining tries. Lives on both the
// Love and Friend profile pages. After a refresh, sends the user to the core
// quiz to rebuild.
export default function RefreshProfileButton({ usedCount }: { usedCount?: number }) {
  const [used, setUsed] = useState(typeof usedCount === 'number' ? usedCount : 0);
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, MAX - used);

  async function refresh() {
    if (busy || remaining <= 0) return;
    if (!confirm(
      `Start fresh? This wipes your quiz answers, profile, and all current matches on BOTH the Love and Friend lines — then you re-take the quiz. Your account stays. You have ${remaining} refresh${remaining === 1 ? '' : 'es'} left.`
    )) return;
    setBusy(true);
    try {
      const r = await fetch('/api/profile/refresh', { method: 'POST' });
      const d = await parseResponse<any>(r);
      if (!r.ok) { alert(d.error || 'Could not refresh'); setBusy(false); return; }
      setUsed((u) => u + 1);
      window.location.href = '/quiz?retake=1';
    } catch {
      alert('Something went wrong.'); setBusy(false);
    }
  }

  const out = remaining <= 0;

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={refresh}
        disabled={busy || out}
        style={{
          display: 'block', width: '100%', padding: '0.9rem',
          background: 'transparent', border: `1.5px solid ${out ? '#cbcbd4' : '#1b46c9'}`,
          color: out ? '#9a96a8' : '#1b46c9', borderRadius: 12,
          fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', fontWeight: 600, cursor: out || busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'refreshing…' : out ? 'no refreshes left' : '↺ start fresh (wipe & re-take quiz)'}
      </button>
      <div style={{ marginTop: '0.4rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a96a8', textAlign: 'center' }}>
        {remaining} of {MAX} refreshes left
      </div>
    </div>
  );
}
