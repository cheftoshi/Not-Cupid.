'use client';

import { useEffect, useState } from 'react';

// PWA niceties — a FLOATING prompt mounted ONCE in the root layout, so the
// "install the app" tag shows on EVERY page (not just dashboard/friends):
//  1. push: one-tap "turn on notifications" (and silent re-subscribe when
//     permission is already granted, so device swaps don't lose pushes)
//  2. install: Android/desktop get the real install prompt; iOS Safari gets
//     the "Share → Add to Home Screen" hint (Apple offers no API).
// Auto-hides once installed (standalone) / permission granted. Dismissible +
// remembered in localStorage. (A logged-out user who grants push gets silently
// subscribed on their next logged-in load via the `granted` branch.)

const DISMISS_KEY = 'nc_pwa_prompt_dismissed';

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
  const [showInstall, setShowInstall] = useState<false | 'native' | 'ios'>(false);
  const [busy, setBusy] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1';
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
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIos) {
        setShowInstall('ios');
      } else {
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
    localStorage.setItem(DISMISS_KEY, '1');
    setShowPush(false);
    setShowInstall(false);
  }

  const pill: React.CSSProperties = {
    border: `1.5px solid ${accent}`,
    background: 'var(--h-surface)',
    color: accent,
    borderRadius: 999,
    padding: '0.55rem 1.05rem',
    fontFamily: "'DM Mono', monospace",
    fontSize: '0.6rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', left: '50%', bottom: '0.9rem', transform: 'translateX(-50%)', zIndex: 60, maxWidth: 'calc(100vw - 1.5rem)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.5rem 0.7rem', boxShadow: '0 14px 44px -14px rgba(0,0,0,0.5)' }}>
        {showPush && (
          <button onClick={enablePush} disabled={busy} style={{ ...pill, background: accent, color: '#fff' }}>
            {busy ? 'turning on…' : '🔔 get pinged when you match'}
          </button>
        )}
        {showInstall === 'native' && (
          <button onClick={install} style={pill}>📲 install the app</button>
        )}
        {showInstall === 'ios' && (
          <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--h-text-dim)', padding: '0 0.3rem' }}>
            📲 on iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
          </span>
        )}
        <button
          onClick={dismiss}
          aria-label="dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--h-text-faint)', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 0.3rem' }}
        >
          not now
        </button>
      </div>
    </div>
  );
}
