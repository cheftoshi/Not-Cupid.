'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseResponse } from '@/lib/fetch-helpers';
import styles from './end-match-dialog.module.css';

type Step = 'rate' | 'submitting' | 'done';

export default function DateFeedbackDialog({
  matchId,
  otherName,
  onClose,
  onSubmitted,
}: {
  matchId: string;
  otherName: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState(0);
  const [wouldAgain, setWouldAgain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!rating) return;
    setStep('submitting');
    setError('');
    try {
      const res = await fetch(`/api/matches/${matchId}/date-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          would_again: wouldAgain,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await parseResponse<any>(res)).error || 'failed');
      setStep('done');
      setTimeout(() => { if (onSubmitted) onSubmitted(); router.refresh(); }, 1100);
    } catch (e: any) {
      setError(e.message || 'something went wrong');
      setStep('rate');
    }
  }

  return (
    <div className={styles.endOverlay} onClick={onClose}>
      <div className={styles.endSheet} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className={styles.endClose} aria-label="close">×</button>

        {step === 'rate' && (
          <>
            <div className={styles.endEyebrow}>your date with {otherName}</div>
            <h2 className={styles.endTitle}>how was it?</h2>
            <p className={styles.endSub}>private to you and our team — helps us tune the algo. <em>your chat stays open.</em></p>

            <div className={styles.endStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`${styles.endStar} ${rating >= n ? styles.endStarOn : ''}`}
                  aria-label={`${n} stars`}
                >★</button>
              ))}
            </div>

            <div className={styles.endRow}>
              <span className={styles.endQ}>would you see them again?</span>
              <div className={styles.endToggle}>
                <button type="button" onClick={() => setWouldAgain(true)} className={`${styles.endChip} ${wouldAgain === true ? styles.endChipOn : ''}`}>yes</button>
                <button type="button" onClick={() => setWouldAgain(false)} className={`${styles.endChip} ${wouldAgain === false ? styles.endChipOn : ''}`}>no</button>
              </div>
            </div>

            <textarea
              className={styles.endNotes}
              placeholder="anything else? (private — just for us)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
            />

            {error && <div className={styles.endError}>{error}</div>}

            <div className={styles.endActions}>
              <button onClick={onClose} className={styles.endGhostBtn}>cancel</button>
              <button
                onClick={submit}
                disabled={rating === 0}
                className={styles.endPrimaryBtn}
              >submit →</button>
            </div>
          </>
        )}

        {step === 'submitting' && <div className={styles.endStatus}>saving...</div>}

        {step === 'done' && (
          <div className={styles.endStatus}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>✓</div>
            thanks — feedback saved.
          </div>
        )}
      </div>
    </div>
  );
}
