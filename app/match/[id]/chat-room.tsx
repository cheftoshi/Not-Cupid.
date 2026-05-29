'use client';

import { useState, useEffect, useRef } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import styles from './chat.module.css';

interface Props {
  matchId: string;
  currentUserId: string;
  otherUser: any;
  match: any;
  initialMessages: any[];
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const [starters] = useState(() => buildStarters(otherUser));

  const firstName = (otherUser?.name || 'them').split(' ')[0];
  const score = match?.compatibility_score ?? null;

  const chatExpired = !!(match.chat_expires_at && new Date(match.chat_expires_at) < new Date());
  const status = chatExpired
    ? 'chat ended'
    : match.chat_expires_at
    ? timeLeft(match.chat_expires_at)
    : 'active';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?match_id=${matchId}`);
        if (res.ok) {
          const data = await parseResponse<any>(res);
          setMessages(data.messages || []);
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
          placeholder={chatExpired ? 'chat ended' : placeholder}
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
  );
}
