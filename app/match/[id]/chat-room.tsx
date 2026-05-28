'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './chat.module.css';
import EndMatchDialog from './end-match-dialog';

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

export default function ChatRoom({ matchId, currentUserId, otherUser, match, initialMessages }: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatExpired = !!(match.chat_expires_at && new Date(match.chat_expires_at) < new Date());
  const matchEnded = match.status === 'ended' || !!match.ended_at;
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
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
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
      const data = await refresh.json();
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
          <div className={`${styles.headerStatus} ${chatExpired ? styles.headerStatusExpired : ''}`}>
            {status}
          </div>
        </div>
        {otherUser?.photo_url ? (
          <img src={otherUser.photo_url} alt="" className={styles.headerPhoto} />
        ) : (
          <div className={styles.headerPhotoEmpty} />
        )}
        {!matchEnded && (
          <button onClick={() => setEndOpen(true)} className={styles.endBtn} aria-label="end match">end</button>
        )}
      </header>

      {endOpen && (
        <EndMatchDialog
          matchId={matchId}
          otherName={otherUser?.name || 'them'}
          onClose={() => setEndOpen(false)}
        />
      )}

      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>say hi to start the conversation →</div>
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

      <form onSubmit={handleSend} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatExpired ? 'chat ended' : 'type a message...'}
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
