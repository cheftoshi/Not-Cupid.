function sendClientSignal(eventName: 'client_error' | 'route_transition', metricName?: string) {
  try {
    const payload = JSON.stringify({
      eventName,
      metricName,
      path: window.location.pathname,
      deviceClass: window.innerWidth < 600 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
      displayMode: (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/performance', new Blob([payload], { type: 'application/json' }));
    else void fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
  } catch { /* never let instrumentation affect hydration */ }
}

window.addEventListener('error', () => sendClientSignal('client_error'));
window.addEventListener('unhandledrejection', () => sendClientSignal('client_error'));

export function onRouterTransitionStart() {
  sendClientSignal('route_transition');
}
