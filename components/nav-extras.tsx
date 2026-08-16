'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseResponse } from '@/lib/fetch-helpers';
import { CHANGELOG, CHANGELOG_VERSION } from '@/lib/changelog';
import { isNativeShell } from '@/lib/native-platform';

const SEEN_KEY = 'nc_changelog_seen';

// Feedback + "what's new" — lives in the global top nav (next to profile/log out),
// not as a floating card. Both open lightweight modals.
export default function NavExtras() {
  const [open, setOpen] = useState<null | 'whatsnew' | 'feedback'>(null);
  const [hasNew, setHasNew] = useState(false);
  const [menu, setMenu] = useState(false); // mobile "•••" dropdown
  const [nativeShell, setNativeShell] = useState(false);

  useEffect(() => {
    try { setHasNew(localStorage.getItem(SEEN_KEY) !== CHANGELOG_VERSION); } catch { /* ignore */ }
    setNativeShell(isNativeShell());
  }, []);

  function openWhatsNew() {
    setMenu(false); setOpen('whatsnew');
    try { localStorage.setItem(SEEN_KEY, CHANGELOG_VERSION); } catch { /* ignore */ }
    setHasNew(false);
  }
  function openFeedback() { setMenu(false); setOpen('feedback'); }
  function openInstall() {
    setMenu(false);
    if (nativeShell) return;
    window.dispatchEvent(new Event('nc:show-install-prompt'));
  }

  return (
    <>
      {/* inline on desktop; collapses into a ••• menu on narrow screens */}
      <style>{`
        .nxInline { display: inline-flex; align-items: center; gap: 0.7rem; }
        .nxMore { display: none; position: relative; }
        .nxMoreBtn { min-width: 36px; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px !important; border: 1px solid var(--h-border) !important; background: var(--h-surface) !important; }
        .nxMobileMenu { position: fixed; right: 0.75rem; top: calc(env(safe-area-inset-top, 0px) + 3.85rem); background: var(--h-surface); border: 1px solid var(--h-border); border-radius: 14px; box-shadow: 0 18px 52px -18px rgba(0,0,0,0.48); padding: 0.4rem; display: flex; flex-direction: column; gap: 0.12rem; z-index: 220; min-width: 174px; }
        .nxScrim { position: fixed; inset: 0; z-index: 210; background: transparent; }
        .nxOverlay { position: fixed; inset: 0; z-index: 500; display: flex; align-items: center; justify-content: center; padding: max(1rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px)) max(1rem, env(safe-area-inset-bottom, 0px)) max(1rem, env(safe-area-inset-left, 0px)); background: rgba(11,11,11,0.54); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }
        .nxModal { display: flex; flex-direction: column; width: min(460px, 100%); max-height: calc(100vh - 2rem); max-height: calc(100dvh - max(2rem, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))); overflow: hidden; border: 1px solid var(--h-border); border-radius: 18px; background: var(--h-surface); box-shadow: 0 24px 70px -22px rgba(11,11,11,0.55); }
        .nxModalToolbar { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; min-height: 54px; padding: 0.55rem 0.75rem 0.55rem 1.1rem; border-bottom: 1px solid var(--h-border); background: var(--h-surface); }
        .nxModalTitle { font-family: 'DM Mono', monospace; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--h-accent); }
        .nxModalClose { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border: 1px solid var(--h-border); border-radius: 999px; background: var(--h-surface-2); color: var(--h-text); font: 24px/1 system-ui, sans-serif; cursor: pointer; }
        .nxModalBody { min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 1.25rem 1.35rem calc(1.35rem + env(safe-area-inset-bottom, 0px)); }
        @media (max-width: 600px) {
          .nxInline { display: none; }
          .nxMore { display: inline-block; }
          .nxOverlay { align-items: flex-end; padding: max(0.5rem, env(safe-area-inset-top, 0px)) 0 0; }
          .nxModal { width: 100%; max-height: calc(100vh - max(0.5rem, env(safe-area-inset-top, 0px))); max-height: calc(100dvh - max(0.5rem, env(safe-area-inset-top, 0px))); border-radius: 20px 20px 0 0; border-bottom: 0; }
          .nxModalToolbar { padding-top: 0.6rem; padding-left: max(1.1rem, env(safe-area-inset-left, 0px)); padding-right: max(0.75rem, env(safe-area-inset-right, 0px)); }
          .nxModalBody { padding-left: max(1.2rem, env(safe-area-inset-left, 0px)); padding-right: max(1.2rem, env(safe-area-inset-right, 0px)); }
        }
      `}</style>

      <span className="nxInline">
        <button onClick={openWhatsNew} style={navLink} title="what's new">✦ new{hasNew && <span style={dot} aria-label="new" />}</button>
        <button onClick={openFeedback} style={navLink} title="send feedback">💬 feedback</button>
      </span>

      <span className="nxMore">
        <button className="nxMoreBtn" onClick={() => setMenu((v) => !v)} style={{ ...navLink, fontSize: '0.95rem', letterSpacing: '0.05em' }} aria-label="more options" aria-expanded={menu}>•••{hasNew && <span style={dot} aria-label="new" />}</button>
        {menu && (<>
          <div className="nxScrim" onClick={() => setMenu(false)} />
          <div className="nxMobileMenu">
            <button onClick={openWhatsNew} style={menuItem}>✦ what&apos;s new{hasNew && <span style={dot} />}</button>
            <button onClick={openFeedback} style={menuItem}>💬 feedback</button>
            {!nativeShell && <button onClick={openInstall} style={menuItem}>📲 install app</button>}
          </div>
        </>)}
      </span>

      {open === 'whatsnew' && <WhatsNewModal onClose={() => setOpen(null)} />}
      {open === 'feedback' && <FeedbackModal onClose={() => setOpen(null)} />}
    </>
  );
}

