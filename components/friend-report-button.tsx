'use client';

import { useState } from 'react';

export default function FriendReportButton({ reportedId, contextId, contextType, onReported }: {
  reportedId: string; contextId: string; contextType: 'dm' | 'circle' | 'club' | 'plan'; onReported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('made_me_uncomfortable');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  async function report() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/friend/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedId, contextId, contextType, reason, detail }),
      });
      if (!response.ok) throw new Error('Could not save your report. Please retry.');
      setDone(true); setMessage('Reported and disconnected.'); onReported?.();
    } catch { setMessage('Could not save your report. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div style={{ fontSize: 12, marginTop: 6 }}>
    {!done && <button type="button" onClick={() => setOpen(!open)} style={{ minHeight: 44 }}>Report person</button>}
    {open && !done && <div role="group" aria-label="Report person" style={{ display: 'grid', gap: 8 }}>
      <p>This disconnects you and hides each other’s messages. They will not be notified of your report.</p>
      <select aria-label="Report reason" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="made_me_uncomfortable">Made me uncomfortable</option>
        <option value="harassment">Harassment</option>
        <option value="inappropriate_messages">Inappropriate messages</option>
        <option value="fake_profile">Fake profile</option>
        <option value="offensive_photos">Offensive photos</option>
        <option value="other">Other</option>
      </select>
      <textarea aria-label="Optional report details" maxLength={2000} value={detail} onChange={e => setDetail(e.target.value)} />
      <button type="button" disabled={busy} onClick={() => void report()}>{busy ? 'Saving…' : 'Report and disconnect'}</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </div>;
}
