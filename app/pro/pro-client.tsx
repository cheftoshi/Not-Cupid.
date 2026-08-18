'use client';

import { useState } from 'react';
import Link from 'next/link';

const INK = '#0a0a0a';
const BLUE = '#2563ff';
const ORANGE = '#ff6a1f';

const PERKS = [
  { icon: '🧠', t: 'AI Compatibility Reads, included', d: 'Open the private six-signal personality and fit read for any current Love roster profile without another checkout.' },
  { icon: '💘', t: 'Extra Love connections, included', d: 'Every core roster profile is free and three picks are included. Pro removes the $0.99 checkout for additional distinct picks.' },
  { icon: '🎒', t: 'Unlimited additional friendship packs', d: 'Open fresh packs without another checkout. Each one can add up to 5 new people to connect with.' },
  { icon: '🌱', t: 'Support an independent experiment', d: 'Help keep the core experience lightweight, ad-free, and free to use for everyone.' },
  { icon: '✦', t: 'One price, no repeat checkout', d: 'Skip the per-extra-connection and per-pack checkout. One subscription across the Love Line and the Friend Line.' },
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
          optional extras. one price.
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          the app works free. Pro removes the repeat checkout for people who want these extras.
        </p>

        {!pro && (
          <div style={{ margin: '0 0 1rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 14, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9fbeff', marginBottom: '0.45rem' }}>always free</div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '0.86rem', lineHeight: 1.6 }}>
              Complete roster profiles · up to ten curated Love options · three distinct picks per roster · accepting · replies · date planning · Friend conversations
            </p>
          </div>
        )}

        {pro ? (
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 18, padding: '1.5rem', textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2rem' }}>✦</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '0.02em' }}>you’re Pro</div>
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem', margin: '0.3rem 0 0' }}>
              {renewsOn ? `renews ${renewsOn}.` : 'active.'} AI Compatibility Reads, extra Love picks, and additional Friend packs are open.
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
            <p style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', margin: '0.55rem auto 0', maxWidth: 430 }}>
              Prefer to stay flexible? One AI Compatibility Read plus its person-specific extra connection, or one additional Friend pack, remains $0.99.
            </p>
            {err && <p style={{ textAlign: 'center', color: '#ffb3b3', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.9rem' }}>{err}</p>}
          </>
        )}

        {/* social connect links (dark-friendly) */}
        <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[['instagram', 'https://instagram.com/notcupidapp'], ['tiktok', 'https://tiktok.com/@notcupid11'], ['x', 'https://x.com/notcupidapp']].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'lowercase', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>↗ {label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
