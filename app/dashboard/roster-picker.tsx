'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTimeout, parseResponse } from '@/lib/fetch-helpers';
import { trackLoveEvent } from '@/lib/love-events-client';
import { SkeletonStyles, SkeletonCard } from '@/components/skeleton';
import { relationshipStyleLabel } from '@/lib/quiz-data';
import ExpandRadiusButton from './expand-radius-button';
import ReactivateButton from '@/components/reactivate-button';
import styles from './dashboard.module.css';

type LiveConnection = { matchId: string; name: string };

// Three included picks plus seven browseable alternatives. Active conversations live
// in their own section on the dashboard; keeping them out of this rail prevents
// the same person appearing three times in one screen.
type Candidate = {
  id: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; metro: string | null; relationship_style: string | null; occupation?: string | null; score: number;
  bio?: string | null;
  prompts?: Array<{ question: string; answer: string }>;
  interests?: string[];
  loveAvailability?: 'actively_looking' | 'open_to_meeting';
  activityLabel?: 'active recently' | 'active lately' | null;
  why?: string | null;
  scoreConfidence?: number;
  hasIntroVideo?: boolean;
};

type CompatibilityRead = {
  version: string;
  firstName: string;
  headline: string;
  overview: string;
  traits: Array<{
    key: string;
    label: string;
    focus: string;
    candidateBand: 'leans lower' | 'middle range' | 'leans higher';
    pairDynamic: string;
  }>;
  strengths: string[];
  watchouts: string[];
  firstDateIdea: string;
  source: 'ai' | 'curated';
  disclosure: string;
};

