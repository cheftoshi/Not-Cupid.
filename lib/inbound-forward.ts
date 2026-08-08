import { escapeHtml, sanitizeEmailSubject } from './email.ts';
import { extractEmailAddress, SUPPORT_EMAIL } from './email-address.ts';

interface InboundForwardInput {
  from: string;
  to: string[];
  receivedFor?: string[];
  replyTo?: string[] | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  attachmentNote?: string;
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((line) => line.trim()).join('\n')
    .trim();
}

export function isMatchInboxRecipient(to: string[], receivedFor: string[] = []): boolean {
  return [...to, ...receivedFor]
    .map(extractEmailAddress)
    .some((address) => address === SUPPORT_EMAIL);
}

export function buildInboundForward(input: InboundForwardInput) {
  const fromAddress = extractEmailAddress(input.from);
  const replyTo = [...(input.replyTo || []), input.from]
    .map(extractEmailAddress)
    .find((address) => address && address !== SUPPORT_EMAIL) || null;
  const originalSubject = sanitizeEmailSubject(input.subject || '(no subject)') || '(no subject)';
  const subject = sanitizeEmailSubject(originalSubject.startsWith('Fwd:') ? originalSubject : `Fwd: ${originalSubject}`);
  const body = String(input.text || (input.html ? plainTextFromHtml(input.html) : '')).slice(0, 100_000);
  const deliveredTo = input.to.join(', ').slice(0, 2_000);
  const attachmentNote = input.attachmentNote?.trim() || '';

  const text = [
    'Forwarded from the NotCupid inbox',
    `From: ${input.from}`,
    `To: ${deliveredTo}`,
    `Subject: ${originalSubject}`,
    '',
    body || '(empty message)',
    ...(attachmentNote ? ['', attachmentNote] : []),
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;color:#0b0b0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2563ff;margin-bottom:18px;">NotCupid inbox</div>
      <div style="font-size:14px;line-height:1.6;color:#555;margin-bottom:22px;">
        <strong style="color:#111;">From:</strong> ${escapeHtml(input.from)}<br>
        <strong style="color:#111;">To:</strong> ${escapeHtml(deliveredTo)}<br>
        <strong style="color:#111;">Subject:</strong> ${escapeHtml(originalSubject)}
      </div>
      <div style="white-space:pre-wrap;font-size:15px;line-height:1.65;">${escapeHtml(body || '(empty message)')}</div>
      ${attachmentNote ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#777;">${escapeHtml(attachmentNote)}</div>` : ''}
    </div>
  </body></html>`;

  return { subject, text, html, replyTo, fromAddress };
}
