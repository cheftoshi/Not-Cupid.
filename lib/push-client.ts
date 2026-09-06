// Client-side web-push subscribe (shared by the PWA prompt + experiment flow).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Asks for notification permission (if needed), subscribes, and registers the
// subscription server-side. Returns true on success. Safe no-op without VAPID
// key / service worker / iOS-not-installed.
const PUSH_REPAIR_KEY = 'nc_push_subscription_repaired_at';
const PUSH_REPAIR_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

export async function subscribeToPush(options: { repair?: boolean } = {}): Promise<boolean> {
  try {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    } else if (Notification.permission !== 'granted') {
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && options.repair) {
      let lastRepair = 0;
      try { lastRepair = Number(localStorage.getItem(PUSH_REPAIR_KEY) || 0); } catch { /* storage unavailable */ }
      if (!Number.isFinite(lastRepair) || Date.now() - lastRepair >= PUSH_REPAIR_INTERVAL_MS) {
        const removed = await sub.unsubscribe().catch(() => false);
        if (removed) sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource });
    }
    const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    if (res.ok) {
      try { localStorage.setItem(PUSH_REPAIR_KEY, String(Date.now())); } catch { /* storage unavailable */ }
    }
    return res.ok;
  } catch { return false; }
}
