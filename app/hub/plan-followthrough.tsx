'use client';
import { useState } from 'react';
import { type ConnectionPlan, planChatAllowed } from '@/lib/connection-plans';

export default function PlanFollowthrough({ plan }: { plan: ConnectionPlan }) {
  const [met, setMet] = useState<boolean | null>(null);
  const [again, setAgain] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  if (!planChatAllowed(plan) || !plan.happens_at || Date.parse(plan.happens_at) > Date.now()
    || plan.state === 'cancelled' || (plan.expires_at && Date.parse(plan.expires_at) < Date.parse(plan.happens_at))) return null;
  async function save() {
    if (busy || met == null) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/plans/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, kind: plan.connectionKind === 'date' ? 'date' : 'friend', met, meetAgain: again }) });
      if (!response.ok) throw Error();
      setStatus('Saved privately. Thanks for letting us know.');
    } catch { setStatus('Not saved. Please try again.'); }
    finally { setBusy(false); }
  }
  return <details><summary>How did it go? · optional</summary>
    <p>Private feedback. Nothing is sent to the other participants.</p>
    <fieldset><legend>Did you meet?</legend>{[true, false].map(v => <button key={String(v)} type="button" aria-pressed={met === v} onClick={() => setMet(v)}>{v ? 'Yes' : 'No'}</button>)}</fieldset>
    {met && <fieldset><legend>Would you meet again?</legend>{[true, false].map(v => <button key={String(v)} type="button" aria-pressed={again === v} onClick={() => setAgain(v)}>{v ? 'Yes' : 'No'}</button>)}</fieldset>}
    <button disabled={busy || met == null} onClick={() => void save()}>{busy ? 'Saving…' : 'Save feedback'}</button>
    {status && <p role="status">{status}</p>}
  </details>;
}
