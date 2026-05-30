'use client';

import { useEffect, useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';
import { CHANGELOG, CHANGELOG_VERSION } from '@/lib/changelog';

const SEEN_KEY = 'nc_changelog_seen';

// Footer row on the dashboard: "what's new" (with a new-dot for returning
// users) and a feedback drop. Both open lightweight modals.
export default function DashboardExtras() {
  const [open, setOpen] = useState<null | 'whatsnew' | 'feedback'>(null);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      setHasNew(seen !== CHANGELOG_VERSION);
    } catch { /* ignore */ }
  }, []);

  function openWhatsNew() {
    setOpen('whatsnew');
    try { localStorage.setItem(SEEN_KEY, CHANGELOG_VERSION); } catch { /* ignore */ }
    setHasNew(false);
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center', padding: '2rem 1rem 0' }}>
        <button onClick={openWhatsNew} style={linkBtn}>
          ✦ what&apos;s new
          {hasNew && <span style={dot} aria-label="new" />}
        </button>
        <span style={{ color: '#cbcbd4' }}>·</span>
        <button onClick={() => setOpen('feedback')} style={linkBtn}>💬 send feedback</button>
      </div>

      {open === 'whatsnew' && <WhatsNewModal onClose={() => setOpen(null)} />}
      {open === 'feedback' && <FeedbackModal onClose={() => setOpen(null)} />}
    </>
  );
}

function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2563ff', marginBottom: 8 }}>
        what&apos;s new
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#0b0b0b', margin: '0 0 18px 0', lineHeight: 1.15 }}>
        we&apos;ve been busy.
      </h2>
      {CHANGELOG.map((entry) => (
        <div key={entry.date} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6b76', marginBottom: 10 }}>{entry.date}</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entry.items.map((it, i) => (
              <li key={i} style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.5, color: '#0b0b0b' }}>{it}</li>
            ))}
          </ul>
        </div>
      ))}
      <button onClick={onClose} style={primaryBtn}>got it</button>
    </Overlay>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function submit() {
    if (!body.trim() || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'could not send');
      setState('done');
    } catch (e: any) {
      setErr(e.message || 'something went wrong');
      setState('error');
    }
  }

  return (
    <Overlay onClose={onClose}>
      {state === 'done' ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#0b0b0b', margin: '0 0 10px 0' }}>thank you.</h2>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6b6b76', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px 0' }}>
            we read every note — it genuinely shapes what we build next.
          </p>
          <button onClick={onClose} style={primaryBtn}>close</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2563ff', marginBottom: 8 }}>
            feedback
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#0b0b0b', margin: '0 0 6px 0' }}>tell us anything.</h2>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6b6b76', fontSize: 13.5, lineHeight: 1.55, margin: '0 0 14px 0' }}>
            a bug, an idea, a gripe, a win — it all helps. we&apos;re a small team in Boston actually reading this.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={5}
            placeholder="what's on your mind?"
            style={{
              width: '100%', borderRadius: 12, border: '1px solid rgba(11,11,11,0.15)', padding: '12px 14px',
              fontFamily: 'system-ui, sans-serif', fontSize: 14, resize: 'vertical', outline: 'none', color: '#0b0b0b',
            }}
          />
          {state === 'error' && <p style={{ color: '#d2530f', fontSize: 12, margin: '8px 0 0', fontFamily: "'DM Mono', monospace" }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={onClose} style={ghostBtn}>cancel</button>
            <button onClick={submit} disabled={!body.trim() || state === 'sending'} style={{ ...primaryBtn, flex: 1, opacity: !body.trim() || state === 'sending' ? 0.5 : 1 }}>
              {state === 'sending' ? 'sending…' : 'send feedback'}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 26, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px -20px rgba(11,11,11,0.4)' }}>
        {children}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6b76',
};
const dot: React.CSSProperties = {
  display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff6a1f', marginLeft: 6, verticalAlign: 'middle',
};
const primaryBtn: React.CSSProperties = {
  background: '#0b0b0b', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 22px',
  fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: '#6b6b76', border: '1px solid rgba(11,11,11,0.15)', borderRadius: 999, padding: '12px 18px',
  fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
};
