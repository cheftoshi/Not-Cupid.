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
    <div style={{ position: 'fixed', left: '50%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.9rem)', transform: 'translateX(-50%)', zIndex: 90, width: 'min(430px, calc(100vw - 1.25rem))' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 22, padding: '0.7rem', boxShadow: '0 18px 54px -18px rgba(0,0,0,0.55)' }}>
        {showInstall && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.1rem 0.2rem 0.25rem' }}>
            <span style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(37,99,255,0.1)', color: accent, flexShrink: 0 }}>📲</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '0.98rem', lineHeight: 1.05, color: 'var(--h-text)' }}>Put NotCupid on your phone.</div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.76rem', lineHeight: 1.35, color: 'var(--h-text-dim)', marginTop: 3 }}>It opens like an app and makes notifications feel normal.</div>
            </div>
          </div>
        )}
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
        {showInstall === 'fallback' && (
          <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--h-text-dim)', padding: '0 0.3rem' }}>
            open your browser menu and tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>
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