export default function RosterPicker({
  radius,
  maxRadius,
  maxConnections = 3,
  includedPicks = 3,
  liveConnections = [],
  horizontal = false,
  hasActive = false,
  paidCandidateId,
  compatibilityCandidateId,
  checkoutError = false,
}: {
  radius: number;
  maxRadius: number;
  maxConnections?: number;
  includedPicks?: number;
  liveConnections?: LiveConnection[];
  horizontal?: boolean;
  hasActive?: boolean;
  paidCandidateId?: string;
  compatibilityCandidateId?: string;
  checkoutError?: boolean;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  // The just-picked candidate — their card flips to a "it's on" moment in place
  // (no hard reload; router.refresh() brings the new chat in behind it).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ghosted, setGhosted] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);
  const [includedRemaining, setIncludedRemaining] = useState(includedPicks);
  const [pro, setPro] = useState(false);
  const [creditCandidateIds, setCreditCandidateIds] = useState<string[]>([]);
  const [connectionCreditCount, setConnectionCreditCount] = useState(0);
  const [flexibleCreditCount, setFlexibleCreditCount] = useState(0);
  const [nextRotationAt, setNextRotationAt] = useState<string | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [previewTab, setPreviewTab] = useState<'profile' | 'compatibility'>('profile');
  const [compatibilityReadCandidateIds, setCompatibilityReadCandidateIds] = useState<string[]>([]);
  const [compatibilityReadIncluded, setCompatibilityReadIncluded] = useState(false);
  const [compatibilityReads, setCompatibilityReads] = useState<Record<string, CompatibilityRead>>({});
  const [compatibilityLoading, setCompatibilityLoading] = useState<string | null>(null);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [paywallCandidate, setPaywallCandidate] = useState<Candidate | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const resumedCheckout = useRef(false);
  useEffect(() => {
    trackLoveEvent('love_dashboard_open');
    void load();
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!nextRotationAt) return;
    const remaining = new Date(nextRotationAt).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = window.setTimeout(() => void load(), Math.max(1_000, remaining + 1_000));
    return () => window.clearTimeout(timer);
  }, [nextRotationAt]);
  useEffect(() => {
    if (!previewCandidate && !paywallCandidate) return;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPreviewCandidate(null); setPaywallCandidate(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [previewCandidate, paywallCandidate]);
  useEffect(() => {
    if (checkoutError) setNotice('Checkout did not complete. Nothing was charged; your roster is still here.');
  }, [checkoutError]);
  useEffect(() => {
    if (!paywallCandidate) return;
    void fetch('/api/monetization/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'love_connection', surface: 'love_roster_extra' }),
    }).catch(() => {});
  }, [paywallCandidate]);

  async function load() {
    const startedAt = performance.now();
    setLoadError(false);
    try {
      const res = await fetchWithTimeout('/api/match/roster', {}, 15_000);
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Roster unavailable');
      setGhosted(!!data.ghosted);
      setHardLocked(!!data.hardLocked);
      setAtCapacity(!!data.atCapacity);
      setIncludedRemaining(typeof data.includedPicksRemaining === 'number' ? data.includedPicksRemaining : includedPicks);
      setPro(!!data.pro);
      setCreditCandidateIds(Array.isArray(data.connectionCreditCandidateIds) ? data.connectionCreditCandidateIds : []);
      setConnectionCreditCount(typeof data.connectionCreditCount === 'number' ? data.connectionCreditCount : 0);
      setCompatibilityReadCandidateIds(Array.isArray(data.compatibilityReadCandidateIds) ? data.compatibilityReadCandidateIds : []);
      setCompatibilityReadIncluded(!!data.compatibilityReadIncluded);
      setFlexibleCreditCount(typeof data.flexibleConnectionCreditCount === 'number'
        ? data.flexibleConnectionCreditCount
        : data.hasFlexibleConnectionCredit ? 1 : 0);
      setNextRotationAt(typeof data.nextRotationAt === 'string' ? data.nextRotationAt : null);
      const nextRoster = Array.isArray(data.roster) ? data.roster : [];
      setRoster(nextRoster);
      const durationMs = Math.round(performance.now() - startedAt);
      trackLoveEvent('roster_view', { durationMs, metadata: { candidate_count: nextRoster.length } });
      const timingPayload = JSON.stringify({
        eventName: 'api_timing', metricName: 'roster_api', durationMs,
        path: window.location.pathname,
        deviceClass: window.innerWidth < 600 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
        displayMode: (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      });
      const beaconed = navigator.sendBeacon?.('/api/performance', new Blob([timingPayload], { type: 'application/json' })) === true;
      if (!beaconed) void fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: timingPayload, keepalive: true }).catch(() => {});
    } catch {
      setRoster([]);
      setLoadError(true);
    }
  }

  useEffect(() => {
    if (resumedCheckout.current || !paidCandidateId || !Array.isArray(roster)) return;
    resumedCheckout.current = true;
    window.history.replaceState({}, '', '/dashboard#roster');
    const candidate = roster.find((item) => item.id === paidCandidateId);
    if (candidate) void submitPick(candidate, true);
    else setNotice('Your $0.99 extra-connection credit is ready. Choose any available roster profile.');
  }, [paidCandidateId, roster]);

  useEffect(() => {
    if (!compatibilityCandidateId || !Array.isArray(roster)) return;
    window.history.replaceState({}, '', '/dashboard#roster');
    const candidate = roster.find((item) => item.id === compatibilityCandidateId);
    if (!candidate) {
      setNotice('Your AI Compatibility Read and person-specific Love credit are ready for that profile.');
      return;
    }
    setCompatibilityReadCandidateIds((ids) => ids.includes(candidate.id) ? ids : [...ids, candidate.id]);
    setPreviewCandidate(candidate);
    setPreviewTab('compatibility');
    void loadCompatibilityRead(candidate.id);
  }, [compatibilityCandidateId, roster]);

  const hasFlexibleCredit = flexibleCreditCount > 0;

  const rotationMs = nextRotationAt ? new Date(nextRotationAt).getTime() - clock : 0;
  const rotationLabel = (() => {
    if (!nextRotationAt) return null;
    if (rotationMs <= 0) return 'checking your roster now';
    const target = new Date(nextRotationAt);
    const today = new Date(clock);
    const tomorrow = new Date(clock);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (target.toDateString() === today.toDateString()) {
      return `next roster check today at ${target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    if (target.toDateString() === tomorrow.toDateString()) return 'next roster check tomorrow';
    return `next roster check ${target.toLocaleDateString('en-US', { weekday: 'long' })}`;
  })();

  function pick(c: Candidate) {
    if (picking) return;
    if (atCapacity || liveConnections.length >= maxConnections) {
      setNotice(`You have reached the ${maxConnections}-connection safety limit. End one only when you actually want to close it.`);
      return;
    }
    const hasCredit = hasFlexibleCredit || creditCandidateIds.includes(c.id);
    trackLoveEvent('pick_attempt', {
      candidateId: c.id,
      metadata: { access: !pro && includedRemaining <= 0 && !hasCredit ? 'paywall' : hasCredit ? 'credit' : pro ? 'pro' : 'included' },
    });
    if (!pro && includedRemaining <= 0 && !hasCredit) {
      setPaywallCandidate(c);
      return;
    }
    if (hasCredit && !compatibilityReadIncluded && !compatibilityReadCandidateIds.includes(c.id)) {
      // A returned/pre-release connection credit also carries the new read.
      // Bind it to this person and show the decision support before spending it.
      void openExtraConnectionCheckout(c);
      return;
    }
    void submitPick(c, hasCredit);
  }

  async function submitPick(c: Candidate, preferPaid = false) {
    if (picking) return;
    setPicking(c.id);
    setNotice(null);
    try {
      const res = await fetchWithTimeout('/api/match/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c.id, preferPaid }),
      }, 15_000);
      const data = await parseResponse<any>(res);
      if (res.ok && data.ok) {
        if (data.accessType === 'included') setIncludedRemaining((remaining) => Math.max(0, remaining - 1));
        if (data.accessType === 'paid') {
          if (creditCandidateIds.includes(c.id)) {
            setCreditCandidateIds((ids) => {
              const index = ids.indexOf(c.id);
              return index < 0 ? ids : [...ids.slice(0, index), ...ids.slice(index + 1)];
            });
          } else {
            setFlexibleCreditCount((count) => Math.max(0, count - 1));
          }
          setConnectionCreditCount((count) => Math.max(0, count - 1));
        }
        // Match created — flip THIS card to the "it's on" moment in place, then
        // soft-refresh the server data so the new chat appears. No hard reload:
        // scroll stays put and the reveal cinematic still fires for the fresh match.
        setPickedId(c.id);
        setPicking(null);
        setPreviewCandidate(null);
        window.dispatchEvent(new Event('nc:show-push-prompt'));
        // router.refresh() intentionally preserves client component state. The
        // old global `pickedId` disable therefore made every remaining card
        // look locked after the first choice—especially obvious in the PWA.
        // Keep the success moment briefly, then remove only this card and load
        // the authoritative roster without blocking the other included picks.
        window.setTimeout(() => {
          setRoster((current) => current?.filter((item) => item.id !== c.id) ?? current);
          setPickedId((current) => current === c.id ? null : current);
          void load();
          router.refresh();
        }, 900);
        return;
      }
      if (res.status === 402 && data.paywall) {
        setPaywallCandidate(c);
        setPicking(null);
        return;
      }
      // Conflict (taken / already matched) — show why + refresh the roster.
      setNotice(data.error || 'That didn’t work — refreshed your options.');
      trackLoveEvent('pick_failed', {
        candidateId: c.id,
        metadata: {
          status: res.status,
          reason: typeof data.code === 'string'
            ? data.code
            : res.status === 403
              ? 'stale_roster'
              : res.status === 409
                ? 'candidate_unavailable'
                : res.status >= 500
                  ? 'server_error'
                  : 'request_rejected',
        },
      });
      setPicking(null);
      load();
    } catch {
      setNotice('Something went wrong. Try again.');
      trackLoveEvent('pick_failed', { candidateId: c.id, metadata: { status: 'network' } });
      setPicking(null);
    }
  }

  async function openExtraConnectionCheckout(candidate: Candidate) {
    if (checkoutBusy) return;
    setCheckoutBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/match/connection-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, mode: 'compatibility_read' }),
      });
      const data = await parseResponse<any>(res);
      if (res.ok && (data.insightReady || data.creditReady)) {
        setCompatibilityReadCandidateIds((ids) => ids.includes(candidate.id) ? ids : [...ids, candidate.id]);
        setPaywallCandidate(null);
        setCheckoutBusy(false);
        setPreviewCandidate(candidate);
        setPreviewTab('compatibility');
        void loadCompatibilityRead(candidate.id);
        return;
      }
      if (res.ok && typeof data.url === 'string') {
        window.location.href = data.url;
        return;
      }
      setNotice(data.error || 'Checkout could not open. Nothing was charged.');
    } catch {
      setNotice('Checkout could not open. Nothing was charged.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function loadCompatibilityRead(candidateId: string) {
    if (compatibilityReads[candidateId] || compatibilityLoading === candidateId) return;
    setCompatibilityLoading(candidateId);
    setCompatibilityError(null);
    trackLoveEvent('compatibility_read_requested', { candidateId });
    try {
      const res = await fetchWithTimeout(`/api/love/compatibility-read/${encodeURIComponent(candidateId)}`, {}, 30_000);
      const data = await parseResponse<any>(res);
      if (!res.ok || !data.read) throw new Error(data.error || 'Compatibility read unavailable.');
      setCompatibilityReads((reads) => ({ ...reads, [candidateId]: data.read as CompatibilityRead }));
    } catch (error) {
      setCompatibilityError(error instanceof Error ? error.message : 'Compatibility read unavailable.');
    } finally {
      setCompatibilityLoading(null);
    }
  }

  function openProfile(candidate: Candidate) {
    setPreviewCandidate(candidate);
    setPreviewTab('profile');
    setCompatibilityError(null);
    trackLoveEvent('profile_open', { candidateId: candidate.id });
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

  if (loadError) {
    return (
      <div style={emptyWrap} role="alert">
        <div style={{ fontSize: '2.2rem', marginBottom: '0.65rem' }}>↻</div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.65rem', color: 'var(--h-text)', margin: '0 0 0.5rem' }}>your roster hit a connection snag.</h2>
        <p style={{ color: 'var(--h-text-dim)', lineHeight: 1.5, marginBottom: '1rem' }}>Your picks are safe. Reconnect and try loading the same roster again.</p>
        <button type="button" className="btn-primary" onClick={() => { setRoster(null); void load(); }}>retry roster</button>
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
  if (roster.length === 0 && liveConnections.length === 0) {
    return (
      <div style={emptyWrap}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>✦</div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.75rem', color: 'var(--h-text)', margin: '0 0 0.5rem' }}>in the queue.</h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 440, margin: '0 auto' }}>
          recently active people rotate through first. Love Line checks again after 24 hours when you return; in a smaller pool, some compatible people may stay.
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
            ? `${roster.length} options · ${pro ? 'extra picks included with Pro' : `${includedRemaining} of ${includedPicks} included picks left`}`
            : `${roster.length} curated options · ${includedPicks} picks included`}
        </span>
        {horizontal && roster.length > 0 && (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>scroll →</span>
        )}
      </div>

      {rotationLabel && (
        <div style={{ margin: '-0.45rem 0 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>
          {rotationLabel} · fresh people appear when compatible options are available
        </div>
      )}

      {atCapacity && (
        <div style={{ background: 'var(--h-surface-3)', border: '1px solid rgba(255,106,31,0.4)', color: 'var(--h-accent-2)', borderRadius: 12, padding: '0.75rem 0.95rem', marginBottom: '1rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5 }}>
          you reached the {maxConnections}-connection safety limit. profiles stay browseable, but open another only after you genuinely end one.
        </div>
      )}

      {!atCapacity && !pro && includedRemaining === 0 && (
        <div style={{ background: 'var(--h-surface-3)', border: '1px solid rgba(37,99,255,0.35)', color: 'var(--h-text)', borderRadius: 12, padding: '0.8rem 0.95rem', marginBottom: '1rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.86rem', textAlign: 'center', lineHeight: 1.5 }}>
          you used this roster&apos;s {includedPicks} included picks. every profile stays free to view; each extra distinct connection is a one-time $0.99.
        </div>
      )}

      {!pro && connectionCreditCount > 0 && (
        <div style={{ background: 'rgba(37,122,79,0.08)', border: '1px solid rgba(45,122,79,0.35)', color: '#2d7a4f', borderRadius: 12, padding: '0.8rem 0.95rem', marginBottom: '1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.5 }}>
          ✓ {connectionCreditCount === 1 ? 'one in-app Love credit is ready' : `${connectionCreditCount} in-app Love credits are ready`} · your next {connectionCreditCount === 1 ? 'extra connection is' : 'extra connections are'} covered
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
        aria-label="Curated Love Line options"
        data-love-roster={horizontal ? 'carousel' : 'grid'}
      >
        {/* Compatible people you can choose. Active chats are intentionally not
            repeated here; they live in the conversation section above. */}
        {roster.map((c) => {
          const first = (c.name || 'someone').split(' ')[0];
          const style = relationshipStyleLabel(c.relationship_style);
          return (
            <div key={c.id} data-card data-roster-kind="option" className={horizontal ? styles.loveRosterCard : undefined} style={cardBase}>
              <button
                type="button"
                onClick={() => openProfile(c)}
                aria-label={`View ${first}'s profile`}
                style={{ aspectRatio: '4 / 5', width: '100%', padding: 0, border: 0, background: 'var(--h-surface-2)', position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
              >
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ncCardImg" src={c.photo_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Monogram first={first} />
                )}
                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(11,11,11,0.82)', color: '#fff', borderRadius: 999, padding: '4px 11px', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', fontWeight: 600 }}>
                  {c.score}<span style={{ color: '#ff6a1f' }}>%</span>
                </div>
                {c.hasIntroVideo && (
                  <div style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(11,11,11,0.82)', color: '#fff', borderRadius: 999, padding: '4px 9px', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    🎬 video hello
                  </div>
                )}
              </button>
              <div style={{ padding: '0.9rem 0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontSize: '1.3rem', color: 'var(--h-text)', fontWeight: 700 }}>
                  {first}{c.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--h-text-dim)' }}>, {c.age}</span> : null}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: '#2563ff', fontWeight: 700 }}>✦ {c.score}% compatible</div>
                {c.why && <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.76rem', lineHeight: 1.35, color: 'var(--h-text-dim)' }}>{(c.scoreConfidence ?? 0) < 0.5 ? 'early read: ' : ''}{c.why}.</div>}
                {c.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', lineHeight: 1.3 }}>{c.archetype}</div>}
                {c.occupation && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)' }}>💼 {c.occupation}</div>}
                {style && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', color: 'var(--h-accent)' }}>💞 {style}</div>}
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-accent-2)' }}>
                  ● {c.loveAvailability === 'actively_looking' ? 'actively looking' : 'open to meeting'}{c.activityLabel ? ` · ${c.activityLabel}` : ''}
                </div>
                {c.metro && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-faint)' }}>📍 {c.metro}</div>}
                <button
                  type="button"
                  onClick={() => openProfile(c)}
                  className={styles.loveRosterPreviewAction}
                >
                  view {first}&apos;s profile
                </button>
                {pickedId === c.id ? (
                  <div style={{ marginTop: 'auto', textAlign: 'center', background: 'rgba(37,99,255,0.1)', border: '1.5px solid #2563ff', color: '#2563ff', borderRadius: 11, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, animation: 'ncPickedIn .4s var(--ease) both' }}>
                    ✦ it&apos;s on — opening your chat…
                  </div>
                ) : (
                <button
                  className={styles.loveRosterAction}
                  onClick={() => pick(c)}
                  disabled={!!picking || pickedId === c.id}
                  style={{
                    marginTop: 'auto', background: picking === c.id ? '#1b46c9' : '#0b0b0b', color: '#fff', border: 'none',
                    borderRadius: 11, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: picking ? 'wait' : 'pointer',
                    opacity: (picking && picking !== c.id) || pickedId === c.id ? 0.4 : 1,
                  }}
                >
                  {picking === c.id
                    ? 'connecting…'
                    : atCapacity
                      ? 'safety limit reached'
                      : pro
                        ? `choose ${first} · Pro →`
                        : (hasFlexibleCredit || creditCandidateIds.includes(c.id))
                          ? (compatibilityReadIncluded || compatibilityReadCandidateIds.includes(c.id)
                            ? 'match + chat · AI read unlocked →'
                            : 'open AI read · use credit →')
                          : includedRemaining > 0
                            ? `choose ${first} · included →`
                            : 'match + chat + AI read · $0.99 →'}
                </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {roster.length > 0 && (
        <button
          type="button"
          onClick={() => {
            trackLoveEvent('no_suitable_choice', { metadata: { candidate_count: roster.length } });
            setNotice('Got it — no forced pick. Your roster will check for fresh compatible people at the next rotation.');
          }}
          style={{ display: 'block', margin: '0.4rem auto 0', minHeight: 44, padding: '0.55rem 0.9rem', border: '1px solid var(--h-border)', borderRadius: 999, background: 'var(--h-surface)', color: 'var(--h-text-dim)', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          none of these feel right today
        </button>
      )}

      <p style={{ textAlign: 'center', marginTop: '0.25rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>
        checks for fresh options every 24h · shown people cool down for 7 days
      </p>

      {previewCandidate && (() => {
        const candidate = previewCandidate;
        const first = (candidate.name || 'someone').split(' ')[0];
        const relationship = relationshipStyleLabel(candidate.relationship_style);
        const readUnlocked = compatibilityReadIncluded || compatibilityReadCandidateIds.includes(candidate.id);
        const compatibilityRead = compatibilityReads[candidate.id];
        return (
          <div
            className={styles.loveModalOverlay}
            onClick={() => setPreviewCandidate(null)}
            role="presentation"
          >
            <section
              className={styles.loveProfilePreviewSheet}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="love-roster-profile-title"
            >
              <div className={styles.loveProfilePreviewToolbar}>
                <span>Love roster profile</span>
                <button type="button" className={styles.loveProfilePreviewClose} onClick={() => setPreviewCandidate(null)} aria-label="Close profile preview">×</button>
              </div>
              <div className={styles.loveProfilePreviewScroll}>
              <div className={styles.loveProfilePreviewPhoto}>
                {candidate.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={candidate.photo_url} alt="" loading="lazy" decoding="async" />
                ) : <Monogram first={first} />}
                <span>{candidate.score}% match</span>
              </div>
              <div className={styles.loveProfilePreviewBody}>
                <div className={styles.loveProfilePreviewEyebrow}>{previewTab === 'profile' ? 'free roster profile' : 'AI Connect Coach'}</div>
                <h3 id="love-roster-profile-title">{first}{candidate.age ? `, ${candidate.age}` : ''}</h3>
                <div className={styles.loveProfilePreviewFacts}>
                  {candidate.archetype && <span>{candidate.archetype}</span>}
                  {candidate.occupation && <span>{candidate.occupation}</span>}
                  {relationship && <span>{relationship}</span>}
                  {candidate.metro && <span>{candidate.metro}</span>}
                </div>
                <div className={styles.loveProfilePreviewTabs} role="tablist" aria-label={`${first}'s profile views`}>
                  <button type="button" role="tab" aria-selected={previewTab === 'profile'} onClick={() => setPreviewTab('profile')}>profile · free</button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={previewTab === 'compatibility'}
                    onClick={() => {
                      setPreviewTab('compatibility');
                      setCompatibilityError(null);
                      if (readUnlocked) void loadCompatibilityRead(candidate.id);
                      else {
                        trackLoveEvent('compatibility_read_paywall', { candidateId: candidate.id });
                        void fetch('/api/monetization/view', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ product: 'love_connection', surface: 'love_compatibility_read' }),
                        }).catch(() => {});
                      }
                    }}
                  >AI + HEXACO {readUnlocked ? '· open' : '· $0.99'}</button>
                </div>
                {previewTab === 'profile' ? (
                  <>
                    {candidate.why && <p className={styles.loveProfilePreviewWhy}>✦ {(candidate.scoreConfidence ?? 0) < 0.5 ? 'early read: ' : ''}{candidate.why}.</p>}
                    {candidate.bio ? <p className={styles.loveProfilePreviewBio}>{candidate.bio}</p> : <p className={styles.loveProfilePreviewEmpty}>No bio added yet—the profile signals below are everything they have shared.</p>}
                    {Array.isArray(candidate.prompts) && candidate.prompts.length > 0 && (
                      <div className={styles.loveProfilePreviewPrompts}>
                        {candidate.prompts.map((prompt) => (
                          <div key={prompt.question}><span>{prompt.question}</span><strong>{prompt.answer}</strong></div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(candidate.interests) && candidate.interests.length > 0 && (
                      <div className={styles.loveProfilePreviewTags}>
                        {candidate.interests.map((interest) => <span key={interest}>{interest}</span>)}
                      </div>
                    )}
                    <div className={styles.loveProfilePreviewBoundary}>
                      <strong>this profile is free.</strong> opening, accepting, replying, blocking, and reporting are never charged. The optional $0.99 AI Compatibility Read explains the six personality signals between you and includes one extra connection to this person—never a second charge.
                    </div>
                  </>
                ) : !readUnlocked ? (
                  <div className={styles.loveCompatibilityLocked}>
                    <span>private decision support · one-time $0.99</span>
                    <h4>see the six-signal fit—not their private answers.</h4>
                    <p>AI Connect Coach translates both abbreviated HEXACO-style profiles into a personality snapshot, likely strengths, useful watch-outs, and a first-date angle.</p>
                    <ul>
                      <li>all six personality dimensions in plain language</li>
                      <li>where your patterns align or differ</li>
                      <li>one extra Love connection to {first} included</li>
                    </ul>
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() => void openExtraConnectionCheckout(candidate)}
                    >{checkoutBusy ? 'opening secure checkout…' : `unlock read + connection · $0.99 →`}</button>
                    <small>Not a diagnosis or promise of chemistry. Raw answers and exact scores stay private. No subscription.</small>
                  </div>
                ) : compatibilityLoading === candidate.id && !compatibilityRead ? (
                  <div className={styles.loveCompatibilityLoading}>AI Connect Coach is reading the six signals…</div>
                ) : compatibilityError && !compatibilityRead ? (
                  <div className={styles.loveCompatibilityError} role="alert">
                    <p>{compatibilityError}</p>
                    <button type="button" onClick={() => void loadCompatibilityRead(candidate.id)}>try again</button>
                  </div>
                ) : compatibilityRead ? (
                  <div className={styles.loveCompatibilityRead}>
                    <div className={styles.loveCompatibilityHero}>
                      <span>{compatibilityRead.source === 'ai' ? 'AI-personalized read' : 'curated fallback read'}</span>
                      <h4>{compatibilityRead.headline}</h4>
                      <p>{compatibilityRead.overview}</p>
                    </div>
                    <div className={styles.loveCompatibilityTraits}>
                      {compatibilityRead.traits.map((trait) => (
                        <div key={trait.key}>
                          <span>{trait.label}</span>
                          <strong>{first}: {trait.candidateBand}</strong>
                          <p>{trait.pairDynamic}</p>
                        </div>
                      ))}
                    </div>
                    <div className={styles.loveCompatibilityColumns}>
                      <div><span>potential strengths</span>{compatibilityRead.strengths.map((item) => <p key={item}>✦ {item}</p>)}</div>
                      <div><span>worth asking about</span>{compatibilityRead.watchouts.map((item) => <p key={item}>↗ {item}</p>)}</div>
                    </div>
                    <div className={styles.loveCompatibilityDate}><span>first-date angle</span><p>{compatibilityRead.firstDateIdea}</p></div>
                    <small>{compatibilityRead.disclosure}</small>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={styles.loveProfilePreviewChoose}
                  disabled={!!picking || pickedId === candidate.id}
                  onClick={() => {
                    setPreviewCandidate(null);
                    pick(candidate);
                  }}
                >
                  {atCapacity
                    ? 'connection safety limit reached'
                    : pro
                      ? `choose ${first} · included with Pro →`
                      : (hasFlexibleCredit || creditCandidateIds.includes(candidate.id))
                        ? (compatibilityReadIncluded || compatibilityReadCandidateIds.includes(candidate.id)
                          ? `match + chat with ${first} · included with unlock →`
                          : `open AI read for ${first} · use credit →`)
                        : includedRemaining > 0
                          ? `choose ${first} · included →`
                          : `match + chat + AI read · $0.99 →`}
                </button>
              </div>
              </div>
            </section>
          </div>
        );
      })()}

      {paywallCandidate && (
        <div
          onClick={() => setPaywallCandidate(null)}
          className={styles.loveModalOverlay}
        >
          <div onClick={(e) => e.stopPropagation()} className={styles.loveSwapSheet}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.5rem' }}>AI read + extra Love connection · one-time $0.99</div>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.4rem' }}>
              understand the fit—then choose {(paywallCandidate.name || 'them').split(' ')[0]}.
            </h3>
            <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 1.1rem' }}>
              You&apos;ve used the {includedPicks} picks included with this roster. Their full roster profile remains free. This one payment opens the private six-signal AI Compatibility Read and includes the extra connection to this person. If they accept, chat and planning open free. If they decline or the request expires, the connection value returns as an in-app credit and your read stays open.
            </p>
            <div style={{ background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', borderRadius: 12, padding: '0.75rem 0.85rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--h-text-dim)', lineHeight: 1.6 }}>
              one person · one payment · no subscription · no double charge<br />
              no mutual match = one reusable in-app connection credit · ending the request yourself does not recycle it
            </div>
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => void openExtraConnectionCheckout(paywallCandidate)}
              style={{ width: '100%', marginTop: '0.85rem', background: '#0b0b0b', color: '#fff', border: 0, borderRadius: 12, padding: '0.85rem 1rem', cursor: checkoutBusy ? 'wait' : 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {checkoutBusy ? 'opening secure checkout…' : `unlock read + connection · $0.99 →`}
            </button>
            <button
              onClick={() => setPaywallCandidate(null)}
              style={{ marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}
            >
              never mind
            </button>
          </div>
        </div>
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
