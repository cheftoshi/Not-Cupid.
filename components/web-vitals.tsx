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
      // Attribute layout shifts to explicit UI regions only. Never collect
      // selectors, element IDs, user text, or message contents.
      const regions = new Set<string>();
      if (metric.name === 'CLS') {
        for (const entry of metric.entries) {
          for (const source of (entry as PerformanceEntry & { sources?: Array<{ node?: Node }> }).sources || []) {
            const region = source.node instanceof Element ? source.node.closest('[data-perf-region]')?.getAttribute('data-perf-region') : null;
            if (region && ['navigation', 'hub', 'hub-brief', 'hub-composer', 'love-roster', 'love-connections', 'friend', 'chat'].includes(region)) regions.add(region);
          }
        }
      }
      const payload = JSON.stringify({
        eventName: 'web_vital',
        metricName: metric.name,
        metricValue: metric.value,
        rating: metric.rating,
        layoutRegions: [...regions].slice(0, 8),
        path: window.location.pathname,
        dedupeKey: `web-vital:${metric.id}:${metric.name}`,
        ...context(),
      });
      const beaconed = navigator.sendBeacon?.('/api/performance', new Blob([payload], { type: 'application/json' })) === true;
      if (!beaconed) void fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    } catch { /* performance reporting is best-effort */ }
  });
  return null;
}
