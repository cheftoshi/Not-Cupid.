import { button, escapeHtml, renderEmail } from './email.ts';
import { signWinnerConfirmation } from './dating-experiment-winner-confirmation.ts';

export const WINNER_DAY_OF_CAMPAIGN = 'dating_experiment_boston_v1_day_of_confirmation';
export const WINNER_DAY_OF_APPROVAL = 'winner-day-of-confirmation-v1-2026-08-20:2';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

function firstName(value: string | null | undefined): string {
  return String(value || 'there').trim().split(/\s+/)[0] || 'there';
}

export function winnerDayOfEmail(input: {
  drawId: string;
  userId: string;
  userName: string | null;
  partnerName: string | null;
  mailingAddress: string;
}) {
  const token = signWinnerConfirmation({ drawId: input.drawId, userId: input.userId });
  const base = `${SITE_URL}/api/raffle/winner-confirm?draw=${encodeURIComponent(input.drawId)}&user=${encodeURIComponent(input.userId)}&token=${encodeURIComponent(token)}`;
  const stillInUrl = `${base}&intent=still_in`;
  const cannotMakeItUrl = `${base}&intent=cant_make_it`;
  return {
    subject: 'Quick check for tonight ✦',
    html: renderEmail({
      preheader: 'Please confirm your 6:30 PM dinner by noon.',
      eyebrow: 'Dating Experiment',
      headline: 'Quick check for tonight.',
      mailingAddress: input.mailingAddress,
      footerNote: 'NotCupid is operated by Lemon Labs.',
      bodyHtml: `<p style="margin:0 0 18px 0;">Hi ${escapeHtml(firstName(input.userName))},</p>
        <p style="margin:0 0 18px 0;">Are you still able to meet ${escapeHtml(firstName(input.partnerName))} at The Berkeley tonight at 6:30 PM?</p>
        <p style="margin:0 0 20px 0;">Please confirm by noon so we can make sure neither of you is left waiting.</p>
        ${button({ href: stillInUrl, label: "YES, I'M STILL IN →" })}
        <div style="height:10px;"></div>
        ${button({ href: cannotMakeItUrl, label: "I CAN'T MAKE IT", variant: 'secondary' })}
        <p style="margin:20px 0 0 0;">Your reservation is already prepaid by NotCupid for up to $200. When you arrive, tell the host that the reservation is under <strong>NotCupid App</strong>.</p>
        <p style="margin:18px 0 0 0;">If you need help, reply directly to this email.</p>`,
    }),
  };
}
