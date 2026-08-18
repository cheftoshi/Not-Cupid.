'use client';

import { useState } from 'react';
import { fetchWithTimeout, parseResponse } from '@/lib/fetch-helpers';
import { trackLoveEvent } from '@/lib/love-events-client';

type CompatibilityRead = {
  headline: string;
  overview: string;
  traits: Array<{ key: string; label: string; candidateBand: string; pairDynamic: string }>;
  strengths: string[];
  watchouts: string[];
  firstDateIdea: string;
  source: 'ai' | 'curated';
  disclosure: string;
};

export default function CompatibilityReadPanel({ candidateId, firstName }: { candidateId: string; firstName: string }) {
  const [read, setRead] = useState<CompatibilityRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openRead() {
    if (loading || read) return;
    setLoading(true);
    setError('');
    trackLoveEvent('compatibility_read_requested', { candidateId });
    try {
      const response = await fetchWithTimeout(`/api/love/compatibility-read/${encodeURIComponent(candidateId)}`, {}, 30_000);
      const data = await parseResponse<any>(response);
      if (!response.ok || !data.read) throw new Error(data.error || 'Compatibility read unavailable.');
      setRead(data.read);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Compatibility read unavailable.');
    } finally {
      setLoading(false);
    }
  }

  if (!read) {
    return (
      <div style={{ display: 'grid', gap: '0.55rem', padding: '0.8rem', border: '1px solid rgba(37,99,255,0.24)', borderRadius: 12, background: 'rgba(37,99,255,0.05)' }}>
        <span style={kicker}>AI + HEXACO · yours to keep</span>
        <strong style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.96rem' }}>your private compatibility read with {firstName}</strong>
        <p style={{ margin: 0, color: 'var(--h-text-dim)', fontSize: '0.76rem', lineHeight: 1.5 }}>Six broad personality signals, pair dynamics, and a first-date angle. Raw answers and exact scores stay private.</p>
        {error && <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: '0.74rem' }}>{error}</p>}
        <button type="button" onClick={openRead} disabled={loading} style={button}>
          {loading ? 'AI Connect Coach is reading…' : 'open compatibility read →'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.7rem', padding: '0.8rem', border: '1px solid rgba(37,99,255,0.24)', borderRadius: 12, background: 'rgba(37,99,255,0.05)' }}>
      <span style={kicker}>{read.source === 'ai' ? 'AI-personalized compatibility read' : 'curated compatibility read'}</span>
      <strong style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1rem' }}>{read.headline}</strong>
      <p style={copy}>{read.overview}</p>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {read.traits.map((trait) => (
          <div key={trait.key} style={{ padding: '0.58rem', border: '1px solid var(--h-border)', borderRadius: 10, background: 'var(--h-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.74rem' }}>{trait.label}</strong>
              <span style={{ ...kicker, fontSize: '0.44rem', textAlign: 'right' }}>{firstName}: {trait.candidateBand}</span>
            </div>
            <p style={{ ...copy, marginTop: '0.25rem', fontSize: '0.7rem' }}>{trait.pairDynamic}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <span style={kicker}>potential strengths</span>
        {read.strengths.map((item) => <p key={item} style={copy}>✦ {item}</p>)}
        <span style={{ ...kicker, marginTop: '0.25rem' }}>worth asking about</span>
        {read.watchouts.map((item) => <p key={item} style={copy}>↗ {item}</p>)}
      </div>
      <div style={{ padding: '0.65rem', borderRadius: 10, background: 'rgba(255,106,31,0.08)' }}>
        <span style={{ ...kicker, color: '#d2530f' }}>first-date angle</span>
        <p style={{ ...copy, marginTop: '0.3rem' }}>{read.firstDateIdea}</p>
      </div>
      <small style={{ color: 'var(--h-text-faint)', fontSize: '0.62rem', lineHeight: 1.45 }}>{read.disclosure}</small>
    </div>
  );
}

const kicker: React.CSSProperties = {
  color: '#2563ff', fontFamily: "'DM Mono', monospace", fontSize: '0.48rem',
  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
};
const copy: React.CSSProperties = { margin: 0, color: 'var(--h-text-dim)', fontSize: '0.74rem', lineHeight: 1.48 };
const button: React.CSSProperties = {
  minHeight: 44, border: 0, borderRadius: 10, background: '#0b0b0b', color: '#fff',
  fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
};

