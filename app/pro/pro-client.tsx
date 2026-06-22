'use client';

import { useState } from 'react';
import Link from 'next/link';

const INK = '#0a0a0a';
const BLUE = '#2563ff';
const ORANGE = '#ff6a1f';

const PERKS = [
  { icon: '💘', t: 'Every love profile, unlocked', d: 'See any match’s full profile — bio, photos, the works — no $0.99 per unlock.' },
  { icon: '🎒', t: 'Unlimited friendship packs', d: 'Open as many packs as you want, free. Each one is up to 10 new friends.' },
  { icon: '🎟️', t: 'The whole Scene', d: 'Events, crews, the city pulse — all of it, all the time.' },
  { icon: '✦', t: 'One price, everything', d: 'No à-la-carte. One subscription across the Love Line and the Friend Line.' },
];

export default function ProClient({ pro, renewsOn }: { pro: boolean; renewsOn: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function subscribe() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/pro/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else setErr(d.error || 'checkout unavailable');
    } catch { setErr('something glitched — try again'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#0a0710 0%,#140b1c 100%)', color: '#fff', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
          <Link href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← hub</Link>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '0.6rem' }}>notcupid pro</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(3rem,12vw,4.5rem)', lineHeight: 0.92, margin: '0 0 0.5rem', background: `linear-gradient(90deg,${ORANGE},#ff2d8e,${BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          everything. one price.
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          both lines, fully open — for less than a coffee a month.
        </p>

        {pro ? (
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 18, padding: '1.5rem', textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2rem' }}>✦</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '0.02em' }}>you’re Pro</div>
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem', margin: '0.3rem 0 0' }}>
              {renewsOn ? `renews ${renewsOn}.` : 'active.'} everything’s unlocked — go enjoy it.
            </p>
            <Link href="/friends/pack" style={{ display: 'inline-block', marginTop: '1rem', background: ORANGE, color: '#fff', borderRadius: 999, padding: '0.7rem 1.6rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.04em', textDecoration: 'none' }}>open a pack →</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
              {PERKS.map((p) => (
                <div key={p.t} style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0.9rem 1rem' }}>
                  <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{p.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontWeight: 700, fontSize: '1.05rem' }}>{p.t}</div>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.45 }}>{p.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={subscribe} disabled={busy} style={{ width: '100%', background: `linear-gradient(90deg,${ORANGE},#ff2d8e)`, color: '#fff', border: 'none', borderRadius: 16, padding: '1.1rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.03em', cursor: busy ? 'wait' : 'pointer', boxShadow: '0 18px 50px -18px rgba(255,45,142,0.7)' }}>
              {busy ? '…' : 'go Pro · $3.99/mo'}
            </button>
            <p style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: '0.8rem' }}>
              cancel anytime · keeps access through the month you paid for
            </p>
            {err && <p style={{ textAlign: 'center', color: '#ffb3b3', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.9rem' }}>{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
