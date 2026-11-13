// Deliberately closed vocabulary: never accept search text, interests, URLs or location.
export const OUTSIDE_ACTIONS = ['panel_open', 'impression', 'source_click', 'invitation_open', 'plan_start', 'filter'] as const;
export type OutsideAction = typeof OUTSIDE_ACTIONS[number];
export const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OUTSIDE_ID_RE = /^(?:live:tm:[A-Za-z0-9_-]{1,100}|live:curated:[a-z0-9][a-z0-9_-]{0,79})$/;
const filters: Record<string, readonly string[]> = { category: ['all','music','arts','sports','food','outdoors','community'], when: ['upcoming','today','weekend','week'], free: ['yes','no'], reset: ['all'] };
export type OutsideInput = { action: OutsideAction; sessionId: string; eventId?: string; filter?: string; value?: string };
export function parseOutsideInput(body: unknown): OutsideInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.action !== 'string' || !(OUTSIDE_ACTIONS as readonly string[]).includes(b.action) || typeof b.sessionId !== 'string' || !SESSION_RE.test(b.sessionId)) return null;
  const base = { action: b.action as OutsideAction, sessionId: b.sessionId };
  if (b.action === 'panel_open') return base;
  if (b.action === 'filter') return typeof b.filter === 'string' && typeof b.value === 'string' && Object.hasOwn(filters,b.filter) && filters[b.filter].includes(b.value) ? { ...base, filter: b.filter, value: b.value } : null;
  return typeof b.eventId === 'string' && OUTSIDE_ID_RE.test(b.eventId) ? { ...base, eventId: b.eventId } : null;
}
