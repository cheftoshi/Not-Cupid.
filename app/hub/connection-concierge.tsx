'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type {
  ConciergeBrief,
  ConciergeRecommendation,
  ConnectionMemory,
  ConnectionMemorySuggestion,
} from '@/lib/connection-concierge';
import { HUB_CONCIERGE_VERSION } from '@/lib/connection-concierge';
import styles from './hub-shell.module.css';

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  recommendation?: ConciergeRecommendation | null;
  dismissed?: boolean;
  memoryHandled?: boolean;
};

const STORAGE_KEY = `nc-hub-concierge-${HUB_CONCIERGE_VERSION}`;
const QUICK_STARTS = [
  { label: 'find my next Love move', prompt: 'What is my best next move in Love right now?' },
  { label: 'make a plan nearby', prompt: 'Find me one real thing I could do nearby.' },
  { label: 'meet new people', prompt: 'Help me meet a new friend or find a community.' },
];
const CORRECTIONS = [
  { key: 'too_far', label: 'too far', prompt: 'That suggestion is too far away. Give me a closer option.' },
  { key: 'wrong_vibe', label: 'wrong vibe', prompt: 'That suggestion is not the vibe I want. Try a different direction.' },
  { key: 'not_tonight', label: 'not tonight', prompt: 'Not tonight. Give me a better move for another day.' },
  { key: 'smaller_group', label: 'smaller group', prompt: 'I would rather do something one-on-one or with a smaller group.' },
] as const;

const FALLBACK_BRIEF: ConciergeBrief = {
  headline: 'I’m looking across your options.',
  message: 'Tell me who you want to meet or what you want to do. I’ll give you one useful next move.',
  signals: [],
};

function localMessage(role: LocalMessage['role'], body: string, recommendation?: ConciergeRecommendation | null): LocalMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, body, recommendation };
}

