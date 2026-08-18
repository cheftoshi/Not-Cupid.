'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" style={{ position: 'fixed', top: 'calc(var(--app-safe-top, 0px) + 0.45rem)', left: '50%', transform: 'translateX(-50%)', zIndex: 120, width: 'min(440px, calc(100vw - 1rem))', borderRadius: 999, padding: '0.6rem 0.9rem', background: '#0b0b0b', color: '#fff', textAlign: 'center', font: "0.58rem 'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: 'var(--shadow-lg)' }}>
      you&apos;re offline · we&apos;ll reconnect without losing your place
    </div>
  );
}
