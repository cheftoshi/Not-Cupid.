// Fail-closed preflight for the future sender. Pass the verified Resend SDK's
// suppressions.get operation. Never infer "clear" from a timeout or empty data,
// and never use this to remove an existing local suppression.
export async function checkFriendEventSuppression(
  email: string,
  lookup: (email: string) => Promise<{ data: { email: string; origin: string } | null; error: { name: string; statusCode?: number | null } | null }>,
): Promise<'clear' | 'bounce' | 'complaint' | 'provider_suppressed' | 'unknown'> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'unknown';
  try {
    const { data, error } = await lookup(normalized);
    if (error) return error.name === 'not_found' && error.statusCode === 404 ? 'clear' : 'unknown';
    if (!data || data.email.toLowerCase() !== normalized) return 'unknown';
    return data.origin === 'complaint' ? 'complaint' : data.origin === 'bounce' ? 'bounce' : 'provider_suppressed';
  } catch { return 'unknown'; }
}