function memoryLabel(category: ConnectionMemory['category']): string {
  return ({
    goal: 'goal', preference: 'preference', boundary: 'boundary', availability: 'availability',
    location: 'location', coaching_style: 'how to coach me', current_context: 'right now',
  })[category];
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
  const [brief, setBrief] = useState<ConciergeBrief>(FALLBACK_BRIEF);
  const [briefLoading, setBriefLoading] = useState(true);
  const [memories, setMemories] = useState<ConnectionMemory[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(initialConsented);
  const [pendingConsentMessage, setPendingConsentMessage] = useState('');
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          setMessages(saved.filter((message: any) =>
            message && ['user', 'assistant'].includes(message.role) && typeof message.body === 'string'
          ).slice(-12));
        }
      }
    } catch { /* a broken local draft should never block the Hub */ }

    fetch('/api/concierge', { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok) return;
        if (body.brief?.headline && body.brief?.message) setBrief(body.brief);
        if (Array.isArray(body.memories)) setMemories(body.memories);
        setConsented(body.consented === true);
      })
      .catch(() => {})
      .finally(() => setBriefLoading(false));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-12))); } catch { /* private mode */ }
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
    setMessages((current) => [...current, userMessage].slice(-12));
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
        setError(body.error || 'I could not answer that. Try again in a moment.');
        return;
      }
      setConsented(true);
      setMessages((current) => [
        ...current,
        localMessage('assistant', body.recommendation.message, body.recommendation),
      ].slice(-12));
    } catch {
      setError('I could not connect. Your Love and Friend tabs are still available above.');
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
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

  function correct(messageId: string, recommendation: ConciergeRecommendation, correction: typeof CORRECTIONS[number]) {
    recordOutcome(recommendation, 'dismissed');
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, dismissed: true } : message));
    void fetch('/api/concierge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'correction',
        correction: correction.key,
        recommendationId: recommendation.recommendationId,
      }),
    }).catch(() => {});
    void ask(correction.prompt);
  }

  async function remember(messageId: string, suggestion: ConnectionMemorySuggestion) {
    setError('');
    try {
      const response = await fetch('/api/concierge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'remember', memory: suggestion }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.memory) throw new Error('failed');
      setMemories((current) => [body.memory, ...current.filter((memory) => memory.id !== body.memory.id)]);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, memoryHandled: true } : message));
    } catch {
      setError('I could not save that memory. Try again.');
    }
  }

  function skipMemory(messageId: string) {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, memoryHandled: true } : message));
  }

  async function forget(memoryId: string) {
    const response = await fetch('/api/concierge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'forget', memoryId }),
    }).catch(() => null);
    if (response?.ok) setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    else setError('I could not forget that yet. Try again.');
  }

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setShowControls(false);
  }

  async function revokeConsent() {
    setError('');
    try {
      const response = await fetch('/api/concierge', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'revoke_consent' }),
      });
      if (!response.ok) throw new Error('failed');
      setConsented(false);
      clearChat();
    } catch { setError('AI controls could not be updated. Try again.'); }
  }

  return (
    <section className={styles.conciergeShell} aria-labelledby="concierge-title">
      <header className={styles.conciergeHead}>
        <div className={styles.conciergeMark} aria-hidden>✦</div>
        <div className={styles.conciergeIdentity}>
          <span>notcupid concierge</span>
          <h1 id="concierge-title">I’m your AI connection concierge.</h1>
          <p>{city ? `Live context for ${city.split(',')[0]}.` : 'Live context from your NotCupid account.'} You choose every action.</p>
        </div>
        <button className={styles.conciergeControlButton} type="button" onClick={() => setShowControls((current) => !current)} aria-expanded={showControls}>
          {memories.length ? `memory · ${memories.length}` : 'AI controls'}
        </button>
      </header>

      {showControls && (
        <aside className={styles.conciergeControls} aria-label="AI and memory controls">
          <div className={styles.conciergeControlsHead}>
            <div>
              <strong>What I remember</strong>
              <p>Only facts you explicitly approve appear here. Raw chat stays on this device.</p>
            </div>
            <button type="button" onClick={() => setShowControls(false)} aria-label="Close AI controls">close</button>
          </div>
          {memories.length ? (
            <div className={styles.conciergeMemoryList}>
              {memories.map((memory) => (
                <div key={memory.id}>
                  <span>{memoryLabel(memory.category)}</span>
                  <p>{memory.value}</p>
                  <button type="button" onClick={() => void forget(memory.id)}>forget</button>
                </div>
              ))}
            </div>
          ) : <p className={styles.conciergeMemoryEmpty}>Nothing saved yet.</p>}
          <div className={styles.conciergeControlActions}>
            {messages.length > 0 && <button type="button" onClick={clearChat}>clear this chat</button>}
            {consented && <button type="button" onClick={() => void revokeConsent()}>turn off AI</button>}
            <a href="/privacy#ai-features">privacy details</a>
          </div>
        </aside>
      )}

      <div className={styles.conciergeBody} aria-live="polite">
        <div className={`${styles.conciergeBubble} ${styles.conciergeAssistant} ${styles.conciergeBrief}`}>
          <small>{briefLoading ? 'checking what is live' : 'your connection brief'}</small>
          <strong>{brief.headline}</strong>
          <p>{brief.message}</p>
          {brief.signals.length > 0 && (
            <div className={styles.conciergeSignals}>
              {brief.signals.map((signal) => <span key={signal}>{signal}</span>)}
            </div>
          )}
        </div>

        {messages.map((message) => (
          <div key={message.id} className={`${styles.conciergeBubble} ${message.role === 'user' ? styles.conciergeUser : styles.conciergeAssistant}`}>
            <small>{message.role === 'user' ? 'you' : 'concierge'}</small>
            <p>{message.body}</p>
            {message.recommendation && !message.dismissed && (
              <>
                {message.recommendation.href && (
                  <div className={styles.conciergeRecommendation}>
                    <a href={message.recommendation.href} onClick={() => recordOutcome(message.recommendation!, 'acted')}>
                      {message.recommendation.cta || 'open it'} <span>→</span>
                    </a>
                  </div>
                )}
                <div className={styles.conciergeCorrections} aria-label="Correct this suggestion">
                  <span>not quite?</span>
                  {CORRECTIONS.map((correction) => (
                    <button key={correction.key} type="button" onClick={() => correct(message.id, message.recommendation!, correction)}>
                      {correction.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {message.recommendation?.memorySuggestion && !message.memoryHandled && (
              <div className={styles.conciergeRemember}>
                <span>Remember this for next time?</span>
                <p>{message.recommendation.memorySuggestion.value}</p>
                <div>
                  <button type="button" onClick={() => void remember(message.id, message.recommendation!.memorySuggestion!)}>remember this</button>
                  <button type="button" onClick={() => skipMemory(message.id)}>not now</button>
                </div>
              </div>
            )}
            {message.memoryHandled && message.recommendation?.memorySuggestion && (
              <em className={styles.conciergeSaved}>memory choice recorded</em>
            )}
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
            <p>I’ll send what you type plus limited profile and live in-app context to OpenAI. I won’t send your email, exact ZIP, raw quiz answers, or private messages. Saved memory requires a separate tap and stays visible in AI controls.</p>
          </div>
          <div className={styles.conciergeConsentActions}>
            <button type="button" onClick={() => void ask(pendingConsentMessage, true)} disabled={busy}>agree &amp; ask</button>
            <button type="button" onClick={() => setPendingConsentMessage('')} disabled={busy}>not now</button>
          </div>
        </div>
      )}

      <form className={styles.conciergeComposer} onSubmit={submit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          maxLength={400}
          rows={1}
          placeholder="What do you want to do?"
          aria-label="Message your NotCupid concierge"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send to concierge">{busy ? '…' : 'send'}</button>
      </form>

      {error && <p className={styles.conciergeError}>{error}</p>}
      <footer className={styles.conciergeFoot}>
        <span>AI can be wrong. Nothing is sent, joined, or booked for you.</span>
        <button type="button" onClick={() => setShowControls(true)}>your memory</button>
      </footer>
    </section>
  );
}
