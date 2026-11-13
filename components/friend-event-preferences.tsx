'use client';
import { useEffect, useState } from 'react';

export default function FriendEventPreferences() {
  const [value, setValue] = useState<{ email_enabled: boolean; push_enabled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/friend-event-preferences').then(async res => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (active) setValue(data);
    }).catch(() => { if (active) setMessage('Friend event preferences are temporarily unavailable. Nothing has changed.'); });
    return () => { active = false; };
  }, []);
  async function save(channel: 'email' | 'push', enabled: boolean) {
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/friend-event-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, enabled, version: 'friend-events-v1' }) });
      if (!res.ok) throw new Error();
      setValue(current => current ? { ...current, [`${channel}_enabled`]: enabled } : current);
      setMessage('Friend event preference saved.');
    } catch { setMessage('Could not confirm the save. Reload to check your preference before trying again.'); }
    finally { setBusy(false); }
  }
  return <fieldset style={{ marginTop: '1rem', padding: '1rem' }} disabled={busy || !value}>
    <legend>Optional Friend event discovery</legend>
    <p>Get local events and ideas for plans, at most once a week per channel. Off unless you choose it. Changes here save immediately.</p>
    <label style={{ display: 'block', margin: '0.5rem 0' }}><input type="checkbox" checked={value?.email_enabled === true} onChange={e => save('email', e.target.checked)} /> Email me Friend event ideas</label>
    <label style={{ display: 'block', margin: '0.5rem 0' }}><input type="checkbox" checked={value?.push_enabled === true} onChange={e => save('push', e.target.checked)} /> Send me Friend event push alerts</label>
    <p>Push also needs an existing device subscription. This does not enable device permissions or change match/message alerts. Turning all email off above also suppresses event emails.</p>
    <p role="status">{message || (!value ? 'Loading preferences…' : '')}</p>
  </fieldset>;
}
