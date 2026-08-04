'use client';

import Link from 'next/link';
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
    <section className={styles.loveUnlockOffer} aria-label={`${first}'s compatibility profile`}>
      <div className={styles.loveUnlockIcon}>🔒</div>
      <div className={styles.loveUnlockCopy}>
        <div className={styles.loveUnlockEyebrow}>go beyond the first impression</div>
        <h2>{first} shared more with you.</h2>
        <p>{items.slice(0, 4).join(' · ')}{items.length > 4 ? ` · +${items.length - 4} more` : ''}</p>
      </div>
      <div className={styles.loveUnlockActions}>
        <button type="button" onClick={unlock} disabled={busy}>
          {busy ? 'opening…' : 'unlock once · $0.99'}
        </button>
        <Link href="/pro">or unlock every profile with Pro</Link>
      </div>
    </section>
  );
}
