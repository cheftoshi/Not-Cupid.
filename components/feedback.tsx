'use client';

import { useEffect, useState } from 'react';

// ── Global branded feedback: toast() + confirmDialog() ─────────────────────
// One <FeedbackHost /> is mounted in app/layout.tsx. Any client component can
// `import { toast, confirmDialog } from '@/components/feedback'` and fire —
// no context/prop plumbing. Replaces every user-facing native alert()/confirm()
// (the OS-gray system popup is the #1 "unpolished" tell). Theme-aware via the
// --h-* tokens; degrades to the native dialogs if the host isn't mounted.

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };
type ConfirmSpec = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

let pushToast: ((t: Omit<ToastItem, 'id'>) => void) | null = null;
let pushConfirm: ((spec: ConfirmSpec, resolve: (ok: boolean) => void) => void) | null = null;

export function toast(message: string, kind: ToastKind = 'info') {
  if (pushToast) pushToast({ kind, message });
  else if (typeof window !== 'undefined') window.alert(message); // host missing — degrade gracefully
}

export function confirmDialog(spec: ConfirmSpec): Promise<boolean> {
  if (!pushConfirm) {
    return Promise.resolve(
      typeof window !== 'undefined'
        ? window.confirm(`${spec.title}${spec.body ? `\n\n${spec.body}` : ''}`)
        : false
    );
  }
  return new Promise((resolve) => pushConfirm!(spec, resolve));
}

const KIND_ICON: Record<ToastKind, string> = { success: '✓', error: '✕', info: '✦' };
const KIND_FG: Record<ToastKind, string> = { success: '#2d7a4f', error: '#c0392b', info: 'var(--h-accent)' };

export default function FeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<{ spec: ConfirmSpec; resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    let n = 0;
    pushToast = (t) => {
      const id = ++n + Date.now();
      setToasts((s) => [...s.slice(-2), { ...t, id }]); // max 3 stacked
      setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200);
    };
    pushConfirm = (spec, resolve) => setConfirmReq({ spec, resolve });
    return () => { pushToast = null; pushConfirm = null; };
  }, []);

  // Esc closes the confirm as "cancel".
  useEffect(() => {
    if (!confirmReq) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmReq]);

  function settle(ok: boolean) {
    confirmReq?.resolve(ok);
    setConfirmReq(null);
  }

  return (
    <>
      <style>{`
        @keyframes ncToastIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ncConfirmIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* toasts — top-center, under the sticky nav */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 62, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 200, pointerEvents: 'none', padding: '0 1rem' }}>
          {toasts.map((t) => (
            <div key={t.id} role="status" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 440, background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.6rem 1.1rem', boxShadow: 'var(--shadow-lg)', animation: 'ncToastIn .28s var(--ease) both' }}>
              <span style={{ color: KIND_FG[t.kind], fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{KIND_ICON[t.kind]}</span>
              <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.85rem', color: 'var(--h-text)', lineHeight: 1.35 }}>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* confirm dialog — branded, promise-based */}
      {confirmReq && (
        <div onClick={() => settle(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', zIndex: 210 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: 'var(--h-surface)', borderRadius: 'var(--r-lg)', padding: '1.6rem', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)', animation: 'ncConfirmIn .25s var(--ease) both' }}>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.35rem', color: 'var(--h-text)', margin: '0 0 0.5rem', lineHeight: 1.2 }}>{confirmReq.spec.title}</h3>
            {confirmReq.spec.body && <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--h-text-dim)', margin: '0 0 1.25rem' }}>{confirmReq.spec.body}</p>}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: confirmReq.spec.body ? 0 : '1.1rem' }}>
              <button onClick={() => settle(false)} style={{ background: 'transparent', border: '1px solid var(--h-border)', color: 'var(--h-text-dim)', borderRadius: 999, padding: '0.65rem 1.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>{confirmReq.spec.cancelLabel || 'never mind'}</button>
              <button onClick={() => settle(true)} autoFocus style={{ background: confirmReq.spec.danger ? '#c0392b' : '#0b0b0b', color: '#fff', border: 'none', borderRadius: 999, padding: '0.65rem 1.3rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>{confirmReq.spec.confirmLabel || 'yes, do it'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
