'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchWithTimeout, parseResponse } from '@/lib/fetch-helpers';
import { trackLoveEvent } from '@/lib/love-events-client';
import { toast } from '@/components/feedback';
import ReportDialog from '@/components/report-dialog';
import EndMatchDialog from '@/components/end-match-dialog';
import DateFeedbackDialog from '@/components/date-feedback-dialog';
import styles from './chat.module.css';
import { normalizeProfilePrompts } from '@/lib/profile-prompts';
import { ATTACH_LABEL, VIBE_HEADS, vibeLabel, type AttachStyle, type VibeKey } from '@/lib/quiz-data';
import CompatibilityReadPanel from './compatibility-read-panel';

// Emoji labels for a partner's picked interests (mirrors INTEREST_OPTIONS).
const INTEREST_LABELS: Record<string, string> = {
  food: '🍜 food', music: '🎵 music', sports: '🏟 sports', comedy: '🎤 comedy',
  art: '🎨 art', theater: '🎭 theater', outdoor: '🌳 outdoor', nightlife: '🍸 nightlife',
  coffee: '☕ coffee', films: '🎬 films', books: '📚 books', gaming: '🎮 gaming',
};
const TIER_LABEL: Record<number, string> = { 1: 'the warm-up', 2: 'getting real', 3: 'all in' };

interface Props {
  matchId: string;
  currentUserId: string;
  otherUser: any;
  match: any;
  initialMessages: any[];
  hasOlderMessages?: boolean;
  readOnly?: boolean;
  profileUnlocked: boolean;
  compatibilityReadAvailable?: boolean;
}

type LoveCoach = {
  stage: 'opener' | 'wait' | 'reply' | 'deepen' | 'plan';
  headline: string;
  why: string;
  openers: string[];
  nextMove: string;
  source: 'ai' | 'curated';
  disclosure: string;
};

function timeLeft(iso: string, nowMs: number): string {
  const ms = new Date(iso).getTime() - nowMs;
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function messageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    // Vercel renders in UTC while participants render in their device zone.
    // Pinning the event chat to Boston keeps the initial HTML identical and
    // avoids a full-screen hydration recovery before the composer appears.
    timeZone: 'America/New_York',
  });
}

// Cheeky rotating placeholders — chosen deterministically per match so the
// server and browser render the same text during hydration.
// (Keep these warm, never surveillance-y — "the algo's watching" read as creepy.)
const PLACEHOLDERS = [
  "say something better than 'hey'…",
  'make it count…',
  'ask the thing you actually want to know…',
  'open strong.',
  'no pressure. (ok, a little pressure.)',
];

// Lone low-effort greetings we gently roast on the FIRST message.
const LOW_EFFORT = /^(he+y+|hi+|yo+|sup|hello+|wyd|hey there)\s*[.!?]*$/i;

// Build sendable conversation starters from the match's actual profile.
function buildStarters(other: any): string[] {
  const name = (other?.name || 'them').split(' ')[0];
  const out: string[] = [];
  const music = other?.music?.[0];
  const food = other?.food?.[0];
  const hobby = other?.hobbies?.[0];
  if (music) out.push(`ok ${name}, sell me on ${music} in one sentence.`);
  if (food) out.push(`settle it — is ${food} elite or overrated?`);
  if (hobby) out.push(`${hobby}: casual hobby or whole personality?`);
  if (other?.archetype) out.push(`the algo says you're "${other.archetype}". accurate or rude?`);
  const generics = [
    'two truths and a lie. you first.',
    "what's a hill you'd die on at brunch?",
    'best thing you ate out this month?',
    'if this goes well, where are we going?',
  ];
  for (const g of generics) {
    if (out.length >= 4) break;
    out.push(g);
  }
  return out.slice(0, 4);
}

