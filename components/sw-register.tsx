'use client';

import { useEffect } from 'react';
import { isNativeShell } from '@/lib/native-platform';

// Registers the service worker app-wide (mounted once in the root layout).
export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (isNativeShell()) {
      // A remote WKWebView is not an iOS Home Screen PWA. Remove stale web
      // workers so native releases do not carry two cache/push lifecycles.
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
      return;
    }
    let disposed = false;
    let id: number | undefined;
    let registration: ServiceWorkerRegistration | undefined;
    const updateWhenVisible = () => {
      if (!disposed && registration && document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    };

    // Android can keep an installed PWA process alive for days. Always check
    // the worker script itself at launch and whenever the app returns to the
    // foreground so an old shell cannot linger behind a production deploy.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (disposed) return;
      registration = reg;
      updateWhenVisible();
      document.addEventListener('visibilitychange', updateWhenVisible);
      window.addEventListener('pageshow', updateWhenVisible);
      id = window.setInterval(updateWhenVisible, 60 * 60 * 1000);
    }).catch(() => {});
    return () => {
      disposed = true;
      if (id) window.clearInterval(id);
      document.removeEventListener('visibilitychange', updateWhenVisible);
      window.removeEventListener('pageshow', updateWhenVisible);
    };
  }, []);
  return null;
}
