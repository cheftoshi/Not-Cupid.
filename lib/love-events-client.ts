'use client';

export type LoveClientEvent =
  | 'love_dashboard_open'
  | 'roster_view'
  | 'profile_open'
  | 'compatibility_read_requested'
  | 'compatibility_read_paywall'
  | 'pick_attempt'
  | 'pick_failed'
  | 'no_suitable_choice'
  | 'mutual_chat_open'
  | 'coach_requested'
  | 'push_prompt_shown'
  | 'push_enabled'
  | 'push_dismissed';

function clientContext() {
  try {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const width = window.innerWidth;
    return {
      displayMode: standalone ? 'standalone' : 'browser',
      deviceClass: width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop',
    };
  } catch {
    return { displayMode: 'unknown', deviceClass: 'unknown' };
  }
}

export function trackLoveEvent(
  eventName: LoveClientEvent,
  detail: {
    matchId?: string;
    candidateId?: string;
    durationMs?: number;
    metadata?: Record<string, string | number | boolean | null>;
  } = {},
): void {
  try {
    const payload = JSON.stringify({
      eventName,
      path: window.location.pathname,
      surface: window.location.pathname.startsWith('/match/') ? 'love_chat' : 'love_dashboard',
      ...detail,
      ...clientContext(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/love/events', new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch('/api/love/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Measurement must never interrupt the interaction it describes.
  }
}
