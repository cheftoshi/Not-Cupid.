'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeToPush } from '@/lib/push-client';

// The Summer of Connection raffle card on the hub. Shows the right state:
// register → entered (+ enable notifications) → drawn (accept/pass) → it's a date.
export default function RaffleCard() {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pushOn, setPushOn] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/raffle/status').then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
    if (typeof Notification !== 'undefined') setPushOn(Notification.permission === 'granted');
  }, []);

  if (!s || !s.eligible) return null;

  async function respond(accept: boolean) {
    setBusy(true);
    const r = await fetch('/api/raffle/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) });
    if (r.ok) window.location.reload(); else { setBusy(false); setMsg('try again'); }
  }
  async function enablePush() { const ok = await subscribeToPush(); setPushOn(ok); if (!ok) setMsg('couldn’t enable — on iPhone, install the app first'); }

  const ev = s.event;
  const eyebrow = (
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.4rem', fontWeight: 700 }}>
      🎟️ {ev.series} · {ev.city}
    </div>
  );
  const shell = (border: string, children: React.ReactNode) => (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${border}`, borderRadius: 18, padding: '1.2rem 1.35rem', boxShadow: '0 18px 50px -30px rgba(255,106,31,0.5)' }}>
      {children}
      {msg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', color: '#d2530f', marginTop: '0.5rem' }}>{msg}</div>}
    </div>
  );
  const H = (t: string) => <h3 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.35rem' }}>{t}</h3>;
  const P = (t: React.ReactNode) => <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 }}>{t}</p>;
  const cta = (href: string, label: string) => <Link href={href} style={{ display: 'inline-block', marginTop: '0.9rem', background: '#ff6a1f', color: '#fff', borderRadius: 999, padding: '0.65rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '0.04em', textDecoration: 'none' }}>{label}</Link>;
  const otherName = s.other?.name ? s.other.name.split(' ')[0] : 'your match';

  // ── it's a date (mutual accept) ──
  if (s.draw?.bothAccepted) {
    return shell('#2d7a4f', (<>
      {eyebrow}
      {H(`it’s a date with ${otherName}. ✦`)}
      {P(<>your <b>${ev.budget} dinner</b> is locked in · <b>{ev.dateLabel}</b>. {s.draw.restaurant}</>)}
    </>));
  }
  // ── you've been drawn (pending) ──
  if (s.draw && s.draw.status === 'pending' && !s.draw.myAccepted) {
    return shell('#2563ff', (<>
      {eyebrow}
      {H(`🎉 you’ve been picked — meet ${otherName}.`)}
      {P(<>you two scored <b>{s.draw.score}%</b>. say yes to lock in a <b>${ev.budget} date</b> on <b>{ev.dateLabel}</b>. {s.draw.theyAccepted ? `${otherName} already said yes 👀` : ''}</>)}
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem' }}>
        <button onClick={() => respond(true)} disabled={busy} style={{ background: '#2563ff', color: '#fff', border: 'none', borderRadius: 999, padding: '0.65rem 1.7rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '0.04em', cursor: busy ? 'wait' : 'pointer' }}>{busy ? '…' : 'accept →'}</button>
        <button onClick={() => respond(false)} disabled={busy} style={{ background: 'none', color: 'var(--h-text-dim)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.65rem 1.4rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>reject</button>
      </div>
    </>));
  }
  // ── drawn + you accepted, waiting on them ──
  if (s.draw && s.draw.myAccepted && !s.draw.bothAccepted) {
    return shell('#2563ff', (<>{eyebrow}{H(`you’re in — waiting on ${otherName}.`)}{P(<>you said yes to your <b>${ev.budget} date</b>. as soon as {otherName} accepts, it’s locked for {ev.dateLabel}.</>)}</>));
  }
  // ── entered, not yet drawn ──
  if (s.entered) {
    return shell('#ff6a1f', (<>
      {eyebrow}
      {H('you’re in the raffle. ✓')}
      {P(<>we draw the pairs <b>{ev.drawLabel}</b> and ping you if you’re picked for a <b>${ev.budget} date</b>.{!s.entry?.video_url ? ' add your intro video to stand out — ' : ' '}{!s.entry?.video_url && <Link href="/raffle" style={{ color: '#d2530f' }}>finish your entry →</Link>}</>)}
      {!pushOn && <button onClick={enablePush} style={{ marginTop: '0.8rem', background: 'var(--h-surface-2)', border: '1px solid rgba(255,106,31,0.4)', color: '#d2530f', borderRadius: 999, padding: '0.5rem 1.1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>🔔 turn on raffle notifications</button>}
    </>));
  }
  // ── entries closed (full or past deadline) ──
  if (ev.closed) {
    return shell('#ff6a1f', (<>{eyebrow}{H('entries are closed.')}{P(<>this round filled up — keep an eye here for the next <b>{ev.series}</b> drop.</>)}</>));
  }
  // ── not entered → register ──
  return shell('#ff6a1f', (<>
    {eyebrow}
    {H(ev.tagline)}
    {P(<>a fully-covered <b>${ev.budget} dinner</b> with someone you’re actually compatible with · <b>{ev.dateLabel}</b>.</>)}
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', color: '#d2530f', marginTop: '0.5rem', fontWeight: 700 }}>
      {ev.spotsLeft} of {ev.cap} spots left · closes {ev.entryCloseLabel}
    </div>
    {cta('/raffle', 'enter the raffle →')}
  </>));
}
