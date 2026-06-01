'use client';

import { useState, useEffect, useRef } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import ReportDialog from '@/components/report-dialog';
import DateFeedbackDialog from '@/components/date-feedback-dialog';
import styles from './chat.module.css';

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
}

function timeLeft(iso: string, nowMs: number): string {
  const ms = new Date(iso).getTime() - nowMs;
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// Cheeky rotating placeholders — picked once per mount so they don't flicker.
const PLACEHOLDERS = [
  "say something better than 'hey'…",
  'make it count…',
  "the algo's watching…",
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
    'best thing you ate in Boston this month?',
    'if this goes well, where are we going?',
  ];
  for (const g of generics) {
    if (out.length >= 4) break;
    out.push(g);
  }
  return out.slice(0, 4);
}

export default function ChatRoom({ matchId, currentUserId, otherUser, match, initialMessages }: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [heyWarned, setHeyWarned] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Date vibes for the side rail — fetched once (the endpoint hits external
  // event APIs, so we don't poll it like messages).
  const [vibes, setVibes] = useState<any>(null);
  const [vibePending, setVibePending] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  // Live match status — seeded from the server, refreshed by the poll, so the
  // header stays accurate (countdown ticking, or "ended" if they bailed).
  const [liveMatch, setLiveMatch] = useState<any>(match);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const [starters] = useState(() => buildStarters(otherUser));

  const firstName = (otherUser?.name || 'them').split(' ')[0];
  const score = match?.compatibility_score ?? null;

  // Tick a clock so the countdown re-renders live (every 30s is plenty).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ended = !!liveMatch?.ended_at;
  const expiredByTimer = !!(liveMatch?.chat_expires_at && new Date(liveMatch.chat_expires_at).getTime() < now);
  const chatExpired = ended || expiredByTimer;
  // Pending = matched but not yet mutually accepted. Sending a message here
  // auto-accepts (server-side), which opens the chat — so we prompt for it.
  const pendingAccept = !chatExpired && liveMatch?.status !== 'both_accepted' && !liveMatch?.chat_expires_at;
  const status = chatExpired
    ? 'chat ended'
    : pendingAccept
    ? 'say hi to connect'
    : liveMatch?.chat_expires_at
    ? timeLeft(liveMatch.chat_expires_at, now)
    : 'active';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Load the date vibes (options, my picks, mutual locks) for the side rail.
  async function loadVibes() {
    try {
      const r = await fetch(`/api/match/${matchId}/date-vibes`);
      if (r.ok) setVibes(await r.json());
    } catch {}
  }
  useEffect(() => { loadVibes(); }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap an option to pick it (or tap a picked one to clear it). When both pick
  // the same thing it locks in as a mutual "you both want this".
  async function pickVibe(activityId: string, selected: boolean) {
    setVibePending(activityId);
    try {
      await fetch(`/api/match/${matchId}/date-vibes/swipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, decision: selected ? 'clear' : 'yes' }),
      });
      await loadVibes();
    } finally {
      setVibePending(null);
    }
  }

  // One tappable date-vibe option (used for both date ideas and live events).
  function renderVibeOption(o: any) {
    return (
      <button key={o.id} onClick={() => pickVibe(o.id, o._sel)} disabled={vibePending === o.id}
        style={{ textAlign: 'left', display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer', background: o._sel ? '#0a0a0a' : '#fff', color: o._sel ? '#fff' : '#0a0a0a', border: `1px solid ${o._sel ? '#0a0a0a' : 'rgba(37,99,255,0.3)'}`, borderRadius: 12, padding: '0.6rem 0.75rem', font: 'inherit', opacity: vibePending === o.id ? 0.5 : 1, width: '100%' }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: `1.5px solid ${o._sel ? '#2563ff' : 'rgba(37,99,255,0.5)'}`, background: o._sel ? '#2563ff' : 'transparent', color: '#fff' }}>{o._sel ? '✓' : ''}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.25, display: 'block' }}>{o.title}</span>
          {(o.venue || o.whenLabel) && <span style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.52rem', color: o._sel ? '#c8c4dc' : '#7a7590', letterSpacing: '0.04em' }}>{[o.venue, o.whenLabel].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
    );
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?match_id=${matchId}`);
        if (res.ok) {
          const data = await parseResponse<any>(res);
          setMessages(data.messages || []);
          if (data.match) setLiveMatch((prev: any) => ({ ...prev, ...data.match }));
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  function pickStarter(text: string) {
    setInput(text);
    setNudge(null);
    inputRef.current?.focus();
  }

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

    const optimistic = {
      id: 'temp-' + Date.now(),
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, body: text }),
      });
      if (!res.ok) throw new Error('Send failed');
      const refresh = await fetch(`/api/messages?match_id=${matchId}`);
      const data = await parseResponse<any>(refresh);
      setMessages(data.messages || []);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.chatCol}>
      <header className={styles.header}>
        <a href="/dashboard" className={styles.back}>←</a>
        <div className={styles.headerInfo}>
          <h1 className={styles.headerName}>{otherUser?.name || 'Match'}</h1>
          <div className={styles.headerMeta}>
            {otherUser?.archetype && <span className={styles.headerArch}>{otherUser.archetype}</span>}
            <span className={`${styles.headerStatus} ${chatExpired ? styles.headerStatusExpired : ''}`}>
              {status}
            </span>
          </div>
        </div>
        {otherUser?.photo_url ? (
          <img src={otherUser.photo_url} alt="" className={styles.headerPhoto} />
        ) : (
          <div className={styles.headerPhotoEmpty} />
        )}
        <button
          onClick={() => setReportOpen(true)}
          aria-label="Report or block"
          title="Report or block"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.05rem', padding: '0.25rem 0.4rem', color: '#9a96a8' }}
        >
          ⋯
        </button>
      </header>

      <div className={styles.messages} ref={scrollRef}>
        {/* algo narrator — frames every chat */}
        <div className={styles.narrator}>
          <span className={styles.narratorMark}>✦ NotCupid</span>
          {score != null ? (
            <>you &amp; {firstName} scored <strong>{score}%</strong>. the algo did its part — the rest is on you.</>
          ) : (
            <>you matched with {firstName}. the algo did its part — the rest is on you.</>
          )}
        </div>

        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>your move.</div>
            <div className={styles.emptySub}>blank page energy? steal one of these:</div>
            <div className={styles.starters}>
              {starters.map((sLine) => (
                <button key={sLine} type="button" className={styles.starter} onClick={() => pickStarter(sLine)}>
                  {sLine}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.bubble} ${
                msg.sender_id === currentUserId ? styles.bubbleMine : styles.bubbleTheirs
              }`}
            >
              <div className={styles.bubbleBody}>{msg.body}</div>
              <div className={styles.bubbleTime}>
                {new Date(msg.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {nudge && <div className={styles.nudge}>{nudge}</div>}

      <form onSubmit={handleSend} className={styles.inputForm}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatExpired ? 'chat ended' : pendingAccept ? `say hi — your message connects you with ${firstName}` : placeholder}
          disabled={chatExpired || sending}
          maxLength={2000}
          className={styles.input}
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
      </div>

      <aside className={styles.vibesCol}>
        <div className={styles.vibesInner}>
          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.5rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#2563ff', marginBottom: '0.35rem' }}>✦ date vibes</div>
          <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.3rem', lineHeight: 1.1, color: '#0a0a0a' }}>you &amp; {firstName}</div>
          {vibes?.dateNumber && (
            <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7a7590', marginTop: '0.3rem' }}>
              date {vibes.dateNumber} · {TIER_LABEL[vibes.dateNumber] || ''}
            </div>
          )}

          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.1rem 0 0.6rem' }}>✓ you both want this</div>
          {!vibes ? (
            <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem' }}>loading…</div>
          ) : vibes.mutualMatches?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {vibes.mutualMatches.map((a: any) => (
                <div key={a.id} style={{ background: '#f6f8ff', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 14, padding: '0.75rem 0.85rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.25 }}>{a.title}</div>
                  {a.blurb && <div style={{ fontSize: '0.78rem', color: '#6b6975', lineHeight: 1.4, marginTop: '0.2rem' }}>{a.blurb}</div>}
                  {(a.venue || a.whenLabel) && (
                    <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.06em', color: '#7a7590', marginTop: '0.4rem' }}>
                      {[a.venue, a.whenLabel].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563ff', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }}>details ↗</a>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.45 }}>
              nothing locked in yet — pick the same things below and what you <em>both</em> want locks in here.
            </div>
          )}

          {/* MULTIPLE CHOICE — date ideas by default; live events are opt-in */}
          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.5rem 0 0.6rem' }}>pick what you&apos;d do</div>
          {!vibes ? (
            <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem' }}>loading…</div>
          ) : (() => {
            const all = [
              ...(vibes.myPicks || []).map((a: any) => ({ ...a, _sel: true })),
              ...(vibes.deck || []).map((a: any) => ({ ...a, _sel: false })),
            ];
            const curated = all.filter((o: any) => o.source === 'curated');
            const live = all.filter((o: any) => o.source !== 'curated');
            return (
              <>
                {curated.length === 0 ? (
                  <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.45 }}>no date ideas left right now — check back soon.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {curated.slice(0, 12).map(renderVibeOption)}
                    <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a3b8', textAlign: 'center', marginTop: '0.2rem' }}>tap to pick · locks when you both choose it</div>
                  </div>
                )}
                <button onClick={() => setShowLive((v) => !v)} style={{ width: '100%', marginTop: '0.8rem', background: '#fff', border: '1px solid rgba(37,99,255,0.35)', color: '#1b46c9', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.6rem', borderRadius: 12, cursor: 'pointer' }}>
                  🎟️ {showLive ? 'hide live events' : `check out live events${live.length ? ` (${live.length})` : ''}`}
                </button>
                {showLive && (
                  live.length === 0 ? (
                    <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem', lineHeight: 1.45, marginTop: '0.6rem' }}>nothing live right now — concerts &amp; events drop in when there&apos;s something on.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
                      {live.slice(0, 12).map(renderVibeOption)}
                    </div>
                  )
                )}
              </>
            );
          })()}
          <a href={`/match/${matchId}/date-vibes`} style={{ display: 'block', textAlign: 'center', marginTop: '0.7rem', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1b46c9', textDecoration: 'none' }}>open the full deck ↗</a>

          <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563ff', margin: '1.5rem 0 0.6rem' }}>{firstName}&apos;s vibe</div>
          {vibes?.partnerInterests?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {vibes.partnerInterests.map((i: string) => (
                <span key={i} style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.62rem', background: '#e8edff', color: '#1b46c9', borderRadius: 999, padding: '0.25rem 0.6rem' }}>{INTEREST_LABELS[i] || i}</span>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9a96a8', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem' }}>they haven&apos;t picked their interests yet.</div>
          )}

          <button onClick={() => setFeedbackOpen(true)} style={{ width: '100%', marginTop: '1.75rem', background: '#fff', border: '1px solid rgba(37,99,255,0.35)', color: '#0a0a0a', fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.7rem', borderRadius: 12, cursor: 'pointer' }}>
            🍷 we went on a date
          </button>
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
