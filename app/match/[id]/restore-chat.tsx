'use client';
import { useState } from 'react';

export default function RestoreChat({ matchId }: { matchId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function restore() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/matches/${matchId}/restore`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not restore chat');
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore chat');
      setBusy(false);
    }
  }
  return <section style={{ padding: '1rem', background: 'var(--h-surface)', color: 'var(--h-text)' }}>
    <p>This mutual chat closed under our old inactivity rule. You can bring it back without a time limit.</p>
    <p>Up to three restores in 30 days, once per expired chat. Both people can end the conversation at any time.</p>
    <button type="button" disabled={busy} onClick={restore} style={{ minHeight: 44 }}>
      {busy ? 'Restoring…' : 'Bring this chat back'}
    </button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
