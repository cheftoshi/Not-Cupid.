// Frozen pre-refresh renderer for historical, separately approved templates.
// Do not restyle or reuse these campaigns without their own approval.
// Centralized email rendering + sending.
//
// One shared layout for every NotCupid email so they all look on-brand
// instead of every route inlining its own slightly-different HTML.
//
// Rendering choices that matter for email (not normal HTML):
//   - Table-based layout, not flex/grid (Outlook still doesn't render flex)
//   - Inline styles only (Gmail strips <style> blocks in many cases)
//   - Preheader: a hidden 100ch line that becomes the inbox preview text
//   - 600px max width centered on a colored background
//   - System font stack as primary, with Bebas/DM Mono callouts where they
//     render (most clients fall back to system, which is fine)
//   - Buttons rendered as <a> with padding (bulletproof button pattern)

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { defaultEmailReplyTo } from './email-address.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'NotCupid <match@notcupid.com>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

// ─── Brand tokens (kept here so design tweaks live in one file) ──────────
// Brand Kit v1 palette. `lav*` keys kept as names (used throughout the
// templates) but now hold brand blue so every email shifts in one place.
export const C = {
  ink:        '#0b0b0b', // primary text / buttons
  paper:      '#f6f6f6', // page background
  card:       '#ffffff',
  lav:        '#2563ff', // brand blue — accent
  lavSoft:    '#e8edff', // accent fill
  lavDeep:    '#1b46c9',
  muted:      '#6b6b76',
  mutedSoft:  '#cbcbd4',
  border:     'rgba(11,11,11,0.08)',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeEmailSubject(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

// ─── Unsubscribe link signing (HMAC; same shape as match-tokens) ─────────
function getUnsubSecret(): string {
  const s = process.env.MATCH_LINK_SECRET;
  if (!s || s.length < 16) {
    throw new Error('MATCH_LINK_SECRET is not set or too short (need >= 16 chars)');
  }
  return s;
}

export function signUnsubToken(userId: string, expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000): string {
  const exp = Math.floor(expiresAt).toString(36);
  const mac = createHmac('sha256', getUnsubSecret()).update(`unsub.${userId}.${exp}`).digest();
  const signature = mac.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${exp}.${signature}`;
}

export function verifyUnsubToken(userId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [exp, signature, extra] = token.split('.');
  const expiresAt = Number.parseInt(exp, 36);
  if (!exp || !signature || extra || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const mac = createHmac('sha256', getUnsubSecret()).update(`unsub.${userId}.${exp}`).digest();
  const expected = mac.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

// ─── Reusable email components ───────────────────────────────────────────

/**
 * Bulletproof CTA button. Renders as `<a>` with padding so it looks like a
 * button across every email client (including Outlook desktop where <button>
 * elements get sanitized).
 */
export function button(opts: { href: string; label: string; variant?: 'primary' | 'secondary' }): string {
  const isPrimary = (opts.variant ?? 'primary') === 'primary';
  const bg = isPrimary ? C.ink : 'transparent';
  const color = isPrimary ? C.paper : C.muted;
  const border = isPrimary ? `1px solid ${C.ink}` : `1px solid ${C.mutedSoft}`;
  return `<a href="${escapeHtml(opts.href)}" style="display:inline-block;background:${bg};color:${color};border:${border};padding:14px 26px;font-family:'DM Mono','SF Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;font-weight:600;border-radius:0;mso-padding-alt:0;">${escapeHtml(opts.label)}</a>`;
}

/** Soft lavender info card — used for OTP codes, compatibility scores, etc. */
export function infoCard(opts: { eyebrow?: string; big: string; sub?: string }): string {
  const eyebrow = opts.eyebrow
    ? `<div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.16em;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(opts.eyebrow)}</div>`
    : '';
  const sub = opts.sub
    ? `<div style="font-family:'DM Mono','SF Mono',monospace;font-size:11px;color:${C.muted};margin-top:8px;">${escapeHtml(opts.sub)}</div>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.lavSoft};border-radius:10px;margin:16px 0;"><tr><td style="padding:22px 24px;">${eyebrow}<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:${C.ink};line-height:1.1;letter-spacing:-0.01em;">${escapeHtml(opts.big)}</div>${sub}</td></tr></table>`;
}

// ─── Main render function ────────────────────────────────────────────────

interface RenderArgs {
  preheader: string;          // inbox preview text — first ~100 chars
  eyebrow?: string;           // small uppercase label above headline
  headline?: string;          // optional serif display headline
  bodyHtml: string;           // pre-built HTML for the body (paragraphs, cards, buttons)
  recipientId?: string;       // if provided, footer includes unsub link
  footerNote?: string;        // short line above the boilerplate footer
  mailingAddress?: string;    // full postal address for promotional campaigns
}

export function renderEmail(args: RenderArgs): string {
  const unsubLink = args.recipientId
    ? `${SITE_URL}/unsubscribe?u=${encodeURIComponent(args.recipientId)}&t=${signUnsubToken(args.recipientId)}`
    : null;

  const unsubBlock = unsubLink
    ? `<div style="margin-top:18px;font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.mutedSoft};letter-spacing:0.1em;">Don't want these emails? <a href="${unsubLink}" style="color:${C.lav};text-decoration:underline;">unsubscribe</a>. Your matching and push notification settings stay unchanged.</div>`
    : '';

  const eyebrowBlock = args.eyebrow
    ? `<div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.2em;text-transform:uppercase;margin-bottom:14px;">${escapeHtml(args.eyebrow)}</div>`
    : '';

  const introBlock = args.eyebrow || args.headline
    ? `<tr>
          <td style="padding:24px 36px 8px 36px;">
            ${eyebrowBlock}
            ${args.headline ? `<h1 style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;color:${C.ink};font-weight:400;letter-spacing:-0.01em;">${escapeHtml(args.headline)}</h1>` : ''}
          </td>
        </tr>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>NotCupid</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- preheader: hidden inbox preview text, padded with zero-width spaces -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.paper};opacity:0;">
  ${escapeHtml(args.preheader)}${'‌ '.repeat(60)}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:14px;">
        <tr>
          <td style="padding:36px 36px 8px 36px;">
            <!-- brand lockup — Not=blue, Cupid=orange, italic serif (matches socials) -->
            <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;font-weight:700;letter-spacing:-0.01em;">
              <span style="color:#2563ff;">Not</span><span style="color:#ff6a1f;">Cupid</span>
            </div>
          </td>
        </tr>
        ${introBlock}
        <tr>
          <td style="padding:0 36px 24px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${C.muted};">
            ${args.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px 36px;">
            <div style="border-top:1px solid ${C.border};padding-top:18px;font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.mutedSoft};letter-spacing:0.12em;text-transform:uppercase;">
              ${args.footerNote ? `<div style="margin-bottom:8px;color:${C.muted};text-transform:none;letter-spacing:0;font-family:Georgia,serif;font-style:italic;font-size:12px;">${escapeHtml(args.footerNote)}</div>` : ''}
              <div style="margin-bottom:8px;color:${C.muted};text-transform:none;letter-spacing:0;font-family:Georgia,serif;font-style:italic;font-size:12px;">add <strong>match@notcupid.com</strong> to your contacts so matches land in your inbox — not Promotions or spam.</div>
              Boston · notcupid.com · the algo decided
              <div style="margin-top:10px;">
                <a href="https://instagram.com/notcupidapp" style="color:${C.lav};text-decoration:none;letter-spacing:0.12em;">instagram</a>
                &nbsp;·&nbsp;
                <a href="https://tiktok.com/@notcupid11" style="color:${C.lav};text-decoration:none;letter-spacing:0.12em;">tiktok</a>
                &nbsp;·&nbsp;
                <a href="https://x.com/notcupidapp" style="color:${C.lav};text-decoration:none;letter-spacing:0.12em;">x</a>
              </div>
              ${unsubBlock}
            </div>
          </td>
        </tr>
      </table>

      <!-- legal / address (CAN-SPAM) -->
      <div style="max-width:600px;margin-top:14px;font-family:'DM Mono','SF Mono',monospace;font-size:9px;color:${C.mutedSoft};letter-spacing:0.1em;text-align:center;line-height:1.6;">
        NotCupid · ${escapeHtml(args.mailingAddress || 'Boston, MA')} · You're receiving this because you signed up at notcupid.com.
      </div>

    </td>
  </tr>
</table>

</body>
</html>`;
}

// Delivery remains centralized and unchanged.
export { sendEmail } from './email.ts';
