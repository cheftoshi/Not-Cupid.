'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

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

export default function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    const payload = JSON.stringify({
      path: pathname,
      ref: safeReferrer(),
      anonId: anonId(),
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* never let tracking break the page */
    }
  }, [pathname]);
  return null;
}
