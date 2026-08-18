'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureBrowserAcquisition } from '@/lib/acquisition';

// Stable per-browser anonymous id (localStorage). Not tied to identity — just
// lets us count unique sessions in the admin traffic view.
function anonId(): string {
  try {
    let id = localStorage.getItem('nc_anon');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('nc_anon', id);
    }
    return id;
  } catch {
    return '';
  }
}

function safeReferrer(): string | null {
  try {
    if (!document.referrer) return null;
    const referrer = new URL(document.referrer);
    return `${referrer.origin}${referrer.pathname}`;
  } catch {
    return null;
  }
}

// Coarse rendering context only: enough to separate installed PWA behavior
// from browser traffic without retaining a user agent, device model, or raw
// dimensions. `navigator.standalone` is the iOS Home Screen signal.
function clientContext() {
  try {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const displayMode = iosStandalone || window.matchMedia('(display-mode: standalone)').matches
      ? 'standalone'
      : window.matchMedia('(display-mode: minimal-ui)').matches
        ? 'minimal-ui'
        : window.matchMedia('(display-mode: fullscreen)').matches
          ? 'fullscreen'
          : 'browser';
    const width = window.innerWidth;
    return {
      displayMode,
      deviceClass: width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop',
      orientation: window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait',
    };
  } catch {
    return { displayMode: 'unknown', deviceClass: 'unknown', orientation: 'unknown' };
  }
}

export default function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    const acquisition = captureBrowserAcquisition(pathname);
    const payload = JSON.stringify({
      path: pathname,
      ref: safeReferrer(),
      anonId: anonId(),
      acquisition,
      ...clientContext(),
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never let tracking break the page */
    }
  }, [pathname]);
  return null;
}
