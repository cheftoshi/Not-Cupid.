// Preview only. There is intentionally no sender, recipient loop, or cron.
import { escapeHtml } from '@/lib/email';
import { eventInWindow, eventPrice, ticketmasterUrl, type CityEvent } from '@/lib/city-events';
import { planWhen } from '@/lib/plan-discovery';

export const FRIDAY_DIGEST_VERSION = 'friday-city-roundup-draft-v1';
export function fridayRoundup(city: string, events: CityEvent[], now = Date.now()) {
  const selected = [...new Map(events.filter(e => ticketmasterUrl(e.url) && eventInWindow(e, 'week', now))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).map(e => [e.id, e])).values()].slice(0, 3);
  const html = `<div style="max-width:580px;margin:auto;padding:24px;background:#faf9f6;color:#0b0b0b;font:16px/1.6 Arial,sans-serif">
    <p style="color:#2563ff">NotCupid · ${escapeHtml(city)}</p>
    <h1 style="font:28px Georgia,serif">A few ideas for your weekend</h1>
    <p>Looking for something to do? Pick an event and find people to go with.</p>
    ${selected.map(e => `<div style="border-top:1px solid #ddd;padding:16px 0"><strong>${escapeHtml(e.title)}</strong>
      <p>${escapeHtml(planWhen(e.startsAt))}<br>${escapeHtml(e.venue)} · ${escapeHtml(eventPrice(e))}</p>
      <a href="https://notcupid.com/hub?discover=1&amp;event=${encodeURIComponent(e.id)}&amp;from=friday-digest">Find people to go with</a>
      <br><small>Outside event · <a href="${escapeHtml(e.url)}">Details & tickets on Ticketmaster</a></small></div>`).join('')}
    <p>Have your own idea? <a href="https://notcupid.com/hub?create=1&amp;from=friday-digest">Post a plan</a>.</p>
    <p style="font-size:12px">Joining a plan does not include admission. Confirm availability and restrictions with the provider.</p>
    <hr><small>NotCupid, operated by Lemon Labs<br>109 California Ave, Quincy, MA 02169<br>
    Preview only. A signed unsubscribe and preferences link must be added before send approval.</small></div>`;
  return { version: FRIDAY_DIGEST_VERSION, enabled: false, sendReady: false,
    sender: 'NotCupid <match@notcupid.com>', replyTo: 'match@notcupid.com', subject: `Your weekend in ${city}`,
    scheduleProposal: 'Friday at 1:00 PM America/New_York', authorizedRecipients: 0,
    wouldSkip: selected.length === 0, events: selected, html };
}
