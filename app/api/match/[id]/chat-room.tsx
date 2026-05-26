'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ChatRoom({ matchId, currentUserId, otherUser, match, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [matchStatus, setMatchStatus] = useState(match.status);
  const [chatExpiresAt, setChatExpiresAt] = useState(match.chat_expires_at);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatExpired =
    matchStatus === 'ended' ||
    !!(chatExpiresAt && new Date(chatExpiresAt) < new Date());

  const status = chatExpired
    ? 'chat ended'
    : chatExpiresAt
    ? timeLeft(chatExpiresAt)
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

  async function handleEnd() {
    if (ending) return;
    const confirmed = window.confirm(
      'End this chat? Both of you will be free to match with new people. This cannot be undone.'
    );
    if (!confirmed) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/end`, { method: 'POST' });
      if (!res.ok) throw new Error('End failed');
      setMatchStatus('ended');
      setChatExpiresAt(new Date().toISOString());
      setTimeout(() => router.push('/dashboard'), 800);
    } catch {
      setEnding(false);
      alert('Could not end chat. Try again.');
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
      </header>

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
        {!chatExpired && (
          <button onClick={handleEnd} disabled={ending} className={styles.endChatLink}>
            {ending ? 'ending...' : 'end chat →'}
          </button>
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
