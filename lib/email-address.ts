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
