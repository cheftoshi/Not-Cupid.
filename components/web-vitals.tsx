'use client';

import { useReportWebVitals } from 'next/web-vitals';

function context() {
  const width = window.innerWidth;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem('nc_perf_session') || crypto.randomUUID();
    sessionStorage.setItem('nc_perf_session', sessionId);
  } catch { /* private browsing can reject storage */ }
  return {
    sessionId,
    deviceClass: width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop',
    displayMode: standalone ? 'standalone' : 'browser',
  };
}

export default function WebVitals() {
  useReportWebVitals((metric) => {
    try {
      const payload = JSON.stringify({
        eventName: 'web_vital',
        metricName: metric.name,
        metricValue: metric.value,
        rating: metric.rating,
        path: window.location.pathname,
        dedupeKey: `web-vital:${metric.id}:${metric.name}`,
        ...context(),
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/performance', new Blob([payload], { type: 'application/json' }));
      else void fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    } catch { /* performance reporting is best-effort */ }
  });
  return null;
}
