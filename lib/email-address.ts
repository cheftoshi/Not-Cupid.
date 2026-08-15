export const SUPPORT_EMAIL = 'match@notcupid.com';

const EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

/**
 * Extract a single safe mailbox from either `person@example.com` or
 * `Person <person@example.com>`. Header control characters are always rejected.
 */
export function extractEmailAddress(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || /[\r\n\0]/.test(raw)) return null;
  const bracketed = raw.match(/<([^<>]+)>\s*$/)?.[1]?.trim();
  const candidate = (bracketed || raw).toLowerCase();
  return EMAIL_RE.test(candidate) ? candidate : null;
}

export function configuredInboundForwardTo(): string | null {
  return extractEmailAddress(process.env.INBOUND_FORWARD_TO);
}

export function defaultEmailReplyTo(): string {
  return configuredInboundForwardTo() || SUPPORT_EMAIL;
}

// Marketing email needs a real postal address, not a city/state placeholder or
// an email address. This is deliberately a conservative US-format launch gate;
// it does not claim to validate deliverability.
export function looksLikePublicPostalAddress(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  if (raw.length < 20 || raw.length > 300 || /[\0]/.test(raw)) return false;
  const normalized = raw.replace(/\s+/g, ' ');
  const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(normalized);
  const hasDeliveryPoint = /\bP\.?\s*O\.?\s+Box\s+\d+\b/i.test(normalized)
    || /\b\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9.'-]*/.test(normalized);
  return hasZip && hasDeliveryPoint;
}
