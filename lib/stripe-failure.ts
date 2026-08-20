export type StripeFailureCode =
  | 'account_charges_disabled'
  | 'authentication_failed'
  | 'provider_rate_limited'
  | 'provider_rejected'
  | 'provider_unavailable'
  | 'server_missing_key';

function payloadMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload as Record<string, unknown>;
  const nested = root.error && typeof root.error === 'object'
    ? root.error as Record<string, unknown>
    : root;
  return [nested.message, nested.code, nested.type]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function classifyStripeFailure(status: number, payload: unknown): StripeFailureCode {
  const message = payloadMessage(payload);
  if (message.includes('cannot currently make live charges') || message.includes('charges_disabled')) {
    return 'account_charges_disabled';
  }
  if (status === 401 || message.includes('invalid api key') || message.includes('authentication')) {
    return 'authentication_failed';
  }
  if (status === 429 || message.includes('rate_limit')) return 'provider_rate_limited';
  if (status >= 500 || status === 0) return 'provider_unavailable';
  return 'provider_rejected';
}
