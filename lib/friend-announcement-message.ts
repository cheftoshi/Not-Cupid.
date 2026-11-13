/**
 * One-time Friend product-announcement renderer. Pure: no provider calls,
 * audience selection, consent changes, scheduling or campaign activation.
 * Subject/body reflect supplied copy. Footer and exact URLs remain proposed
 * until separately reviewed; rendering is not content or send authorization.
 */
export const FRIEND_ANNOUNCEMENT_SUBJECT = 'Got plans this weekend?';
export const FRIEND_ANNOUNCEMENT_CTA = 'Find your next plan';
export const FRIEND_ANNOUNCEMENT_BODY = `Hey,

We’ve added something new to Friend: events happening around Boston, with a way to find people to go with.

There’s music, comedy, food, workshops and more. If something catches your eye, see whether there’s a plan to join or start one yourself.

Find your next plan

Take a look for this weekend. We’d love to know what you want to see more of.

NotCupid

Tickets and registration are separate from joining a NotCupid plan. Check the organizer’s listing before heading out.`;
export const FRIEND_ANNOUNCEMENT_PROPOSED_FOOTER = 'You’re receiving this product update because you’re part of NotCupid’s Friend Line.';
const address = 'NotCupid by Lemon Labs, 109 California Ave, Quincy, MA 02169.';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function notCupidUrl(value: string): URL {
  if (typeof value !== 'string' || value.length > 4000) throw new Error('A reviewed NotCupid HTTPS URL is required');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('A reviewed NotCupid HTTPS URL is required'); }
  if (url.protocol !== 'https:' || url.hostname !== 'notcupid.com' || url.port || url.username || url.password || url.hash) {
    throw new Error('A reviewed NotCupid HTTPS URL is required');
  }
  return url;
}

export function renderFriendAnnouncementMessage(input: {
  /** Explicit caller-reviewed CTA; no tracking link is silently substituted. */
  ctaUrl?: string;
  /** Caller supplies the existing global signed product-email opt-out link. */
  unsubscribeUrl: string;
}) {
  const ctaUrl = input.ctaUrl ?? 'https://notcupid.com/hub?discover=1';
  notCupidUrl(ctaUrl);
  const unsubscribe = notCupidUrl(input.unsubscribeUrl);
  // This is global product-email unsubscribe, NOT the new recurring event list.
  // Signature creation/verification stays with the existing global flow.
  if (unsubscribe.pathname !== '/unsubscribe' || !unsubscribe.searchParams.get('u') || !unsubscribe.searchParams.get('t')) {
    throw new Error('A global signed product-email unsubscribe URL is required');
  }
  const unsubscribePost = new URL(input.unsubscribeUrl);
  unsubscribePost.pathname = '/api/unsubscribe';
  const paragraphs = FRIEND_ANNOUNCEMENT_BODY.split('\n\n');
  const html = paragraphs.map(paragraph => paragraph === FRIEND_ANNOUNCEMENT_CTA
    ? `<p><a href="${escape(ctaUrl)}">${FRIEND_ANNOUNCEMENT_CTA}</a></p>`
    : `<p>${escape(paragraph)}</p>`).join('');
  return {
    from: 'NotCupid <match@notcupid.com>',
    replyTo: 'match@notcupid.com',
    subject: FRIEND_ANNOUNCEMENT_SUBJECT,
    text: `${FRIEND_ANNOUNCEMENT_BODY.replace(FRIEND_ANNOUNCEMENT_CTA, `${FRIEND_ANNOUNCEMENT_CTA}\n${ctaUrl}`)}\n\n${FRIEND_ANNOUNCEMENT_PROPOSED_FOOTER}\nUnsubscribe from product emails: ${input.unsubscribeUrl}\n${address}`,
    html: `${html}<hr><p>${escape(FRIEND_ANNOUNCEMENT_PROPOSED_FOOTER)}</p><p><a href="${escape(input.unsubscribeUrl)}">Unsubscribe from product emails</a></p><p>${escape(address)}</p>`,
    unsubscribeUrl: input.unsubscribeUrl,
    unsubscribePostUrl: unsubscribePost.toString(),
  };
}
