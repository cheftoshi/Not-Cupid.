import { C, escapeHtml, renderEmail } from './email';

/** Render only; payment validation and delivery remain in the webhook. */
export function personalityResultsEmail(user: {
  name?: string | null; archetype?: string | null;
  score_honesty: number; score_emotionality: number; score_extraversion: number;
  score_agreeableness: number; score_conscientiousness: number; score_openness: number;
}) {
  const dims = [
    ['Honesty-Humility', user.score_honesty], ['Emotionality', user.score_emotionality],
    ['Extraversion', user.score_extraversion], ['Agreeableness', user.score_agreeableness],
    ['Conscientiousness', user.score_conscientiousness], ['Openness', user.score_openness],
  ] as const;
  const rows = dims.map(([name, value]) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.border};">${escapeHtml(name)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid ${C.border};color:${C.ink};font-weight:700;">${escapeHtml(Math.round((value / 12) * 100))}%</td></tr>`).join('');
  return renderEmail({
    preheader: 'Your personality results are ready to explore.',
    eyebrow: 'Your personality results',
    headline: user.archetype || 'A little more about you.',
    bodyHtml: `<p style="margin:0 0 18px;">Hi ${escapeHtml(user.name || 'there')}, here’s your HEXACO breakdown from your questionnaire answers.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">${rows}</table><p style="margin:18px 0 0;">These six dimensions are one part of your profile. They don’t define you or guarantee chemistry. You choose who you’d like to get to know.</p>`,
    footerNote: 'More self-understanding. Room for real connection.',
  });
}
