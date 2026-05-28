'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './chat.module.css';

type Step = 'choose' | 'rate-date' | 'confirm-ghost' | 'confirm-not-vibing' | 'submitting' | 'done';

export default function EndMatchDialog({
  matchId,
  otherName,
  onClose,
}: {
  matchId: string;
  otherName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState('');

  // date feedback state
  const [rating, setRating] = useState<number>(0);
  const [wouldAgain, setWouldAgain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');

  async function submit(reason: 'went_on_date' | 'ghosted' | 'not_vibing', feedback?: any) {
    setStep('submitting');
    setError('');
    try {
      const res = await fetch(`/api/matches/${matchId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setStep('done');
      setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 900);
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
            <p className={styles.endSub}>this helps us improve the algo — and protect everyone.</p>

            <button onClick={() => setStep('rate-date')} className={styles.endOpt}>
              <span className={styles.endOptIcon}>🍷</span>
              <div className={styles.endOptBody}>
                <div className={styles.endOptTitle}>we went on a date</div>
                <div className={styles.endOptDesc}>tell us how it went</div>
              </div>
            </button>

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

        {step === 'rate-date' && (
          <>
            <div className={styles.endEyebrow}>your date with {otherName}</div>
            <h2 className={styles.endTitle}>how was it?</h2>
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

            <div className={styles.endActions}>
              <button onClick={() => setStep('choose')} className={styles.endGhostBtn}>← back</button>
              <button
                onClick={() => submit('went_on_date', { rating, would_again: wouldAgain, notes: notes.trim() || undefined })}
                disabled={rating === 0}
                className={styles.endPrimaryBtn}
              >submit & end →</button>
            </div>
          </>
        )}

        {step === 'confirm-ghost' && (
          <>
            <div className={styles.endEyebrow}>report ghosting</div>
            <h2 className={styles.endTitle}>{otherName} ghosted you?</h2>
            <div className={styles.endWarn}>
              <p>they'll be put in a <strong>{7}-day cooldown</strong>.</p>
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
            <div style={{fontSize:'2.5rem',marginBottom:'.5rem'}}>✓</div>
            done. taking you back to the dashboard.
          </div>
        )}
      </div>
    </div>
  );
}
