'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

// One-click "I'm back" — lifts a matching pause WITHOUT wiping the profile or
// spending a "start fresh" refresh. Used on the paused-state cards (both lines).
// `accent` lets the friend side render it in orange; defaults to love-blue.
export default function ReactivateButton({ accent = '#2563ff' }: { accent?: string }) {
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/profile/reactivate', { method: 'POST' });
      const d = await parseResponse<any>(r);
      if (!r.ok) { alert(d.error || 'Could not reactivate'); setBusy(false); return; }
      window.location.reload();
    } catch {
      alert('Something went wrong.'); setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reactivate}
      disabled={busy}
      style={{
        background: accent, color: '#fff', border: 'none', borderRadius: 999,
        padding: '0.8rem 1.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem',
        letterSpacing: '0.14em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? 'bringing you back…' : "i'm back — reactivate me →"}
    </button>
  );
}
