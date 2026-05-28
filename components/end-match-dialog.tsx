'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseResponse } from '@/lib/fetch-helpers';
import styles from './end-match-dialog.module.css';

type Step = 'choose' | 'confirm-ghost' | 'confirm-not-vibing' | 'submitting' | 'done';

export default function EndMatchDialog({
  matchId,
  otherName,
  onClose,
  onEnded,
}: {
  matchId: string;
  otherName: string;
  onClose: () => void;
  onEnded?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState('');

  async function submit(reason: 'ghosted' | 'not_vibing') {
    setStep('submitting');
    setError('');
    try {
      const res = await fetch(`/api/matches/${matchId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await parseResponse<any>(res)).error || 'failed');
      setStep('done');
      setTimeout(() => { if (onEnded) onEnded(); router.refresh(); }, 900);
    } catch (e: any) {
      setError(e.message || 'something went wrong');
      setStep('choose');
    }
  }

  return (
    <div className={styles.endOverlay} onClick={onClose}>
      <div className={styles.endSheet} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className={styles.endClose} aria-label="close">×</button>

        {step === 'choose' && (
          <>
            <div className={styles.endEyebrow}>end this match</div>
            <h2 className={styles.endTitle}>what happened with <em>{otherName}?</em></h2>
            <p className={styles.endSub}>this helps us protect everyone — and improve the algo.</p>

            <button onClick={() => setStep('confirm-ghost')} className={styles.endOpt}>
              <span className={styles.endOptIcon}>👻</span>
              <div className={styles.endOptBody}>
                <div className={styles.endOptTitle}>they ghosted me</div>
                <div className={styles.endOptDesc}>stopped responding without explanation</div>
              </div>
            </button>

            <button onClick={() => setStep('confirm-not-vibing')} className={styles.endOpt}>
              <span className={styles.endOptIcon}>🌀</span>
              <div className={styles.endOptBody}>
                <div className={styles.endOptTitle}>not vibing</div>
                <div className={styles.endOptDesc}>no spark, mutual fade, just didn't click</div>
              </div>
            </button>

            {error && <div className={styles.endError}>{error}</div>}
          </>
        )}

        {step === 'confirm-ghost' && (
          <>
            <div className={styles.endEyebrow}>report ghosting</div>
            <h2 className={styles.endTitle}>{otherName} ghosted you?</h2>
            <div className={styles.endWarn}>
              <p>they'll be put in a <strong>7-day cooldown</strong>.</p>
              <p>after <strong>3 reports</strong>, they won't be matched again.</p>
              <p className={styles.endWarnNote}>only report if you both said yes and they stopped responding without explanation.</p>
            </div>
            <div className={styles.endActions}>
              <button onClick={() => setStep('choose')} className={styles.endGhostBtn}>← back</button>
              <button onClick={() => submit('ghosted')} className={styles.endPrimaryBtn}>report & end →</button>
            </div>
          </>
        )}

        {step === 'confirm-not-vibing' && (
          <>
            <div className={styles.endEyebrow}>end this match</div>
            <h2 className={styles.endTitle}>no spark with {otherName}?</h2>
            <p className={styles.endSub}>no penalty — you both go back in the pool.</p>
            <div className={styles.endActions}>
              <button onClick={() => setStep('choose')} className={styles.endGhostBtn}>← back</button>
              <button onClick={() => submit('not_vibing')} className={styles.endPrimaryBtn}>end match →</button>
            </div>
          </>
        )}

        {step === 'submitting' && (
          <div className={styles.endStatus}>ending the match...</div>
        )}

        {step === 'done' && (
          <div className={styles.endStatus}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>✓</div>
            done.
          </div>
        )}
      </div>
    </div>
  );
}
