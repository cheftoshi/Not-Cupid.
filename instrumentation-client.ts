import {
  classifyClientError,
  clientErrorFingerprint,
  safeClientErrorName,
  safeClientErrorSource,
} from '@/lib/client-error-fingerprint';

type ClientErrorDetail = {
  errorKind: 'runtime' | 'promise' | 'resource';
  errorCode: ReturnType<typeof classifyClientError>;
  errorName: string;
  errorSource: string;
  line: number | null;
  column: number | null;
  fingerprint: string;
};

function performanceSessionId(): string {
  try {
    const existing = sessionStorage.getItem('nc_perf_session');
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('nc_perf_session', created);
    return created;
  } catch {
    return '';
  }
}

function sendClientSignal(
  eventName: 'client_error' | 'route_transition',
  metricName?: string,
  errorDetail?: ClientErrorDetail,
) {
  try {
    const sessionId = performanceSessionId();
    const payload = JSON.stringify({
      eventName,
      metricName,
      path: window.location.pathname,
      sessionId,
      ...(errorDetail || {}),
      dedupeKey: errorDetail && sessionId
        ? `client-error:${sessionId || 'private'}:${errorDetail.fingerprint}:${Math.floor(Date.now() / 300000)}`
        : undefined,
      deviceClass: window.innerWidth < 600 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
      displayMode: (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    });
    const beaconed = navigator.sendBeacon?.('/api/performance', new Blob([payload], { type: 'application/json' })) === true;
    if (!beaconed) {
      void fetch('/api/performance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true,
      }).catch(() => {});
    }
  } catch { /* never let instrumentation affect hydration */ }
}

window.addEventListener('error', (event) => {
  const error = event.error instanceof Error ? event.error : null;
  const errorName = safeClientErrorName(error?.name);
  const errorCode = classifyClientError(error?.name, error?.message || event.message);
  const errorSource = safeClientErrorSource(event.filename, window.location.origin);
  const line = Number.isInteger(event.lineno) && event.lineno > 0 ? event.lineno : null;
  const column = Number.isInteger(event.colno) && event.colno > 0 ? event.colno : null;
  const errorKind = error || event.message ? 'runtime' : 'resource';
  sendClientSignal('client_error', undefined, {
    errorKind,
    errorCode,
    errorName,
    errorSource,
    line,
    column,
    fingerprint: clientErrorFingerprint([errorKind, errorCode, errorName, errorSource, line, column]),
  });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorName = safeClientErrorName(reason instanceof Error ? reason.name : null);
  const errorCode = classifyClientError(reason instanceof Error ? reason.name : null, reason instanceof Error ? reason.message : reason);
  const errorKind = 'promise';
  sendClientSignal('client_error', undefined, {
    errorKind,
    errorCode,
    errorName,
    errorSource: 'unknown',
    line: null,
    column: null,
    fingerprint: clientErrorFingerprint([errorKind, errorCode, errorName]),
  });
});

export function onRouterTransitionStart() {
  sendClientSignal('route_transition');
}
