export const RETURNING_USER_WELCOME = 'love-refresh-2026-08';
export const RETURNING_USER_STORAGE_KEY = 'nc:returning:love-refresh-2026-08';

// Add the welcome-back trigger to an internal destination without dropping
// existing query parameters (admin returns, Friend routes, campaign context).
export function withReturningUserWelcome(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/hub';
  const url = new URL(path, 'https://notcupid.local');
  url.searchParams.set('welcome', RETURNING_USER_WELCOME);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isReturningUserWelcome(value: string | null | undefined): boolean {
  return value === RETURNING_USER_WELCOME;
}
