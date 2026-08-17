import { createHmac, timingSafeEqual } from 'crypto';
import { button, C, escapeHtml, signUnsubToken } from '@/lib/email';

export const ELIGIBLE_READY_REMINDER_CAMPAIGN = 'dating_experiment_ready_reminder_aug17_2026';
export const ELIGIBLE_READY_REMINDER_APPROVAL_VERSION = 'dating-experiment-ready-reminder-v1-2026-08-17';
export const ELIGIBLE_READY_REMINDER_SUBJECT = 'Your profile is ready';
export const ELIGIBLE_READY_REMINDER_PREHEADER = 'Want to join our Boston Dating Experiment?';
export const ELIGIBLE_READY_REMINDER_DESTINATION = '/dating-experiment?from=eligible-ready-reminder-aug17';

function secret(): string {
  const value = process.env.MATCH_LINK_SECRET;
  if (!value || value.length < 16) throw new Error('MATCH_LINK_SECRET is not set or too short');
  return value;
}

function signature(userId: string, expiresAt: number): string {
  return createHmac('sha256', secret())
    .update(`${ELIGIBLE_READY_REMINDER_CAMPAIGN}.${userId}.${expiresAt}`)
    .digest('base64url');
}

export function eligibleReadyReminderToken(userId: string, expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000): string {
  const encodedExpiry = Math.floor(expiresAt).toString(36);
  return `${encodedExpiry}.${signature(userId, expiresAt)}`;
}

export function verifyEligibleReadyReminderToken(userId: string, token: string | null): boolean {
  if (!token) return false;
  const [encodedExpiry, supplied, extra] = token.split('.');
  const expiresAt = Number.parseInt(encodedExpiry, 36);
  if (!encodedExpiry || !supplied || extra || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signature(userId, expiresAt);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function eligibleReadyReminderUrl(baseUrl: string, userId: string): string {
  const params = new URLSearchParams({ u: userId, t: eligibleReadyReminderToken(userId) });
  return `${baseUrl}/api/campaign/eligible-ready-reminder?${params.toString()}`;
}

export function eligibleReadyReminderHtml(input: {
  userId: string;
  firstName: string;
  baseUrl: string;
  mailingAddress: string;
  tracked?: boolean;
}): string {
  const first = escapeHtml(input.firstName || 'there');
  const ctaUrl = input.tracked === false
    ? `${input.baseUrl}${ELIGIBLE_READY_REMINDER_DESTINATION}`
    : eligibleReadyReminderUrl(input.baseUrl, input.userId);
  const unsubscribeUrl = `${input.baseUrl}/unsubscribe?u=${encodeURIComponent(input.userId)}&t=${signUnsubToken(input.userId)}`;

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(ELIGIBLE_READY_REMINDER_SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.paper};opacity:0;">${escapeHtml(ELIGIBLE_READY_REMINDER_PREHEADER)}${'‌ '.repeat(50)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};">
    <tr><td align="center" style="padding:28px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border:1px solid ${C.border};border-radius:14px;">
        <tr><td style="padding:30px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:25px;font-weight:700;"><span style="color:#2563ff;">Not</span><span style="color:#ff6a1f;">Cupid</span></td></tr>
        <tr><td style="padding:18px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${C.muted};">
          <p style="margin:0 0 15px;">Hi ${first},</p>
          <p style="margin:0 0 15px;color:${C.ink};font-size:20px;font-family:Georgia,'Times New Roman',serif;">Your NotCupid profile is ready.</p>
          <p style="margin:0 0 19px;">We’re running a small Boston Dating Experiment and wanted to invite you to participate—if you choose.</p>
          <div style="margin:0 0 18px;">${button({ href: ctaUrl, label: 'JOIN THE EXPERIMENT →' })}</div>
          <p style="margin:0;font-size:11px;line-height:1.5;color:${C.muted};">No purchase necessary. Entry, matching, and dinner selection aren’t guaranteed.</p>
        </td></tr>
      </table>
      <div style="max-width:560px;margin-top:12px;font-family:'DM Mono','SF Mono',monospace;font-size:9px;line-height:1.55;color:${C.mutedSoft};text-align:center;">
        NotCupid · operated by Lemon Labs · ${escapeHtml(input.mailingAddress)} · <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}
