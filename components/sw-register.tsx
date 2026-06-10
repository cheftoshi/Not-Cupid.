'use client';

import { useEffect } from 'react';

// Registers the service worker app-wide (mounted once in the root layout).
export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