export default function ChatRoom({
  matchId,
  currentUserId,
  otherUser,
  match,
  initialMessages,
  hasOlderMessages = false,
  readOnly = false,
  profileUnlocked,
  compatibilityReadAvailable = false,
}: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(hasOlderMessages);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Newest message timestamp we hold — lets the poll ask for only newer rows.
  const lastMsgAtRef = useRef<string>(
    initialMessages.length ? initialMessages[initialMessages.length - 1].created_at : ''
  );
  useEffect(() => {
    lastMsgAtRef.current = messages.length ? messages[messages.length - 1].created_at : '';
  }, [messages]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [heyWarned, setHeyWarned] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'plan' | 'profile'>('chat');
  const [coach, setCoach] = useState<LoveCoach | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const autoCoachRequested = useRef(false);
  // A new message changes the coach stage. Never leave stale guidance on the
  // screen after either person advances the conversation.
  useEffect(() => setCoach(null), [messages.length]);
  // Date vibes for the side rail — fetched once (the endpoint hits external
  // event APIs, so we don't poll it like messages).
  const [vibes, setVibes] = useState<any>(null);
  const [vibePending, setVibePending] = useState<string | null>(null);
  // Live match status — seeded from the server, refreshed by the poll, so the
  // header stays accurate (countdown ticking, or "ended" if they bailed).
  const [liveMatch, setLiveMatch] = useState<any>(match);
  // Keep the server render and the browser's first render identical. Calling
  // Date.now() in the state initializer made the countdown differ by a few
  // milliseconds during hydration, which caused React to discard and rebuild
  // the entire chat screen on mobile. Start without a clock value, then enable
  // the live countdown immediately after hydration.
  const [now, setNow] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // "typing…" — the poll carries the other side's last typing ping; we show the
  // bubble while it's fresh (<6s). Our own pings are throttled to 1 per 2.5s.
  const [otherTypingAt, setOtherTypingAt] = useState<string | null>(null);
  // read receipt — the other side's last "chat open" stamp from the poll.
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const lastTypingPingRef = useRef(0);
  function pingTyping() {
    if (readOnly) return;
    const t = Date.now();
    if (t - lastTypingPingRef.current < 2500) return;
    lastTypingPingRef.current = t;
    fetch(`/api/matches/${matchId}/typing`, { method: 'POST' }).catch(() => {});
  }

  const placeholder = PLACEHOLDERS[
    Array.from(matchId).reduce((sum, char) => sum + char.charCodeAt(0), 0) % PLACEHOLDERS.length
  ];
  const [starters] = useState(() => buildStarters(otherUser));

  const firstName = (otherUser?.name || 'them').split(' ')[0];
  const score = match?.compatibility_score ?? null;
  const profileTags = [
    ...(Array.isArray(otherUser?.music) ? otherUser.music : []),
    ...(Array.isArray(otherUser?.food) ? otherUser.food : []),
    ...(Array.isArray(otherUser?.hobbies) ? otherUser.hobbies : []),
  ].filter(Boolean).slice(0, 8);
  const profilePrompts = normalizeProfilePrompts(otherUser?.prompts);
  const profileVibes = otherUser?.vibes && typeof otherUser.vibes === 'object'
    ? (Object.keys(VIBE_HEADS) as VibeKey[]).map((key) => ({
        key,
        head: VIBE_HEADS[key],
        label: vibeLabel(key, otherUser.vibes[key]),
      })).filter((item) => item.label)
    : [];
  const profileValues = otherUser?.values_profile && typeof otherUser.values_profile === 'object'
    ? Object.entries(otherUser.values_profile as Record<string, unknown>)
        .filter(([key, value]) => key !== 'partner' && (typeof value === 'number' || typeof value === 'string'))
        .slice(0, 7)
    : [];
  const connectionStyle = otherUser?.attach_style && otherUser.attach_style in ATTACH_LABEL
    ? ATTACH_LABEL[otherUser.attach_style as AttachStyle]
    : null;

  // Tick a clock so the countdown re-renders live (every 30s is plenty).
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ended = !!liveMatch?.ended_at;
  const expiredByTimer = now !== null
    && !!liveMatch?.chat_expires_at
    && new Date(liveMatch.chat_expires_at).getTime() < now;
  const chatExpired = ended || expiredByTimer;
  // Pending = matched but not yet mutually accepted. Sending a message here
  // auto-accepts (server-side), which opens the chat — so we prompt for it.
  const pendingAccept = !chatExpired && liveMatch?.status !== 'both_accepted' && !liveMatch?.chat_expires_at;
  const isUser1 = liveMatch?.user_1_id === currentUserId;
  const myAccepted = isUser1 ? !!liveMatch?.user_1_accepted : !!liveMatch?.user_2_accepted;
  const otherAccepted = isUser1 ? !!liveMatch?.user_2_accepted : !!liveMatch?.user_1_accepted;
  const needsDecision = pendingAccept && !myAccepted && otherAccepted;
  const status = chatExpired
    ? 'chat ended'
    : needsDecision
    ? 'your move · yes or pass'
    : pendingAccept && myAccepted
    ? 'waiting on their answer'
    : pendingAccept
    ? 'choose to connect'
    : liveMatch?.chat_expires_at && now !== null
    ? timeLeft(liveMatch.chat_expires_at, now)
    : 'active';

  async function answerIncomingChoice(answer: 'yes' | 'pass') {
    if (decisionBusy) return;
    setDecisionBusy(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/${answer === 'yes' ? 'accept' : 'pass'}`, { method: 'POST' });
      const result = await parseResponse<any>(response);
      if (!response.ok) throw new Error(result.error || 'Could not save your choice');
      window.location.href = answer === 'yes' ? `/match/${matchId}?prompt_push=1` : '/dashboard#connections';
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save your choice', 'error');
      setDecisionBusy(false);
    }
  }

  // Smart scroll: autoscroll on new messages only when the user is already near
  // the bottom (or it's their own send) — never yank someone who's reading up.
  const nearBottomRef = useRef(true);
  function trackScroll() {
    const el = scrollRef.current;
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  async function loadOlderMessages() {
    const oldest = messages[0]?.created_at;
    const el = scrollRef.current;
    if (!oldest || !el || loadingOlder) return;
    setLoadingOlder(true);
    const previousHeight = el.scrollHeight;
    try {
      const response = await fetchWithTimeout(
        `/api/messages?match_id=${matchId}&before=${encodeURIComponent(oldest)}`,
        {},
        10_000,
      );
      const data = await parseResponse<any>(response);
      if (!response.ok) throw new Error(data.error || 'Could not load older messages');
      const older: any[] = data.messages || [];
      setHasOlder(!!data.hasMore);
      if (older.length) {
        setMessages((current) => {
          const seen = new Set(current.map((message: any) => message.id));
          return [...older.filter((message: any) => !seen.has(message.id)), ...current];
        });
        requestAnimationFrame(() => {
          const current = scrollRef.current;
          if (current) current.scrollTop += current.scrollHeight - previousHeight;
        });
      }
    } catch {
      toast('older messages could not load — try again', 'error');
    } finally {
      setLoadingOlder(false);
    }
  }
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const mine = last?.sender_id === currentUserId;
    if (mine || nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, currentUserId]);

  // Load the date vibes (options, my picks, mutual locks) for the side rail.
  // A failure shows a retry instead of spinning "loading…" forever.
  const [vibesError, setVibesError] = useState(false);
  async function loadVibes() {
    setVibesError(false);
    try {
      const r = await fetch(`/api/match/${matchId}/date-vibes`);
      if (r.ok) setVibes(await r.json());
      else setVibesError(true);
    } catch { setVibesError(true); }
  }
  useEffect(() => {
    if (pendingAccept) {
      setVibes(null);
      setVibesError(false);
      return;
    }
    loadVibes();
  }, [matchId, pendingAccept]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap an option to pick it (or tap a picked one to clear it). When both pick
  // the same thing it locks in as a mutual "you both want this".
  async function pickVibe(activityId: string, selected: boolean) {
    setVibePending(activityId);
    try {
      const response = await fetch(`/api/match/${matchId}/date-vibes/swipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, decision: selected ? 'clear' : 'yes' }),
      });
      if (!response.ok) throw new Error('date-vibe-save-failed');
      await loadVibes();
    } catch {
      setVibesError(true);
      toast('could not save that date idea — try again', 'error');
    } finally {
      setVibePending(null);
    }
  }

  // One tappable date-vibe option (used for both date ideas and live events).
  function renderVibeOption(o: any) {
    return (
      <button key={o.id} onClick={() => pickVibe(o.id, o._sel)} disabled={vibePending === o.id}
        style={{ textAlign: 'left', display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer', background: o._sel ? '#0a0a0a' : 'var(--h-surface)', color: o._sel ? '#fff' : 'var(--h-text)', border: `1px solid ${o._sel ? '#0a0a0a' : 'rgba(37,99,255,0.3)'}`, borderRadius: 12, padding: '0.6rem 0.75rem', font: 'inherit', opacity: vibePending === o.id ? 0.5 : 1, width: '100%' }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: `1.5px solid ${o._sel ? '#2563ff' : 'rgba(37,99,255,0.5)'}`, background: o._sel ? '#2563ff' : 'transparent', color: '#fff' }}>{o._sel ? '✓' : ''}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.25, display: 'block' }}>{o.title}</span>
          {(o.venue || o.whenLabel) && <span style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.52rem', color: o._sel ? '#c8c4dc' : 'var(--h-text-dim)', letterSpacing: '0.04em' }}>{[o.venue, o.whenLabel].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
    );
  }

  useEffect(() => {
    if (readOnly) return; // ended conversations don't change — no need to poll
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        // Incremental poll: only fetch messages newer than the last one we
        // have (the server re-ships the whole thread without `after`).
        const after = lastMsgAtRef.current;
        const res = await fetchWithTimeout(`/api/messages?match_id=${matchId}${after ? `&after=${encodeURIComponent(after)}` : ''}`, {}, 8_000);
        if (res.ok) {
          const data = await parseResponse<any>(res);
          const fresh: any[] = data.messages || [];
          if (data.incremental) {
            if (fresh.length) {
              setMessages((prev) => {
                const seen = new Set(prev.map((m: any) => m.id));
                const add = fresh.filter((m: any) => !seen.has(m.id));
                return add.length ? [...prev, ...add] : prev;
              });
            }
          } else {
            setMessages(fresh);
          }
          if (data.match) setLiveMatch((prev: any) => ({ ...prev, ...data.match }));
          if ('otherTypingAt' in data) setOtherTypingAt(data.otherTypingAt || null);
          if ('otherReadAt' in data) setOtherReadAt(data.otherReadAt || null);
        }
      } catch {}
      if (!stopped) timer = window.setTimeout(poll, document.visibilityState === 'visible' ? 3_000 : 12_000);
    };
    timer = window.setTimeout(poll, 3_000);
    const wake = () => {
      if (document.visibilityState !== 'visible' || stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(poll, 250);
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [matchId, readOnly]);

  // Re-render every 2s while a typing ping is live so the bubble expires cleanly.
  const [, typingTick] = useState(0);
  useEffect(() => {
    if (!otherTypingAt) return;
    const id = setInterval(() => typingTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [otherTypingAt]);
  const otherTyping = !!otherTypingAt && Date.now() - new Date(otherTypingAt).getTime() < 6000 && !readOnly;

  function pickStarter(text: string) {
    setInput(text);
    setNudge(null);
    inputRef.current?.focus();
  }

  async function loadCoach() {
    if (coachBusy) return;
    setCoachBusy(true);
    trackLoveEvent('coach_requested', { matchId });
    try {
      const response = await fetch(`/api/matches/${matchId}/coach`, { method: 'POST' });
      const data = await parseResponse<{ coach?: LoveCoach; error?: string }>(response);
      if (response.ok && data.coach) setCoach(data.coach);
      else toast(data.error || 'match coach is taking a breather — try again', 'error');
    } catch {
      toast('match coach is taking a breather — try again', 'error');
    } finally {
      setCoachBusy(false);
    }
  }

  useEffect(() => {
    if (readOnly || pendingAccept || messages.length > 0 || coach || coachBusy || autoCoachRequested.current) return;
    autoCoachRequested.current = true;
    trackLoveEvent('mutual_chat_open', { matchId });
    void loadCoach();
  }, [readOnly, pendingAccept, messages.length, coach, coachBusy, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // Gentle roast: block a lone "hey" as the opener — once. If they send
    // again (same or edited), it goes through.
    if (messages.length === 0 && !heyWarned && LOW_EFFORT.test(text)) {
      setHeyWarned(true);
      setNudge(
        score != null
          ? `"${text}"? you matched at ${score}%. that deserves better than "${text}". (send again to send it anyway)`
          : `"${text}"? c'mon — you can do better. (send again to send it anyway)`
      );
      return;
    }

    setNudge(null);
    setSending(true);

    const clientId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: `temp-${clientId}`,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    try {
      const res = await fetchWithTimeout('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, body: text, client_id: clientId }),
      }, 12_000);
      if (!res.ok) throw new Error('Send failed');
      const data = await parseResponse<any>(res);
      // Swap the optimistic bubble for the real row in place — no full refetch,
      // no flicker. RACE GUARD: if the 3s poll already delivered this message
      // (slow POST, fast poll), drop the optimistic bubble instead of swapping,
      // or the message would render twice.
      setMessages((prev) => {
        const real = data.message;
        if (!real) return prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false } : m));
        const alreadyPolled = prev.some((m) => m.id === real.id);
        return alreadyPolled
          ? prev.filter((m) => m.id !== optimistic.id)
          : prev.map((m) => (m.id === optimistic.id ? real : m));
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      toast('message didn’t send — it’s back in the box, try again', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.page} data-mobile-panel={mobilePanel}>
      <div className={styles.chatCol}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.back}>←</a>
        <div className={styles.headerInfo}>
          <h1 className={styles.headerName}>{otherUser?.name || 'Match'}</h1>
          <div className={styles.headerMeta}>
            {otherUser?.archetype && <span className={styles.headerArch}>{otherUser.archetype}</span>}
            {otherUser?.occupation && <span className={styles.headerArch}>💼 {otherUser.occupation}</span>}
            <span className={`${styles.headerStatus} ${chatExpired ? styles.headerStatusExpired : ''}`}>
              {status}
            </span>
          </div>
        </div>
        {otherUser?.photo_url ? (
          <img src={otherUser.photo_url} alt="" className={styles.headerPhoto} decoding="async" />
        ) : (
          <div className={styles.headerPhotoEmpty} />
        )}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Match options"
            title="Match options"
            style={{ background: menuOpen ? 'rgba(11,11,11,0.06)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, padding: '0.3rem 0.5rem', borderRadius: 8, color: 'var(--h-text-dim)' }}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41, background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(11,11,11,0.14)', overflow: 'hidden', minWidth: 184 }}>
                <button onClick={() => { setMenuOpen(false); setEndOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.8rem 1rem', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--h-text)' }}>
                  <span style={{ fontSize: '0.95rem' }}>💔</span> End match
                </button>
                <button onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.8rem 1rem', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.7rem', letterSpacing: '0.05em', color: '#c0392b', borderTop: '1px solid rgba(11,11,11,0.07)' }}>
                  <span style={{ fontSize: '0.95rem' }}>🛡️</span> Report or block
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className={styles.mobileMatchTabs} role="tablist" aria-label={`${firstName} connection views`}>
        {(['chat', 'plan', 'profile'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            role="tab"
            aria-selected={mobilePanel === panel}
            onClick={() => setMobilePanel(panel)}
          >
            {panel}
          </button>
        ))}
        {!readOnly && (
          <button type="button" className={styles.mobileEndButton} onClick={() => setEndOpen(true)}>
            end
          </button>
        )}
      </div>

      <div className={styles.messages} ref={scrollRef} onScroll={trackScroll}>
        {hasOlder && (
          <button type="button" className={styles.loadOlder} onClick={loadOlderMessages} disabled={loadingOlder}>
            {loadingOlder ? 'loading…' : 'load earlier messages'}
          </button>
        )}
        {/* algo narrator — frames every chat */}
        <div className={styles.narrator}>
          <span className={styles.narratorMark}>✦ NotCupid</span>
          {score != null ? (
            <>you &amp; {firstName} scored <strong>{score}%</strong>. start small, stay curious, and see what feels easy.</>
          ) : (
            <>you matched with {firstName}. start small, stay curious, and see what feels easy.</>
          )}
        </div>

        {needsDecision && (
          <div className={styles.decisionCard} role="region" aria-label={`Choose whether to connect with ${firstName}`}>
            <span>they chose you</span>
            <strong>Do you want to connect with {firstName}?</strong>
            <p>Review the profile, then choose Yes or Pass. Either answer is okay.</p>
          </div>
        )}

        {!readOnly && messages.length > 0 && !coach && (
          <button type="button" className={styles.coachTrigger} onClick={loadCoach} disabled={coachBusy}>
            {coachBusy ? 'thinking…' : '✦ make the next move easier'}
          </button>
        )}

        {!readOnly && coach && messages.length > 0 && (
          <div className={styles.coachCard}>
            <div className={styles.coachKicker}>{coach.source === 'ai' ? '✦ AI match coach' : '✦ match coach'}</div>
            <strong>{coach.headline}</strong>
            <p>{coach.nextMove}</p>
            {coach.openers.length > 0 && (
              <div className={styles.coachOpeners}>
                {coach.openers.map((opener) => (
                  <button key={opener} type="button" onClick={() => pickStarter(opener)}>{opener}</button>
                ))}
              </div>
            )}
            <small>{coach.disclosure}</small>
          </div>
        )}

        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{readOnly ? 'this one is closed.' : needsDecision ? `${firstName} chose you.` : 'your move.'}</div>
            <div className={styles.emptySub}>{readOnly ? 'no messages were sent before it ended.' : needsDecision ? 'review their profile · choose below' : 'blank page energy? steal one of these:'}</div>
            {!readOnly && !needsDecision && !coach && (
              <button type="button" className={styles.coachTrigger} onClick={loadCoach} disabled={coachBusy}>
                {coachBusy ? 'curating your angle…' : '✦ ask the AI match coach'}
              </button>
            )}
            {!readOnly && !needsDecision && (
              coach ? (
                <div className={styles.coachCard}>
                  <div className={styles.coachKicker}>{coach.source === 'ai' ? '✦ AI match coach' : '✦ match coach'}</div>
                  <strong>{coach.headline}</strong>
                  <p>{coach.why}.</p>
                  <div className={styles.coachOpeners}>
                    {coach.openers.map((opener) => (
                      <button key={opener} type="button" onClick={() => pickStarter(opener)}>{opener}</button>
                    ))}
                  </div>
                  <small>{coach.disclosure}</small>
                </div>
              ) : (
                <div className={styles.starters}>
                  {starters.map((sLine) => (
                    <button key={sLine} type="button" className={styles.starter} onClick={() => pickStarter(sLine)}>
                      {sLine}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          (() => {
            const lastMine = [...messages].reverse().find((m) => m.sender_id === currentUserId && !m.pending);
            const seen = lastMine && otherReadAt && new Date(otherReadAt) >= new Date(lastMine.created_at);
            return messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.bubble} ${
                msg.sender_id === currentUserId ? styles.bubbleMine : styles.bubbleTheirs
              }`}
              style={msg.pending ? { opacity: 0.55 } : undefined}
            >
              <div className={styles.bubbleBody}>{msg.body}</div>
              <div className={styles.bubbleTime}>
                {msg.pending
                  ? 'sending…'
                  : messageTime(msg.created_at)}
                {seen && msg.id === lastMine.id ? ' · seen ✓' : ''}
              </div>
            </div>
            ));
          })()
        )}
        {otherTyping && (
          <div className={`${styles.bubble} ${styles.bubbleTheirs}`} aria-label={`${firstName} is typing`}>
            <div className={styles.bubbleBody} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '0.15rem 0.1rem' }}>
              <style>{`@keyframes ncTypDot { 0%, 60%, 100% { opacity: .25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }`}</style>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: `ncTypDot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {nudge && <div className={styles.nudge}>{nudge}</div>}

      {readOnly ? (
        <div style={{ padding: '0.9rem 1rem', textAlign: 'center', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.85rem', borderTop: '1px solid var(--h-border)' }}>
          this conversation has ended — you can still read it, but messages are closed.
        </div>
      ) : needsDecision ? (
        <div className={styles.decisionBar}>
          <button type="button" disabled={decisionBusy} onClick={() => answerIncomingChoice('yes')}>
            {decisionBusy ? 'saving…' : `yes, connect with ${firstName}`}
          </button>
          <button type="button" disabled={decisionBusy} onClick={() => answerIncomingChoice('pass')}>
            pass
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (e.target.value) pingTyping(); }}
            placeholder={chatExpired ? 'chat ended' : pendingAccept ? `say hi — your message connects you with ${firstName}` : placeholder}
            disabled={chatExpired}
            /* NOT disabled while sending — disabling an input mid-send dismisses
               the iOS keyboard, so every message cost a re-tap to keep typing.
               handleSend already guards double-submits. */
            enterKeyHint="send"
            autoComplete="off"
            maxLength={2000}
            className={styles.input}
            aria-label={`Message ${firstName}`}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending || chatExpired}
            className={styles.send}
            aria-label="send"
          >
            →
          </button>
        </form>
      )}
      </div>

      <aside className={styles.vibesCol}>
        <section className={styles.matchProfile}>
          <div className={styles.matchPhotoWrap}>
            {otherUser?.photo_url ? (
              <img src={otherUser.photo_url} alt="" className={styles.matchPhoto} loading="lazy" decoding="async" />
            ) : (
              <div className={styles.matchPhotoEmpty}>{firstName.charAt(0) || '?'}</div>
            )}
            {score != null && <span className={styles.matchScore}>{score}% match</span>}
          </div>
          {otherUser?.intro_video_preview_url && (
            <div className={styles.matchVideoWrap}>
              <div className={styles.matchVideoLabel}>🎬 {firstName} in 30 seconds</div>
              {/* User-uploaded profile clips do not have a separate caption track. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                className={styles.matchVideo}
                src={otherUser.intro_video_preview_url}
                controls
                playsInline
                preload="metadata"
                aria-label={`${firstName} intro video`}
              />
            </div>
          )}
          <div className={styles.matchProfileBody}>
            <div className={styles.matchKicker}>your connection</div>
            <h2>{otherUser?.name || 'Match'}{otherUser?.age ? <span>, {otherUser.age}</span> : null}</h2>
            <div className={styles.matchFacts}>
              {otherUser?.archetype && <span>{otherUser.archetype}</span>}
              {otherUser?.occupation && <span>{otherUser.occupation}</span>}
              {otherUser?.relationship_style && <span>{otherUser.relationship_style}</span>}
              {otherUser?.sun_sign && <span>{otherUser.sun_sign}</span>}
            </div>
            {otherUser?.bio && <p>{otherUser.bio}</p>}
            {profilePrompts.length > 0 && (
              <div className={styles.matchPrompts}>
                {profilePrompts.map((prompt) => (
                  <div key={prompt.question}>
                    <span>{prompt.question}</span>
                    <strong>{prompt.answer}</strong>
                  </div>
                ))}
              </div>
            )}
            {profileTags.length > 0 && (
              <div className={styles.matchTags}>
                {profileTags.map((tag: string) => <span key={tag}>{tag}</span>)}
              </div>
            )}
            {profileUnlocked ? (
              <>
                {Array.isArray(otherUser?.gallery) && otherUser.gallery.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                    {otherUser.gallery.slice(0, 3).map((url: string) => (
                      <img key={url} src={url} alt="" loading="lazy" decoding="async" style={{ width: 70, height: 82, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                    ))}
                  </div>
                )}
                {(profileVibes.length > 0 || profileValues.length > 0 || connectionStyle) && (
                  <div style={{ display: 'grid', gap: '0.55rem', padding: '0.75rem', border: '1px solid rgba(37,99,255,0.2)', borderRadius: 12, background: 'rgba(37,99,255,0.05)' }}>
                    <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2563ff' }}>compatibility profile</div>
                    {connectionStyle && <strong style={{ fontSize: '0.82rem' }}>connection style · {connectionStyle}</strong>}
                    {profileVibes.length > 0 && (
                      <div className={styles.matchTags}>
                        {profileVibes.map((item) => <span key={item.key}>{item.head} · {item.label}</span>)}
                      </div>
                    )}
                    {profileValues.length > 0 && (
                      <div className={styles.matchTags}>
                        {profileValues.map(([key, value]) => <span key={key}>{key.replaceAll('_', ' ')} · {String(value)}</span>)}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.48rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d7a4f' }}>
                  ✓ full compatibility profile included
                </div>
              </>
            ) : null}
            {compatibilityReadAvailable && otherUser?.id && (
              <CompatibilityReadPanel candidateId={otherUser.id} firstName={firstName} />
            )}
          </div>
        </section>
        <div className={styles.vibesInner} id="date-plans">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.5rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.35rem' }}>one easy plan</div>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.45rem', lineHeight: 1.08, color: 'var(--h-text)' }}>make meeting feel simple.</div>
            </div>
            {!pendingAccept && (
              <button onClick={() => setFeedbackOpen(true)} className={styles.dateDoneButton}>
                we went on a date
              </button>
            )}
          </div>
          {vibes?.dateNumber && (
            <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.3rem' }}>
              you &amp; {firstName} · date {vibes.dateNumber} · {TIER_LABEL[vibes.dateNumber] || ''}
            </div>
          )}

          {pendingAccept ? (
            <div className={styles.pendingPlanLock}>
              <span>plan together after the mutual yes</span>
              <strong>waiting for {firstName} to connect.</strong>
              <p>Once they say yes, both of you can privately pick date ideas and anything you choose in common will lock in here.</p>
            </div>
          ) : (
          <>
          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.1rem 0 0.6rem' }}>✓ you both want this</div>
          {vibesError ? (
            <div style={{ color: 'var(--h-text-dim)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem' }}>
              date vibes couldn’t load — <button onClick={loadVibes} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontStyle: 'italic', color: '#2563ff', textDecoration: 'underline', cursor: 'pointer' }}>try again</button>
            </div>
          ) : !vibes ? (
            <div style={{ color: 'var(--h-text-faint)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem' }}>loading…</div>
          ) : vibes.mutualMatches?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {vibes.mutualMatches.map((a: any) => (
                <div key={a.id} style={{ background: 'var(--h-surface-2)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 14, padding: '0.75rem 0.85rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.25 }}>{a.title}</div>
                  {a.blurb && <div style={{ fontSize: '0.78rem', color: 'var(--h-text-dim)', lineHeight: 1.4, marginTop: '0.2rem' }}>{a.blurb}</div>}
                  {(a.venue || a.whenLabel) && (
                    <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)', marginTop: '0.4rem' }}>
                      {[a.venue, a.whenLabel].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563ff', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }}>details ↗</a>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--h-text-faint)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.45 }}>
              nothing locked in yet — pick the same things below and what you <em>both</em> want locks in here.
            </div>
          )}

          {/* MULTIPLE CHOICE — curated date ideas stay primary while live-event
              APIs are held back from the main chat surface. */}
          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.5rem 0 0.6rem' }}>pick one you&apos;d actually do</div>
          {!vibes ? (
            null
          ) : (() => {
            const all = [
              ...(vibes.myPicks || []).map((a: any) => ({ ...a, _sel: true })),
              ...(vibes.deck || []).map((a: any) => ({ ...a, _sel: false })),
            ];
            const curated = all.filter((o: any) => o.source === 'curated');
            return (
              <>
                {curated.length === 0 ? (
                  <div style={{ color: 'var(--h-text-faint)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.45 }}>no date ideas left right now — check back soon.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {curated.slice(0, 3).map((option: any, index: number) => (
                      <div key={option.id}>
                        {index === 0 && <div className={styles.planStartLabel}>best place to start</div>}
                        {renderVibeOption(option)}
                      </div>
                    ))}
                    <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)', textAlign: 'center', marginTop: '0.2rem' }}>tap to pick · locks when you both choose it</div>
                  </div>
                )}
                <div className={styles.liveHoldNote}>
                  live events are being tuned. for now, use these curated prompts to find the first plan you both actually want.
                </div>
              </>
            );
          })()}
          <a href={`/match/${matchId}/date-vibes`} style={{ display: 'block', textAlign: 'center', marginTop: '0.7rem', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1b46c9', textDecoration: 'none' }}>see more date ideas ↗</a>

          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.5rem 0 0.6rem' }}>{firstName}&apos;s vibe</div>
          {vibes?.partnerInterests?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {vibes.partnerInterests.map((i: string) => (
                <span key={i} style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.62rem', background: 'var(--h-surface-2)', color: 'var(--h-accent)', borderRadius: 999, padding: '0.25rem 0.6rem' }}>{INTEREST_LABELS[i] || i}</span>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--h-text-faint)', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem' }}>they haven&apos;t picked their interests yet.</div>
          )}
          </>
          )}
        </div>
      </aside>

      {reportOpen && (
        <ReportDialog
          reportedId={(otherUser as any)?.id}
          matchId={matchId}
          otherName={otherUser?.name || 'them'}
          onClose={() => setReportOpen(false)}
          onDone={() => { window.location.href = '/dashboard'; }}
        />
      )}
      {endOpen && (
        <EndMatchDialog
          matchId={matchId}
          otherName={otherUser?.name || 'them'}
          mutual={!!(liveMatch?.user_1_accepted && liveMatch?.user_2_accepted)}
          onClose={() => setEndOpen(false)}
          onEnded={() => { window.location.href = '/dashboard'; }}
        />
      )}
      {feedbackOpen && (
        <DateFeedbackDialog
          matchId={matchId}
          otherName={firstName}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  );
}
