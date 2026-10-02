'use client';
import { useEffect, useState } from 'react';

export default function AdminAccountCleanup() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/account-cleanup').then(async response => {
      if (!response.ok) throw Error('unavailable');
      const data = await response.json();
      if (active) setCounts(data.counts);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <section aria-label="Account deletion cleanup" style={{padding:'1rem',marginBottom:'1rem',border:'1px solid currentColor',borderRadius:12}}>
    <h2 style={{fontSize:'1rem'}}>Account deletion cleanup</h2>
    {error ? <p role="alert">Cleanup status unavailable. Do not assume all billing and media cleanup is complete.</p>
      : !counts ? <p>Checking durable cleanup jobs…</p> : <>
        <p>{Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(' · ')}</p>
        {(counts.dead || 0) > 0 && <p role="alert">Manual review required: exhausted cleanup retries remain. Check the service-only account_cleanup_jobs ledger.</p>}
        <small>Failed billing or media cleanup retries automatically every five minutes with backoff.</small>
      </>}
  </section>;
}
