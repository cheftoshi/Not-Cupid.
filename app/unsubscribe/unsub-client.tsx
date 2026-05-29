'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

interface Props {
  user: { id: string; name: string | null; email: string };
  token: string;
  alreadyOff: boolean;
}

export default function UnsubClient({ user, token, alreadyOff: alreadyOffProp }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyOffProp);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: user.id, t: token }),
      });
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Could not unsubscribe');
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const first = (user.name || 'there').split(' ')[0];

  return (
    <main style={{ minHeight: '100vh', background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#fff', padding: '2.5rem', border: '1px solid rgba(14,12,26,0.08)', borderRadius: 14 }}>
        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 26, letterSpacing: '0.14em', color: '#0e0c1a', marginBottom: 24 }}>
          NOT<span style={{ color: '#2563ff' }}>CUPID</span>
        </div>

        {!done ? (
          <>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2563ff', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
              unsubscribe
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#0e0c1a', margin: '0 0 18px 0', lineHeight: 1.15 }}>
              Hold on, {first}. Read this first.
            </h1>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', lineHeight: 1.65, fontSize: 15 }}>
              Unsubscribing turns off <em>all</em> NotCupid emails — including the one telling you about a new match. Because the app has no in-app notifications, this also <strong style={{ color: '#0e0c1a' }}>pauses you from the matching pool</strong>. You won't be considered for new matches until you turn this back on.
            </p>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', lineHeight: 1.65, fontSize: 15, marginBottom: 28 }}>
              You can re-enable both at any time from <a href="/profile" style={{ color: '#1b46c9' }}>your profile</a>.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={confirm}
                disabled={busy}
                style={{
                  flex: 1,
                  background: '#0e0c1a',
                  color: '#f6f6f6',
                  border: 'none',
                  padding: '14px 24px',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  borderRadius: 0,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'pausing…' : 'Yes, pause everything'}
              </button>
              <a
                href="/"
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#7a7590',
                  border: '1px solid rgba(14,12,26,0.13)',
                  padding: '14px 24px',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  textAlign: 'center',
                  borderRadius: 0,
                }}
              >
                Keep me in
              </a>
            </div>

            {error && (
              <p style={{ marginTop: 18, color: '#d94f3d', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{error}</p>
            )}
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2563ff', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
              paused.
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#0e0c1a', margin: '0 0 18px 0', lineHeight: 1.15 }}>
              You're out of the pool, {first}.
            </h1>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', lineHeight: 1.65, fontSize: 15 }}>
              No more emails to <strong style={{ color: '#0e0c1a' }}>{user.email}</strong>. You won't be matched until you turn this back on. Active matches you already have are preserved.
            </p>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', lineHeight: 1.65, fontSize: 15, marginBottom: 28 }}>
              Change your mind? <a href="/profile" style={{ color: '#1b46c9' }}>Re-enable from your profile →</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
