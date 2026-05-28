'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';
import EndMatchDialog from '@/components/end-match-dialog';
import DateFeedbackDialog from '@/components/date-feedback-dialog';

interface Props {
  match: any;
  otherUser: any;
  currentUserId: string;
  isUnlocked: boolean;
}

function hoursUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 1000 / 60 / 60));
}

export default function MatchCard({ match, otherUser, currentUserId, isUnlocked }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const isUser1 = match.user_1_id === currentUserId;
  const myAccepted = isUser1 ? match.user_1_accepted : match.user_2_accepted;
  const bothAccepted = match.user_1_accepted && match.user_2_accepted;
  const matchEnded = match.status === 'ended' || !!match.ended_at;
  const expired = match.expires_at && new Date(match.expires_at) < new Date() && !bothAccepted;

  let phase: 'pending' | 'waiting' | 'active' | 'expired';
  if (matchEnded || expired) phase = 'expired';
  else if (bothAccepted) phase = 'active';
  else if (myAccepted) phase = 'waiting';
  else phase = 'pending';

  const expiresIn = match.expires_at ? hoursUntil(match.expires_at) : null;
  const showPhoto = phase === 'active';

  async function handleAccept() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/matches/${match.id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to accept');
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePass() {
    if (!confirm('Pass on this match? This ends it for both of you.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/matches/${match.id}/pass`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to pass');
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/matches/${match.id}/unlock-checkout`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error || 'Could not start checkout');
      window.location.href = d.url;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className={styles.matchCard}>
      <div className={styles.matchHeader}>
        <span className={styles.phaseLabel}>
          {phase === 'pending' && 'pending match'}
          {phase === 'waiting' && 'waiting on them'}
          {phase === 'active' && 'active match'}
          {phase === 'expired' && 'expired'}
        </span>
        {expiresIn !== null && expiresIn > 0 && phase !== 'active' && (
          <span className={styles.timer}>expires in {expiresIn}h</span>
        )}
      </div>

      {showPhoto && otherUser.photo_url && (
        <div className={styles.photoWrap}>
          <img src={otherUser.photo_url} alt="" className={styles.photo} />
        </div>
      )}

      <h2 className={styles.matchName}>
        {otherUser.name || 'Match'}
        {otherUser.age ? <span className={styles.matchAge}>, {otherUser.age}</span> : null}
      </h2>

      <div className={styles.matchMeta}>
        {otherUser.zip && <span>📍 {otherUser.zip}</span>}
        {match.compatibility_score && <span>{match.compatibility_score}% compatibility</span>}
      </div>

      {otherUser.archetype && (
        <div className={styles.archetypeCard}>
          <div className={styles.archetypeLabel}>personality archetype</div>
          <div className={styles.archetypeName}>{otherUser.archetype}</div>
        </div>
      )}

      {isUnlocked ? (
        <div className={styles.unlockedContent}>
          {otherUser.bio && <p className={styles.matchBio}>{otherUser.bio}</p>}
          {otherUser.music?.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Music</div>
              <div className={styles.tags}>
                {otherUser.music.map((t: string) => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
            </div>
          )}
          {otherUser.food?.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Food</div>
              <div className={styles.tags}>
                {otherUser.food.map((t: string) => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
            </div>
          )}
          {otherUser.hobbies?.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Hobbies & obsessions</div>
              <div className={styles.tags}>
                {otherUser.hobbies.map((t: string) => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
            </div>
          )}
        </div>
      ) : phase !== 'expired' && (
        <div className={styles.lockedSection}>
          <div className={styles.lockedTitle}>🔒 know them before you decide</div>
          <p className={styles.lockedDescription}>
            unlock their bio, music, food & hobbies — $2.99
          </p>
          <button onClick={handleUnlock} disabled={busy} className={styles.unlockButton}>
            {busy ? 'loading...' : 'unlock for $2.99 →'}
          </button>
        </div>
      )}

      {phase === 'pending' && (
        <div className={styles.actions}>
          <button onClick={handlePass} disabled={busy} className={styles.passButton}>pass</button>
          <button onClick={handleAccept} disabled={busy} className={styles.acceptButton}>accept →</button>
        </div>
      )}

      {phase === 'waiting' && (
        <div className={styles.statusBox}>
          ✓ you accepted. waiting for them to decide.
        </div>
      )}

      {phase === 'active' && (
        <>
          <div className={styles.actions}>
            <a href={`/match/${match.id}`} className={styles.chatButton}>open chat →</a>
          </div>
          <div className={styles.subActions}>
            <button onClick={() => setFeedbackOpen(true)} className={styles.subBtnDate}>
              🍷 we went on a date
            </button>
            <button onClick={() => setEndOpen(true)} className={styles.subBtnEnd}>
              end match
            </button>
          </div>
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {endOpen && (
        <EndMatchDialog
          matchId={match.id}
          otherName={otherUser?.name || 'them'}
          onClose={() => setEndOpen(false)}
          onEnded={() => router.refresh()}
        />
      )}

      {feedbackOpen && (
        <DateFeedbackDialog
          matchId={match.id}
          otherName={otherUser?.name || 'them'}
          onClose={() => setFeedbackOpen(false)}
          onSubmitted={() => router.refresh()}
        />
      )}
    </div>
  );
}