function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay title="what's new" onClose={onClose}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--h-text)', margin: '0 0 18px 0', lineHeight: 1.15 }}>we&apos;ve been busy.</h2>
      {CHANGELOG.map((entry) => (
        <div key={entry.date} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: 10 }}>{entry.date}</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entry.items.map((it, i) => (
              <li key={i} style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.5, color: 'var(--h-text)' }}>{it}</li>
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
      const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body.trim() }) });
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'could not send');
      setState('done');
    } catch (e: any) { setErr(e.message || 'something went wrong'); setState('error'); }
  }

  return (
    <Overlay title="feedback" onClose={onClose}>
      {state === 'done' ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: 'var(--h-text)', margin: '0 0 10px 0' }}>thank you.</h2>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px 0' }}>we read every note — it genuinely shapes what we build next.</p>
          <button onClick={onClose} style={primaryBtn}>close</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--h-accent)', marginBottom: 8 }}>feedback</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: 'var(--h-text)', margin: '0 0 6px 0' }}>tell us anything.</h2>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', fontSize: 13.5, lineHeight: 1.55, margin: '0 0 14px 0' }}>a bug, an idea, a gripe, a win — it all helps. we&apos;re a small team in Boston actually reading this.</p>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} placeholder="what's on your mind?"
            style={{ width: '100%', borderRadius: 12, border: '1px solid var(--h-border)', padding: '12px 14px', fontFamily: 'system-ui, sans-serif', fontSize: 14, resize: 'vertical', outline: 'none', color: 'var(--h-text)', background: 'var(--h-surface)' }} />
          {state === 'error' && <p style={{ color: 'var(--h-accent-2)', fontSize: 12, margin: '8px 0 0', fontFamily: "'DM Mono', monospace" }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={onClose} style={ghostBtn}>cancel</button>
            <button onClick={submit} disabled={!body.trim() || state === 'sending'} style={{ ...primaryBtn, flex: 1, opacity: !body.trim() || state === 'sending' ? 0.5 : 1 }}>{state === 'sending' ? 'sending…' : 'send feedback'}</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    bodyRef.current?.scrollTo({ top: 0 });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="nxOverlay" onClick={onClose}>
      <section className="nxModal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="nxModalToolbar">
          <span className="nxModalTitle">{title}</span>
          <button className="nxModalClose" onClick={onClose} aria-label={`close ${title}`} autoFocus>×</button>
        </div>
        <div ref={bodyRef} className="nxModalBody">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

const navLink: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', whiteSpace: 'nowrap' };
const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0.7rem', borderRadius: 8, fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text)', whiteSpace: 'nowrap' };
const dot: React.CSSProperties = { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff6a1f', marginLeft: 4, verticalAlign: 'middle' };
const primaryBtn: React.CSSProperties = { background: '#0b0b0b', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 22px', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { background: 'transparent', color: 'var(--h-text-dim)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '12px 18px', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' };
