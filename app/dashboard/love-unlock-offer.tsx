'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import { toast } from '@/components/feedback';
import styles from './dashboard.module.css';

export default function LoveUnlockOffer({
  matchId,
  name,
  items,
}: {
  matchId: string;
  name: string;
  items: string[];
}) {
  const [busy, setBusy] = useState(false);
  const first = (name || 'your match').split(' ')[0];

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/unlock-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'profile' }),
      });
      const data = await parseResponse<any>(response);
      if (response.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast(data.error || 'checkout didn’t open — try again', 'error');
    } catch {
      toast('checkout didn’t open — try again', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.connectionUnlock} aria-label={`${first}'s private compatibility profile`}>
      <div className={styles.connectionUnlockIcon} aria-hidden="true">🔒</div>
      <div className={styles.connectionUnlockCopy}>
        <div className={styles.connectionUnlockEyebrow}>
          {first}&apos;s private profile · {items.length} {items.length === 1 ? 'detail' : 'details'}
        </div>
        <strong>{first} has more to share.</strong>
        <small>
          {items.slice(0, 3).join(' · ')}
          {items.length > 3 ? ` · +${items.length - 3} more` : ''}
        </small>
      </div>
      <button
        className={styles.connectionUnlockButton}
        type="button"
        onClick={unlock}
        disabled={busy}
        aria-label={`Unlock ${first}'s private profile for 99 cents`}
      >
        {busy ? 'opening…' : `unlock ${first} · $0.99`}
      </button>
    </div>
  );
}
