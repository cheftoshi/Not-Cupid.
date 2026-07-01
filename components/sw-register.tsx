'use client';

import { useEffect } from 'react';

// Registers the service worker app-wide (mounted once in the root layout).
export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
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
