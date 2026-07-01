'use client';

import { useEffect, useState } from 'react';

// PWA niceties — a FLOATING prompt mounted ONCE in the root layout, so the
// "install the app" tag shows on EVERY page (not just dashboard/friends):
//  1. push: one-tap "turn on notifications" (and silent re-subscribe when
//     permission is already granted, so device swaps don't lose pushes)
//  2. install: Android/desktop get the real install prompt; iOS Safari gets
//     the "Share → Add to Home Screen" hint (Apple offers no API).
// Auto-hides once installed (standalone) / permission granted. Dismissible, but
// only snoozed briefly on phones so people can still find the app-install path.
// A logged-out user who grants push gets silently subscribed on their next
// logged-in load via the `granted` branch.

const DISMISS_KEY = 'nc_pwa_prompt_dismissed';
const DISMISS_MS = 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === '1') {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function getInstallMode(): false | 'native' | 'ios' | 'fallback' {
  if (typeof window === 'undefined') return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
  if (standalone) return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android|mobile/i.test(ua)) return 'fallback';
  return false;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(): Promise<boolean> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    });
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

export default function PwaPrompt({ accent = '#2563ff' }: { accent?: string }) {
  const [showPush, setShowPush] = useState(false);
  const [showInstall, setShowInstall] = useState<false | 'native' | 'ios' | 'fallback'>(false);
  const [busy, setBusy] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = dismissedRecently();
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    // ── push ──
    const pushSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (pushSupported && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      if (Notification.permission === 'granted') {
        // Keep the subscription fresh silently — no UI.
        subscribeToPush().catch(() => {});
      } else if (Notification.permission === 'default' && !dismissed) {
        setShowPush(true);
      }
    }

    // ── install ──
    if (!standalone && !dismissed) {
      const installMode = getInstallMode();
      if (installMode === 'ios' || installMode === 'fallback') setShowInstall(installMode);
      if (installMode !== 'ios') {
        const onPrompt = (e: Event) => {
          e.preventDefault();
          setInstallEvt(e);
          setShowInstall('native');
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        return () => window.removeEventListener('beforeinstallprompt', onPrompt);
      }
    }
  }, []);

  useEffect(() => {
    function forceInstallPrompt() {
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
      setShowInstall(installEvt ? 'native' : getInstallMode() || 'fallback');
    }
    window.addEventListener('nc:show-install-prompt', forceInstallPrompt);
    return () => window.removeEventListener('nc:show-install-prompt', forceInstallPrompt);
  }, [installEvt]);

  if (!showPush && !showInstall) return null;

  async function enablePush() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await subscribeToPush();
      setShowPush(false);
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    setShowInstall(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPush(false);
    setShowInstall(false);
  }

  const pill: React.CSSProperties = {
    border: `1px solid ${accent}`,
    background: 'var(--h-surface)',
    color: accent,
    borderRadius: 999,
    padding: '0.64rem 1rem',
    fontFamily: "'Bebas Neue', system-ui, sans-serif",
    fontSize: '1rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.8rem)', transform: 'translateX(-50%)', zIndex: 90, width: 'min(460px, calc(100vw - 1rem))' }}>
      <div style={{ display: 'grid', gap: '0.65rem', background: 'color-mix(in srgb, var(--h-surface) 96%, transparent)', border: '1px solid var(--h-border)', borderRadius: 24, padding: '0.8rem', boxShadow: '0 20px 60px -22px rgba(0,0,0,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        {showInstall && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.72rem', padding: '0.12rem 0.18rem 0' }}>
            <img src="/icons/icon-192.png" alt="" style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, boxShadow: '0 12px 26px -18px rgba(0,0,0,0.55)' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.06rem', lineHeight: 1.08, color: 'var(--h-text)' }}>Keep your connection experiment in your pocket.</div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.76rem', lineHeight: 1.35, color: 'var(--h-text-dim)', marginTop: 4 }}>Install NotCupid for faster access to Friend Line, chats, and real-plan pings.</div>
            </div>
          </div>
        )}
        {showInstall && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '0.35rem' }}>
            {['friend line', 'chats', 'pings'].map((x) => (
              <span key={x} style={{ textAlign: 'center', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.3rem 0.35rem', background: 'var(--h-surface-2)', color: 'var(--h-text-dim)', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{x}</span>
            ))}
          </div>
        )}
        {showPush && (
          <button onClick={enablePush} disabled={busy} style={{ ...pill, background: accent, color: '#fff', width: '100%' }}>
            {busy ? 'turning on…' : 'turn on real-time pings'}
          </button>
        )}
        {showInstall === 'native' && (
          <button onClick={install} style={{ ...pill, width: '100%' }}>install NotCupid</button>
        )}
        {showInstall === 'ios' && (
          <div style={{ border: '1px dashed var(--h-border)', borderRadius: 16, padding: '0.7rem', color: 'var(--h-text-dim)', fontSize: '0.82rem', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--h-text)' }}>iPhone install:</strong> tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It will open from your home screen like an app.
          </div>
        )}
        {showInstall === 'fallback' && (
          <div style={{ border: '1px dashed var(--h-border)', borderRadius: 16, padding: '0.7rem', color: 'var(--h-text-dim)', fontSize: '0.82rem', lineHeight: 1.45 }}>
            Open your browser menu and tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
          </div>
        )}
        <button
          onClick={dismiss}
          aria-label="dismiss"
          style={{ justifySelf: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--h-text-faint)', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.1rem 0.3rem' }}
        >
          not now
        </button>
      </div>
    </div>
  );
}
