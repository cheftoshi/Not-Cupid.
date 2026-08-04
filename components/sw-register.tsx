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
    let id: number | undefined;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {});
      id = window.setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    return () => {
      if (id) window.clearInterval(id);
    };
  }, []);
  return null;
}
