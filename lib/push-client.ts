// Client-side web-push subscribe (shared by the PWA prompt + the raffle card).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Asks for notification permission (if needed), subscribes, and registers the
// subscription server-side. Returns true on success. Safe no-op without VAPID
// key / service worker / iOS-not-installed.
export async function subscribeToPush(): Promise<boolean> {
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
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource });
    }
    const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    return res.ok;
  } catch { return false; }
}
