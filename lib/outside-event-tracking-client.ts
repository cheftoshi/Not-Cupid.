'use client';
import { parseOutsideInput, SESSION_RE, type OutsideAction } from '@/lib/outside-event-tracking';
let fallback: { id: string; seen: number } | undefined;
const sent = new Set<string>();
// Tab-local, rotates after 30 minutes idle; not a persistent device fingerprint.
export function outsideEventSession(): string | undefined {
  try {
    let state = fallback;
    try { const value = sessionStorage.getItem('nc_outside_session_v1'); if (value) state = JSON.parse(value); } catch {}
    if (!state || !SESSION_RE.test(state.id) || !Number.isFinite(state.seen) || Date.now() - state.seen > 1800000) {
      state = { id: crypto.randomUUID(), seen: Date.now() }; sent.clear();
    }
    state.seen = Date.now(); fallback = state;
    try { sessionStorage.setItem('nc_outside_session_v1', JSON.stringify(state)); } catch {}
    return state.id;
  } catch { return undefined; }
}
export function trackOutsideEvent(action: OutsideAction, detail: {eventId?: string; filter?: string; value?: string} = {}): void {
  try {
    if (document.visibilityState !== 'visible') return;
    const input = parseOutsideInput({ action, sessionId: outsideEventSession(), ...detail });
    if (!input) return;
    const payload = JSON.stringify(input);
    if (sent.has(payload)) return;
    sent.add(payload);
    void fetch('/api/friend/events/track', { method:'POST', headers:{'Content-Type':'application/json'}, body:payload, keepalive:true })
      .then(r => { if (!r.ok) sent.delete(payload); }).catch(() => {sent.delete(payload);});
  } catch { /* Measurement never blocks a human action. */ }
}
