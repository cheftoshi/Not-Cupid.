import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/admin';
import { METRO_CENTERS } from '@/lib/quiz-data';
import { cityEvents } from '@/lib/city-events-server';
import { fridayRoundup } from '@/lib/friday-digest';

export const dynamic = 'force-dynamic';
export default async function FridayDigest({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  if (!await getCurrentAdmin()) redirect('/login?next=%2Fadmin%2Ffriday-digest');
  const params = await searchParams;
  const metro = params.city && Object.hasOwn(METRO_CENTERS, params.city) ? params.city : 'boston';
  const catalog = await cityEvents(metro);
  const preview = fridayRoundup(METRO_CENTERS[metro].label, catalog.events);
  return <main style={{ maxWidth: 760, margin: 'auto', padding: 24 }}>
    <Link href="/admin">← Admin</Link><h1>Friday city roundup</h1>
    <p>Draft only. No sends, scheduled job, or enrolled recipients. Proposed: Friday at 1 PM Eastern.</p>
    <form><label>Preview city <select name="city" defaultValue={metro}>
      {Object.entries(METRO_CENTERS).map(([key, city]) => <option key={key} value={key}>{city.label}</option>)}
    </select></label><button type="submit">Preview</button></form>
    <p>Provider: {catalog.status}. Subject: {preview.subject}</p>
    <p>Sender: {preview.sender}. Reply-to: {preview.replyTo}.</p>
    <p>This is a live city-content preview, not a personalized recipient preview. Member invitations and private updates are not included yet. Consent, signed unsubscribe, recipient count, duplicate suppression and exact send approval are required before activation. Provider email-reuse permissions also need review.</p>
    {preview.wouldSkip ? <p>No eligible events in the next seven days. This roundup would be skipped.</p>
      : <iframe title="Friday digest draft" sandbox="" srcDoc={preview.html} style={{ width: '100%', minHeight: 850, border: '1px solid #ddd', background: '#fff' }} />}
  </main>;
}
