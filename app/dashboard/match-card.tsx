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
  hexacoUnlocked?: boolean;
  profileUnlocked?: boolean;
  distanceMi?: number | null;
  beyondRadius?: boolean;
}

// HEXACO is now 2 questions/dim (max 8). Old rows from the 24-Q quiz can be up
// to 16, so we clamp the bar at 100% rather than overflow.
const HEXACO_MAX = 8;

function hoursUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 1000 / 60 / 60));
}

export default function MatchCard({ match, otherUser, currentUserId, isUnlocked, hexacoUnlocked, profileUnlocked, distanceMi, beyondRadius }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
  // Primary photo is always free + visible (any phase) once there's a match —
  // people shouldn't pay to see a face before deciding. Gallery/bio stay paid.
  const showPhoto = !!otherUser.photo_url;

  // Two-tier reveal. $1.99 profile is a superset (also shows HEXACO). Fall back
  // to the legacy single `isUnlocked` flag if the new props aren't passed.
  const showProfile = profileUnlocked ?? isUnlocked;
  const showHexaco = (hexacoUnlocked || profileUnlocked) ?? isUnlocked;
  const hasScores = typeof otherUser.score_honesty === 'number';
  const hasProfileContent =
    !!(otherUser.bio || '').trim() ||
    (Array.isArray(otherUser.gallery) && otherUser.gallery.length > 0);
  const hexacoBars: Array<[string, number]> = ([
    ['Honesty', otherUser.score_honesty],
    ['Emotionality', otherUser.score_emotionality],
    ['Extraversion', otherUser.score_extraversion],
    ['Agreeableness', otherUser.score_agreeableness],
    ['Conscientiousness', otherUser.score_conscientiousness],
    ['Openness', otherUser.score_openness],
  ] as Array<[string, any]>).filter(([, s]) => typeof s === 'number');

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

  async function handleUnlock(tier: 'hexaco' | 'profile') {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/matches/${match.id}/unlock-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
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
    // Distinguish "they passed" from a true accept-window timeout so we don't
    // tell someone a match "expired" when the other person actually declined.
    const wasPassed = (match as any).ended_reason === 'passed' || match.status === 'passed';
    return (
      <div className={styles.matchCard}>
        <div className={styles.matchHeader}>
          <span className={styles.phaseLabel}>{wasPassed ? 'match ended' : 'match expired'}</span>
        </div>
        <h2 className={styles.matchName} style={{ marginBottom: '0.6rem' }}>{wasPassed ? 'on to the next.' : `${first} got away.`}</h2>
        <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.95rem', lineHeight: 1.55, margin: '0 0 1.25rem' }}>
          {wasPassed
            ? 'this one didn’t move forward — no hard feelings. the right match is still out there, and you’re back in line.'
            : 'this one timed out before you both locked in. it happens — and you’re already back in line.'}
        </p>
        <div style={{ background: 'linear-gradient(135deg,#e8edff,#fff)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.4rem' }}>✦ you&apos;re back in the pool</div>
          <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: '#0a0a0a', lineHeight: 1.5 }}>
            your roster's open below — your most compatible people, ready when you are.
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

      {/* HEXACO bars — unlocked by the $0.99 tier (or included in $1.99 profile) */}
      {showHexaco && hexacoBars.length > 0 && (
        <div className={styles.tagSection}>
          <div className={styles.tagLabel}>→ Their HEXACO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
            {hexacoBars.map(([label, score]) => {
              const pct = Math.min(100, Math.round((score / HEXACO_MAX) * 100));
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6975', width: 120, flexShrink: 0 }}>{label}</span>
                  <span style={{ flex: 1, height: 4, background: 'rgba(37,99,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#2563ff', borderRadius: 999 }} />
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#1b46c9', width: 26, textAlign: 'right' }}>{pct}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showProfile ? (
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
        // PAYWALL RULE: only sell an unlock when the matched user has added REAL
        // content themselves (bio and/or gallery photos). HEXACO is auto-generated
        // from the quiz — it is NOT something they "added", so we never sell it on
        // its own. If there's no real content, show nothing to buy. (Fixes the
        // "paid and got only HEXACO / nothing" complaints.)
        hasProfileContent ? (
          <div className={styles.lockedSection}>
            <div className={styles.lockedTitle}>🔒 there&apos;s more to {(otherUser.name || 'them').split(' ')[0]}</div>
            <p className={styles.lockedDescription}>
              unlock {[
                (otherUser.bio || '').trim() ? 'their bio' : null,
                (Array.isArray(otherUser.gallery) && otherUser.gallery.length > 0) ? `${otherUser.gallery.length} more photo${otherUser.gallery.length > 1 ? 's' : ''}` : null,
                'music, food & hobbies',
                'their HEXACO breakdown',
              ].filter(Boolean).join(', ')} — $1.99.
            </p>
            <button onClick={() => handleUnlock('profile')} disabled={busy} className={styles.unlockButton}>
              {busy ? 'loading...' : 'open full profile — $1.99 →'}
            </button>
          </div>
        ) : (
          <div className={styles.lockedSection}>
            <div className={styles.lockedTitle}>🌱 nothing to unlock yet</div>
            <p className={styles.lockedDescription}>
              {(otherUser.name || 'they').split(' ')[0]} hasn&apos;t added a bio or photos yet — so there&apos;s nothing to pay for. their photo and personality are already shown above.
            </p>
          </div>
        )
      )}

      {phase === 'pending' && (
        <>
          <div className={styles.actions}>
            <button onClick={handlePass} disabled={busy} className={styles.passButton}>pass</button>
            <a href={`/match/${match.id}`} className={styles.acceptButton} style={{ textAlign: 'center', textDecoration: 'none' }}>say hi →</a>
          </div>
          <button onClick={handleAccept} disabled={busy} className={styles.reportLink} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            or just accept without a message
          </button>
        </>
      )}

      {phase === 'waiting' && (
        <>
          <div className={styles.statusBox}>
            ✓ you&apos;re in. break the ice — your message lands the moment they open it.
          </div>
          <div className={styles.actions}>
            <a href={`/match/${match.id}`} className={styles.chatButton}>send an opener →</a>
          </div>
          <button onClick={handlePass} disabled={busy} className={styles.reportLink} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            ← unmatch &amp; go back to your roster
          </button>
        </>
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
          <button onClick={() => setReportOpen(true)} className={styles.reportLink}>
            🛡️ report or block {(otherUser?.name || 'them').split(' ')[0]}
          </button>
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

      {reportOpen && (
        <ReportDialog
          reportedId={(otherUser as any)?.id}
          matchId={match.id}
          otherName={otherUser?.name || 'them'}
          onClose={() => setReportOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
