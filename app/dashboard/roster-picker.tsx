'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseResponse } from '@/lib/fetch-helpers';
import { toast } from '@/components/feedback';
import { SkeletonStyles, SkeletonCard } from '@/components/skeleton';
import { relationshipStyleLabel } from '@/lib/quiz-data';
import ExpandRadiusButton from './expand-radius-button';
import ReactivateButton from '@/components/reactivate-button';
import EndMatchDialog from '@/components/end-match-dialog';
import styles from './dashboard.module.css';

type LiveConnection = { matchId: string; name: string };
// Your chosen/active matches — rendered as the LEADING cards in the carousel.
type ActiveCard = {
  matchId: string; name: string; photo_url: string | null; age: number | null;
  archetype: string | null; score: number | null;
  status: 'chatting' | 'waiting' | 'your-move'; profileUnlocked: boolean; unlockAvailable: boolean;
};

// One horizontal carousel of your people: your chosen matches lead, then the
// most compatible people you can pick. First pick wins — picking creates the
// match (you pre-accepted) and notifies them.
type Candidate = {
  id: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; metro: string | null; relationship_style: string | null; occupation?: string | null; score: number;
  why?: string | null;
};

export default function RosterPicker({
  radius,
  maxRadius,
  maxConnections = 3,
  liveConnections = [],
  activeCards = [],
  horizontal = false,
  hasActive = false,
}: {
  radius: number;
  maxRadius: number;
  maxConnections?: number;
  liveConnections?: LiveConnection[];
  activeCards?: ActiveCard[];
  horizontal?: boolean;
  hasActive?: boolean;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<Candidate[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  // The just-picked candidate — their card flips to a "it's on" moment in place
  // (no hard reload; router.refresh() brings the new chat in behind it).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ghosted, setGhosted] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);
  const [nextRotationAt, setNextRotationAt] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [checkingOut, setCheckingOut] = useState(false);
  // When at capacity, picking opens a "close one first" prompt for this person.
  const [closePromptFor, setClosePromptFor] = useState<Candidate | null>(null);
  // Which existing conversation's end-dialog (reason picker) is open.
  const [endingMatchId, setEndingMatchId] = useState<string | null>(null);
  // At the cap, keep the selected replacement through the end-match flow so
  // confirming the drop completes the swap without asking for a second click.
  const [swapCandidate, setSwapCandidate] = useState<Candidate | null>(null);
  async function unlock(matchId: string) {
    setCheckingOut(true);
    // Safety net: never leave the overlay spinning if the redirect stalls.
    setTimeout(() => setCheckingOut((v) => { if (v) toast('checkout is taking too long — try again', 'error'); return false; }), 10000);
    try {
      const res = await fetch(`/api/matches/${matchId}/unlock-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'profile' }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setCheckingOut(false);
      toast(data.error || 'checkout didn’t open — try again', 'error');
    } catch { setCheckingOut(false); toast('checkout didn’t open — try again', 'error'); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/match/roster');
      const data = await parseResponse<any>(res);
      setGhosted(!!data.ghosted);
      setHardLocked(!!data.hardLocked);
      setAtCapacity(!!data.atCapacity);
      setNextRotationAt(typeof data.nextRotationAt === 'string' ? data.nextRotationAt : null);
      setRoster(Array.isArray(data.roster) ? data.roster : []);
    } catch {
      setRoster([]);
    }
  }

  const rotationMs = nextRotationAt ? new Date(nextRotationAt).getTime() - clock : 0;
  const rotationLabel = nextRotationAt
    ? rotationMs <= 0
      ? 'new rotation ready when you return'
      : `next active rotation in ${Math.max(1, Math.ceil(rotationMs / 3_600_000))}h`
    : null;

  function pick(c: Candidate) {
    if (picking) return;
    // At the cap → don't pick; prompt them to close an existing conversation.
    if (atCapacity || liveConnections.length >= maxConnections) {
      setClosePromptFor(c);
      return;
    }
    void submitPick(c);
  }

  async function submitPick(c: Candidate) {
    if (picking) return;
    setPicking(c.id);
    setNotice(null);
    try {
      const res = await fetch('/api/match/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c.id }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && data.ok) {
        // Match created — flip THIS card to the "it's on" moment in place, then
        // soft-refresh the server data so the new chat appears. No hard reload:
        // scroll stays put and the reveal cinematic still fires for the fresh match.
        setPickedId(c.id);
        setPicking(null);
        setTimeout(() => router.refresh(), 1400);
        return;
      }
      // Conflict (taken / already matched) — show why + refresh the roster.
      setNotice(data.error || 'That didn’t work — refreshed your options.');
      setPicking(null);
      load();
    } catch {
      setNotice('Something went wrong. Try again.');
      setPicking(null);
    }
  }

  // Loading — card silhouettes in the real layout, so nothing shifts when the
  // roster lands.
  if (roster === null) {
    return (
      <div className={styles.loveRoster}>
        <SkeletonStyles />
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.9rem' }}>
          finding your people…
        </p>
        <div className={horizontal ? styles.loveRosterSkeleton : styles.loveRosterGrid}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} width={horizontal ? 210 : undefined} />)}
        </div>
      </div>
    );
  }

  // Ghosted/paused → matching is paused on both lines. Below the hard cap the
  // path back is one gentle, non-destructive click (no profile wipe, no refresh
  // spent). Past the hard cap (repeat ghosting), only an admin can restore them.
  if (ghosted) {
    return (
      <div style={emptyWrap}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>⏸</div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.75rem', color: 'var(--h-text)', margin: '0 0 0.5rem' }}>your matching is paused.</h2>
        {hardLocked ? (
          <>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 460, margin: '0 auto' }}>
              this has happened a few times now, so we&apos;ve paused your account on both lines. if you think that&apos;s a mistake, email us and we&apos;ll take a look.
            </p>
            <a href="mailto:match@notcupid.com" style={{ display: 'inline-block', marginTop: '1.3rem', background: '#0b0b0b', color: '#fff', borderRadius: 999, padding: '0.8rem 1.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              email match@notcupid.com →
            </a>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 460, margin: '0 auto' }}>
              a few of your matches went quiet, so we paused you on both lines to keep things fair. no harm done — pick back up whenever you&apos;re ready.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <ReactivateButton />
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)', marginTop: '0.9rem' }}>
              your profile &amp; past matches stay exactly as they are
            </p>
          </>
        )}
      </div>
    );
  }

  // Empty AND no chosen matches → queue message + widen search.
  if (roster.length === 0 && activeCards.length === 0) {
    return (
      <div style={emptyWrap}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>✦</div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.75rem', color: 'var(--h-text)', margin: '0 0 0.5rem' }}>in the queue.</h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 440, margin: '0 auto' }}>
          recently active people rotate through first. come back tomorrow to refresh your place in line — we&apos;ll also email when your weekly rotation is ready.
        </p>
        <ExpandRadiusButton radius={radius} maxRadius={maxRadius} />
      </div>
    );
  }

  return (
    <div className={styles.loveRoster}>
      <style>{`
        [data-card] { transition: transform .22s var(--ease), box-shadow .22s var(--ease); }
        [data-card]:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        [data-card]:active { transform: translateY(-1px) scale(.99); }
        [data-card] .ncCardImg { transition: transform .4s var(--ease); }
        [data-card]:hover .ncCardImg { transform: scale(1.04); }
        @keyframes ncPickedIn { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      {/* slim header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>
          {hasActive
            ? `${roster.length} more to meet · you choose`
            : `your top ${roster.length} · you choose`}
        </span>
        {horizontal && roster.length > 0 && (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>scroll →</span>
        )}
      </div>

      {rotationLabel && (
        <div style={{ margin: '-0.45rem 0 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>
          {rotationLabel} · returning keeps you active
        </div>
      )}

      {atCapacity && (
        <div style={{ background: 'var(--h-surface-3)', border: '1px solid rgba(255,106,31,0.4)', color: 'var(--h-accent-2)', borderRadius: 12, padding: '0.75rem 0.95rem', marginBottom: '1rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5 }}>
          your three connection slots are full. these five stay browseable — choose one to swap with a current match.
        </div>
      )}

      {notice && (
        <div style={{ background: 'var(--h-surface-3)', border: '1px solid rgba(255,106,31,0.4)', color: 'var(--h-accent-2)', borderRadius: 12, padding: '0.7rem 0.9rem', marginBottom: '1rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
          {notice}
        </div>
      )}

      {/* compatible people — a horizontal row (dashboard) or a responsive grid */}
      <div
        className={horizontal ? styles.loveRosterRail : styles.loveRosterGrid}
        aria-label="Active Love Line matches followed by curated options"
        data-love-roster={horizontal ? 'carousel' : 'grid'}
      >
        {/* CHOSEN / active matches — the leading cards */}
        {activeCards.map((a) => {
          const first = (a.name || 'your match').split(' ')[0];
          const statusLabel = a.status === 'chatting' ? '● chatting' : a.status === 'your-move' ? '● your move' : '● waiting on them';
          const statusColor = a.status === 'chatting' ? '#2d7a4f' : a.status === 'your-move' ? '#2563ff' : 'var(--h-text-dim)';
          return (
            <div key={a.matchId} data-card data-roster-kind="active" className={horizontal ? styles.loveRosterCard : undefined} style={{ ...cardBase, border: '2px solid #2563ff' }}>
              <div style={{ aspectRatio: '4 / 5', background: 'var(--h-surface-2)', position: 'relative' }}>
                {a.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ncCardImg" src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Monogram first={first} />
                )}
                <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--h-surface)', color: statusColor, borderRadius: 999, padding: '3px 9px', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{statusLabel}</div>
                {a.score != null && (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(11,11,11,0.82)', color: '#fff', borderRadius: 999, padding: '4px 11px', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', fontWeight: 600 }}>{a.score}<span style={{ color: '#ff6a1f' }}>%</span></div>
                )}
              </div>
              <div style={{ padding: '0.9rem 0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontSize: '1.3rem', color: 'var(--h-text)', fontWeight: 700 }}>
                  {first}{a.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--h-text-dim)' }}>, {a.age}</span> : null}
                </div>
                {a.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', lineHeight: 1.3 }}>{a.archetype}</div>}
                <a className={styles.loveRosterAction} href={`/match/${a.matchId}`} style={{ marginTop: 'auto', textAlign: 'center', textDecoration: 'none', background: '#2563ff', color: '#fff', borderRadius: 11, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {a.status === 'your-move' ? 'say hi →' : 'open chat →'}
                </a>
                {!a.profileUnlocked && a.unlockAvailable && (
                  <button className={styles.loveRosterAction} onClick={() => unlock(a.matchId)} style={{ background: 'none', border: '1px solid var(--h-border)', color: 'var(--h-accent)', borderRadius: 10, padding: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>🔒 see more · $0.99</button>
                )}
              </div>
            </div>
          );
        })}

        {/* the rest — compatible people you can choose */}
        {roster.map((c) => {
          const first = (c.name || 'someone').split(' ')[0];
          const style = relationshipStyleLabel(c.relationship_style);
          return (
            <div key={c.id} data-card data-roster-kind="option" className={horizontal ? styles.loveRosterCard : undefined} style={cardBase}>
              <div style={{ aspectRatio: '4 / 5', background: 'var(--h-surface-2)', position: 'relative' }}>
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ncCardImg" src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Monogram first={first} />
                )}
                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(11,11,11,0.82)', color: '#fff', borderRadius: 999, padding: '4px 11px', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', fontWeight: 600 }}>
                  {c.score}<span style={{ color: '#ff6a1f' }}>%</span>
                </div>
              </div>
              <div style={{ padding: '0.9rem 0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontSize: '1.3rem', color: 'var(--h-text)', fontWeight: 700 }}>
                  {first}{c.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--h-text-dim)' }}>, {c.age}</span> : null}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: '#2563ff', fontWeight: 700 }}>✦ {c.score}% compatible</div>
                {c.why && <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.76rem', lineHeight: 1.35, color: 'var(--h-text-dim)' }}>{c.why}.</div>}
                {c.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', lineHeight: 1.3 }}>{c.archetype}</div>}
                {c.occupation && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)' }}>💼 {c.occupation}</div>}
                {style && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', color: 'var(--h-accent)' }}>💞 {style}</div>}
                {c.metro && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-faint)' }}>📍 {c.metro}</div>}
                {pickedId === c.id ? (
                  <div style={{ marginTop: 'auto', textAlign: 'center', background: 'rgba(37,99,255,0.1)', border: '1.5px solid #2563ff', color: '#2563ff', borderRadius: 11, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, animation: 'ncPickedIn .4s var(--ease) both' }}>
                    ✦ it&apos;s on — opening your chat…
                  </div>
                ) : (
                <button
                  className={styles.loveRosterAction}
                  onClick={() => pick(c)}
                  disabled={!!picking || !!pickedId}
                  style={{
                    marginTop: 'auto', background: picking === c.id ? '#1b46c9' : '#0b0b0b', color: '#fff', border: 'none',
                    borderRadius: 11, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: picking ? 'wait' : 'pointer',
                    opacity: (picking && picking !== c.id) || pickedId ? 0.4 : 1,
                  }}
                >
                  {picking === c.id ? 'connecting…' : atCapacity ? `close a chat to open →` : `choose ${first} →`}
                </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', marginTop: '0.25rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>
        active picks rotate daily · weekly reminder by email + push
      </p>

      {/* Checkout hand-off — never a silent redirect. */}
      {checkingOut && (
        <div className={styles.loveModalOverlay}>
          <div className={styles.loveCheckoutCard}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>🔒</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>taking you to secure checkout…</div>
          </div>
        </div>
      )}

      {/* At-capacity: choosing prompts the user to close one existing chat. */}
      {closePromptFor && (
        <div
          onClick={() => setClosePromptFor(null)}
          className={styles.loveModalOverlay}
        >
          <div onClick={(e) => e.stopPropagation()} className={styles.loveSwapSheet}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.5rem' }}>your inbox is full</div>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.4rem' }}>
              close a chat to open one with {(closePromptFor.name || 'them').split(' ')[0]}.
            </h3>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 1.1rem' }}>
              Love Line keeps up to {maxConnections} connections active. choose which one to close, and we&apos;ll connect your new pick automatically:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {liveConnections.map((lc) => (
                <button
                  className={styles.loveSwapChoice}
                  key={lc.matchId}
                  onClick={() => {
                    setSwapCandidate(closePromptFor);
                    setClosePromptFor(null);
                    setEndingMatchId(lc.matchId);
                  }}
                  style={{ background: 'var(--h-surface-3)', border: '1.5px solid var(--h-border)', borderRadius: 12, padding: '0.8rem 1rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: 'var(--h-text)' }}>{(lc.name || 'your match').split(' ')[0]}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-accent-2)' }}>end this →</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setClosePromptFor(null)}
              style={{ marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}
            >
              never mind
            </button>
          </div>
        </div>
      )}

      {/* The reason picker for closing a conversation (shared component). */}
      {endingMatchId && (
        <EndMatchDialog
          matchId={endingMatchId}
          otherName={(liveConnections.find((l) => l.matchId === endingMatchId)?.name || 'them').split(' ')[0]}
          onClose={() => { setEndingMatchId(null); setSwapCandidate(null); }}
          onEnded={() => {
            const replacement = swapCandidate;
            setEndingMatchId(null);
            setSwapCandidate(null);
            setAtCapacity(false);
            void load();
            router.refresh();
            if (replacement) void submitPick(replacement);
          }}
        />
      )}
    </div>
  );
}

const emptyWrap: React.CSSProperties = {
  background: 'var(--h-surface)',
  border: '1px dashed var(--h-border)',
  borderRadius: 20,
  padding: '3rem 2rem',
  textAlign: 'center',
  marginBottom: '3rem',
};

// Shared grid card box (chosen + candidate cards share this footprint).
const cardBase: React.CSSProperties = {
  background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 18,
  overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)',
};

// No-photo state → a soft brand-tinted gradient with a big serif initial, instead
// of an empty "no photo" void. Adapts to dark mode via the surface token.
function Monogram({ first }: { first: string }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 30% 26%, rgba(37,99,255,0.18), transparent 58%), radial-gradient(circle at 78% 82%, rgba(255,106,31,0.13), transparent 55%), var(--h-surface-2)',
    }}>
      <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '3.6rem', color: 'var(--h-accent)', opacity: 0.92, lineHeight: 1 }}>
        {(first?.[0] || '✦').toUpperCase()}
      </span>
    </div>
  );
}
