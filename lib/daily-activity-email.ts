import { createHash } from 'crypto';
import { button, C, escapeHtml, signUnsubToken } from '@/lib/email';
export {
  DAILY_ACTIVITY_EMAIL_HOUR_ET,
  DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES,
  dailyActivityEasternDay,
  isDailyActivitySendWindow,
} from '@/lib/daily-activity-cadence';

export const DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION = 'daily-activity-drop-v1-2026-08-17';
export const DAILY_ACTIVITY_EMAIL_SUBJECT = 'You have something waiting on NotCupid';

export type DailyActivitySection = 'love' | 'friend' | 'plans';

export type DailyActivityItem = {
  section: DailyActivitySection;
  kind: string;
  entityId: string;
  label: string;
  detail: string;
  url: string;
  occurredAt: string;
  count?: number;
  chatKind?: 'club' | 'circle';
  chatId?: string;
};

export function dailyActivityEmailActivation() {
  const requested = process.env.DAILY_ACTIVITY_EMAILS_ENABLED === 'true';
  const approvedVersion = process.env.DAILY_ACTIVITY_EMAIL_TEMPLATE_VERSION || '';
  return {
    enabled: requested && approvedVersion === DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION,
    requested,
    approvedVersion,
    requiredVersion: DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION,
  };
}

export function dailyActivityContentKey(items: DailyActivityItem[]): string {
  const stable = items
    .map((item) => `${item.kind}:${item.entityId}:${item.occurredAt}:${item.count || 1}`)
    .sort()
    .join('|');
  return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}

export function dailyActivityCounts(items: DailyActivityItem[]) {
  return {
    love: items.filter((item) => item.section === 'love').length,
    friend: items.filter((item) => item.section === 'friend').length,
    plans: items.filter((item) => item.section === 'plans').length,
  };
}

function preheader(items: DailyActivityItem[]) {
  const counts = dailyActivityCounts(items);
  const parts = [
    counts.love ? `${counts.love} Love update${counts.love === 1 ? '' : 's'}` : '',
    counts.friend ? `${counts.friend} Friend update${counts.friend === 1 ? '' : 's'}` : '',
    counts.plans ? `${counts.plans} new plan${counts.plans === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return `${parts.join(', ')} waiting for you.`;
}

function itemRow(item: DailyActivityItem) {
  return `<tr><td style="padding:13px 0;border-bottom:1px solid ${C.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <a href="${escapeHtml(item.url)}" style="display:block;color:${C.ink};text-decoration:none;font-size:15px;font-weight:650;line-height:1.35;">${escapeHtml(item.label)}</a>
    <div style="margin-top:4px;color:${C.muted};font-size:13px;line-height:1.45;">${escapeHtml(item.detail)}</div>
  </td></tr>`;
}

function section(title: string, items: DailyActivityItem[]) {
  if (!items.length) return '';
  return `<div style="margin:22px 0 0;font-family:'DM Mono','SF Mono',monospace;font-size:10px;letter-spacing:0.17em;text-transform:uppercase;color:${C.lav};">${escapeHtml(title)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${items.map(itemRow).join('')}</table>`;
}

export function dailyActivityEmailHtml(input: {
  userId: string;
  firstName: string;
  items: DailyActivityItem[];
  baseUrl: string;
  mailingAddress: string;
}) {
  const first = escapeHtml(input.firstName || 'there');
  const love = input.items.filter((item) => item.section === 'love');
  const friend = input.items.filter((item) => item.section === 'friend');
  const plans = input.items.filter((item) => item.section === 'plans');
  const unsubscribe = `${input.baseUrl}/unsubscribe?u=${encodeURIComponent(input.userId)}&t=${signUnsubToken(input.userId)}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(DAILY_ACTIVITY_EMAIL_SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.paper};opacity:0;">${escapeHtml(preheader(input.items))}${'‌ '.repeat(50)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};"><tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border:1px solid ${C.border};border-radius:14px;">
      <tr><td style="padding:30px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:25px;font-weight:700;"><span style="color:#2563ff;">Not</span><span style="color:#ff6a1f;">Cupid</span></td></tr>
      <tr><td style="padding:18px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.muted};">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">Hi ${first},</p>
        <p style="margin:0;color:${C.ink};font-size:22px;line-height:1.25;font-family:Georgia,'Times New Roman',serif;">Here’s what’s waiting for you.</p>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.55;">A quick daily drop of activity you haven’t opened yet.</p>
        ${section('Love Line', love)}
        ${section('Friend Hub', friend)}
        ${section('Plans near you', plans)}
        <div style="margin-top:24px;">${button({ href: `${input.baseUrl}/hub?from=daily-activity-drop`, label: 'OPEN NOTCUPID →' })}</div>
        <p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:${C.muted};">Sent at most once a day—and only when there’s something new or unread.</p>
      </td></tr>
    </table>
    <div style="max-width:560px;margin-top:12px;font-family:'DM Mono','SF Mono',monospace;font-size:9px;line-height:1.55;color:${C.muted};text-align:center;">
      NotCupid · operated by Lemon Labs · ${escapeHtml(input.mailingAddress)} · <a href="${escapeHtml(unsubscribe)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>
    </div>
  </td></tr></table>
</body></html>`;
}
