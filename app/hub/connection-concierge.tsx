'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { ConciergeRecommendation } from '@/lib/connection-concierge';
import { HUB_CONCIERGE_VERSION } from '@/lib/connection-concierge';
import styles from './hub-shell.module.css';

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  recommendation?: ConciergeRecommendation | null;
  dismissed?: boolean;
};

const STORAGE_KEY = `nc-hub-concierge-${HUB_CONCIERGE_VERSION}`;
const QUICK_STARTS = [
  { label: 'find me a date', prompt: 'What is my best next move in Love right now?' },
  { label: 'do something nearby', prompt: 'Find me one real thing to do around me.' },
  { label: 'meet new friends', prompt: 'Help me make a friend or start a small social plan.' },
  { label: 'find a community', prompt: 'Help me find a club or community I could actually join.' },
];

function localMessage(role: LocalMessage['role'], body: string, recommendation?: ConciergeRecommendation | null): LocalMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, body, recommendation };
}

export default function ConnectionConcierge({
  firstName,
  city,
  initialConsented,
}: {
  firstName: string;
  city?: string | null;
  initialConsented: boolean;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(initialConsented);
  const [pendingConsentMessage, setPendingConsentMessage] = useState('');
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        setMessages(saved.filter((message: any) =>
          message && ['user', 'assistant'].includes(message.role) && typeof message.body === 'string'
        ).slice(-8));
      }
    } catch { /* a broken local draft should never block the Hub */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-8))); } catch { /* private mode */ }
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(raw: string, grantConsent = false) {
    const message = raw.trim().slice(0, 400);
    if (!message || busy) return;
    if (!consented && !grantConsent) {
      setPendingConsentMessage(message);
      setError('');
      return;
    }

    const previous = messages.slice(-6).map((entry) => ({ role: entry.role, body: entry.body }));
    const userMessage = localMessage('user', message);
    setMessages((current) => [...current, userMessage].slice(-8));
    setInput('');
    setPendingConsentMessage('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: previous, consent: grantConsent }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 412 && body.consentRequired) {
        setConsented(false);
        setPendingConsentMessage(message);
        setMessages((current) => current.filter((entry) => entry.id !== userMessage.id));
        return;
      }
      if (!response.ok || !body.recommendation) {
        setError(body.error || 'The concierge could not answer. Your app is still available below.');
        return;
      }
      setConsented(true);
      setMessages((current) => [...current, localMessage('assistant', body.recommendation.message, body.recommendation)].slice(-8));
    } catch {
      setError('The concierge could not connect. Your Love and Friend lines are still available below.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (input.trim()) void ask(input);
    }
  }

  function recordOutcome(recommendation: ConciergeRecommendation, outcome: 'acted' | 'dismissed') {
    if (!recommendation.recommendationId) return;
    void fetch('/api/concierge', {
      method: 'PATCH',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: recommendation.recommendationId, outcome }),
    }).catch(() => {});
  }

  function dismiss(messageId: string, recommendation: ConciergeRecommendation) {
    recordOutcome(recommendation, 'dismissed');
    setMessages((current) => [
      ...current.map((message) => message.id === messageId ? { ...message, dismissed: true } : message),
      localMessage('assistant', 'Got it. Tell me what was off—timing, distance, the kind of person, or the kind of plan—and I’ll take a different route.'),
    ].slice(-8));
  }

  async function revokeConsent() {
    setError('');
    try {
      const response = await fetch('/api/concierge', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'revoke_consent' }),
      });
      if (!response.ok) throw new Error('failed');
      setConsented(false);
      setMessages([]);
      setShowControls(false);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    } catch { setError('AI controls could not be updated. Try again.'); }
  }

  return (
    <section className={styles.conciergeShell} aria-labelledby="concierge-title">
      <div className={styles.conciergeHead}>
        <div className={styles.conciergeMark} aria-hidden>✦</div>
        <div>
          <span>notcupid concierge · first look</span>
          <h1 id="concierge-title">what do you want to do, {firstName}?</h1>
          <p>One conversation for Love, friends, plans, communities, and wherever you&apos;re going next.</p>
        </div>
        <div className={styles.conciergeStatus}><i /> {city ? `live in ${city.split(',')[0]}` : 'live'}</div>
      </div>

      <div className={styles.conciergeBody} aria-live="polite">
        <div className={`${styles.conciergeBubble} ${styles.conciergeAssistant}`}>
          <small>concierge</small>
          <p>I&apos;ll use what is actually available in your app and give you one next move. What outcome are you looking for right now?</p>
        </div>

        {messages.map((message) => (
          <div key={message.id} className={`${styles.conciergeBubble} ${message.role === 'user' ? styles.conciergeUser : styles.conciergeAssistant}`}>
            <small>{message.role === 'user' ? 'you' : 'concierge'}</small>
            <p>{message.body}</p>
            {message.recommendation && !message.dismissed && (
              <div className={styles.conciergeRecommendation}>
                {message.recommendation.href && (
                  <a href={message.recommendation.href} onClick={() => recordOutcome(message.recommendation!, 'acted')}>
                    {message.recommendation.cta || 'open it'} <span>→</span>
                  </a>
                )}
                <button type="button" onClick={() => dismiss(message.id, message.recommendation!)}>not for me</button>
              </div>
            )}
            {message.dismissed && <em className={styles.conciergeDismissed}>dismissed · tell me what was off</em>}
          </div>
        ))}

        {busy && (
          <div className={`${styles.conciergeBubble} ${styles.conciergeAssistant} ${styles.conciergeThinking}`}>
            <small>concierge</small><p><span /> looking across your live options…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && !busy && (
        <div className={styles.conciergeStarts} aria-label="Conversation starters">
          {QUICK_STARTS.map((starter) => (
            <button key={starter.label} type="button" onClick={() => void ask(starter.prompt)}>{starter.label}</button>
          ))}
        </div>
      )}

      {pendingConsentMessage && (
        <div className={styles.conciergeConsent} role="dialog" aria-label="AI data permission">
          <div>
            <strong>Before I answer</strong>
            <p>NotCupid will send the words you type, your first name, broad interests, city, and available in-app options to OpenAI through its API. We do not send your email, exact ZIP, raw quiz answers, or private Love/Friend messages. Nothing is accepted, joined, posted, or sent without you.</p>
          </div>
          <div className={styles.conciergeConsentActions}>
            <button type="button" onClick={() => void ask(pendingConsentMessage, true)} disabled={busy}>agree &amp; ask</button>
            <button type="button" onClick={() => setPendingConsentMessage('')} disabled={busy}>not now</button>
          </div>
        </div>
      )}

      <form className={styles.conciergeComposer} onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          maxLength={400}
          rows={1}
          placeholder="Ask for a date, a friend, a plan, a club, or a new city…"
          aria-label="Message your NotCupid concierge"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send to concierge">{busy ? '…' : 'send'}</button>
      </form>

      {error && <p className={styles.conciergeError}>{error}</p>}
      <div className={styles.conciergeFoot}>
        <span>conversation stays on this device · AI can be wrong · you choose every action</span>
        <button type="button" onClick={() => setShowControls((current) => !current)}>AI controls</button>
      </div>
      {showControls && (
        <div className={styles.conciergeControls}>
          <p>{consented ? 'The Hub concierge is allowed to use the limited context described above.' : 'The Hub concierge is off until you agree before an ask.'}</p>
          {consented && <button type="button" onClick={() => void revokeConsent()}>turn off &amp; clear this conversation</button>}
          <a href="/privacy#ai-features">privacy details →</a>
        </div>
      )}
    </section>
  );
}
