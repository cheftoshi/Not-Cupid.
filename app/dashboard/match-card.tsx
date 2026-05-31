'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';
import EndMatchDialog from '@/components/end-match-dialog';
import DateFeedbackDialog from '@/components/date-feedback-dialog';
import ReportDialog from '@/components/report-dialog';
import { VIBE_HEADS, vibeLabel, relationshipStyleLabel, metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';
import { parseResponse } from '@/lib/fetch-helpers';

// Privacy: show a fuzzy distance band + metro, never the exact ZIP.
function distanceBand(mi: number | null | undefined): string | null {
  if (mi == null) return null;
  if (mi <= 5) return 'nearby';
  if (mi <= 15) return 'a few miles away';
  if (mi <= 35) return 'across town';
  return 'a bit of a trip';
}
function metroLabel(zip: string | null | undefined): string | null {
  const m = metroOf(zip);
  if (m && METRO_CENTERS[m]) return `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}`;
  return null;
}

interface Props {
  match: any;
  otherUser: any;
  currentUserId: string;
  isUnlocked: boolean;
  distanceMi?: number | null;
  beyondRadius?: boolean;
}

function hoursUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 1000 / 60 / 60));
}

export default function MatchCard({ match, otherUser, currentUserId, isUnlocked, distanceMi, beyondRadius }: Props) {
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
        const d = await parseResponse<any>(res);
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
        const d = await parseResponse<any>(res);
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
      const d = await parseResponse<any>(res);
      if (!res.ok || !d.url) throw new Error(d.error || 'Could not start checkout');
      window.location.href = d.url;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (phase === 'expired') {
    const first = (otherUser?.name || 'that match').split(' ')[0];
    return (
      <div className={styles.matchCard}>
        <div className={styles.matchHeader}>
          <span className={styles.phaseLabel}>match expired</span>
        </div>
        <h2 className={styles.matchName} style={{ marginBottom: '0.6rem' }}>{first} got away.</h2>
        <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.95rem', lineHeight: 1.55, margin: '0 0 1.25rem' }}>
          this one timed out before you both locked in. it happens — and you&apos;re already back in line.
        </p>
        <div style={{ background: 'linear-gradient(135deg,#e8edff,#fff)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.4rem' }}>✦ you&apos;re back in the pool</div>
          <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: '#0a0a0a', lineHeight: 1.5 }}>
            the algorithm re-runs every 20 minutes — your next match is already cooking.
          </div>
        </div>
        <div className={styles.actions}>
          <a href="/dashboard" className={styles.chatButton}>see who&apos;s next →</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.matchCard}>
      <div className={styles.matchHeader}>
        <span className={styles.phaseLabel}>
          {phase === 'pending' && 'pending match'}
          {phase === 'waiting' && 'waiting on them'}
          {phase === 'active' && 'active match'}
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
        {(metroLabel(otherUser.zip) || distanceBand(distanceMi)) && (
          <span>📍 {[metroLabel(otherUser.zip), distanceBand(distanceMi)].filter(Boolean).join(' · ')}</span>
        )}
        {match.compatibility_score && <span>{match.compatibility_score}% compatibility</span>}
        {otherUser.relationship_style && <span>💞 {relationshipStyleLabel(otherUser.relationship_style)}</span>}
      </div>
      {beyondRadius && (
        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.8rem', color: '#d2530f', margin: '0 0 1rem', lineHeight: 1.45 }}>
          heads up — this one&apos;s a bit past your usual range, surfaced because the local pool was thin.
        </div>
      )}

      {otherUser.archetype && (
        <div className={styles.archetypeCard}>
          <div className={styles.archetypeLabel}>personality archetype</div>
          <div className={styles.archetypeName}>{otherUser.archetype}</div>
        </div>
      )}

      {isUnlocked ? (
        <div className={styles.unlockedContent}>
          {Array.isArray(otherUser.gallery) && otherUser.gallery.length > 0 && (
            <div className={styles.galleryRow}>
              {otherUser.gallery.map((url: string) => (
                <img key={url} src={url} alt="" className={styles.galleryPhoto} />
              ))}
            </div>
          )}

          {otherUser.bio && <p className={styles.matchBio}>{otherUser.bio}</p>}

          {otherUser.vibes && typeof otherUser.vibes === 'object' && Object.keys(otherUser.vibes).length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Their rhythm</div>
              <div className={styles.tags}>
                {(Object.keys(VIBE_HEADS) as VibeKey[]).map((k) => {
                  const label = vibeLabel(k, otherUser.vibes[k]);
                  if (!label) return null;
                  return (
                    <span
                      key={k}
                      className={styles.tag}
                      style={{ background: 'rgba(37,99,255,0.13)', color: '#1b46c9', borderColor: 'rgba(37,99,255,0.35)' }}
                    >
                      <span style={{ opacity: 0.55, marginRight: '0.4rem', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{VIBE_HEADS[k]}</span>
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

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
      ) : (
        ((otherUser.bio || '').trim() || (Array.isArray(otherUser.gallery) && otherUser.gallery.length > 0)) ? (
          <div className={styles.lockedSection}>
            <div className={styles.lockedTitle}>🔒 know them before you decide</div>
            <p className={styles.lockedDescription}>
              unlock their photos, bio, music, food & hobbies — $2.99
            </p>
            <button onClick={handleUnlock} disabled={busy} className={styles.unlockButton}>
              {busy ? 'loading...' : 'unlock for $2.99 →'}
            </button>
          </div>
        ) : (
          <div className={styles.lockedSection}>
            <div className={styles.lockedTitle}>🌱 not ready yet</div>
            <p className={styles.lockedDescription}>
              {(otherUser.name || 'they').split(' ')[0]} hasn't set up their profile yet — there's nothing extra to unlock. check back soon.
            </p>
            <button disabled className={styles.unlockButton} style={{opacity:0.45,cursor:'not-allowed'}}>
              profile incomplete
            </button>
          </div>
        )
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
            <a href={`/match/${match.id}/date-vibes`} className={styles.chatButton} style={{background:'#2563ff'}}>✦ date vibes →</a>
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
