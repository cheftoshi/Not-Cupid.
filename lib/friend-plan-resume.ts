import { isReturningUserWelcome } from './returning-user.ts';

// An intent hint, not an authorization grant. Every plan read or RSVP still
// uses the existing server-side account, visibility and participation checks.
type FriendPlanSelection = { id: string; from?: 'daily-activity-drop' };

export function friendPlanSelection(id: unknown, from?: unknown): FriendPlanSelection | null {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  if (from != null && from !== 'daily-activity-drop') return null;
  return from === 'daily-activity-drop' ? { id: id.toLowerCase(), from } : { id: id.toLowerCase() };
}

export function friendPlanFromDestination(path: string | null): FriendPlanSelection | null {
  if (!path?.startsWith('/friends?') || path.includes('#')) return null;
  const q = new URLSearchParams(path.slice('/friends?'.length));
  const keys = [...q.keys()];
  if (q.get('view') !== 'scene' || new Set(keys).size !== keys.length ||
      keys.some(key => !['view', 'plan', 'from', 'welcome'].includes(key)) ||
      (q.has('welcome') && !isReturningUserWelcome(q.get('welcome')))) return null;
  return friendPlanSelection(q.get('plan'), q.get('from'));
}

export function friendPlanFromQuiz(q: Pick<URLSearchParams, 'getAll'>): FriendPlanSelection | null {
  const ids = q.getAll('friendPlan'), sources = q.getAll('from');
  return ids.length === 1 && sources.length <= 1 ? friendPlanSelection(ids[0], sources[0]) : null;
}

export function friendPlanDestination(plan: FriendPlanSelection): string {
  return '/friends?view=scene&plan=' + plan.id + (plan.from ? '&from=' + plan.from : '');
}

export function friendPlanLogin(plan: FriendPlanSelection): string {
  return '/login?next=' + encodeURIComponent(friendPlanDestination(plan));
}

export function friendPlanCoreQuiz(plan: FriendPlanSelection, options: { retake?: boolean; love?: boolean } = {}): string {
  return '/quiz?next=friends&friendPlan=' + plan.id + (plan.from ? '&from=' + plan.from : '') +
    (options.retake ? '&retake=1' : '') + (options.love ? '&line=love' : '');
}

export function friendPlanSetup(plan: FriendPlanSelection): string {
  return '/friends/quiz?friendPlan=' + plan.id + (plan.from ? '&from=' + plan.from : '');
}
