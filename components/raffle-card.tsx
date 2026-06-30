'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Compact hub teaser for the Summer of Connection raffle. It ONLY links to
// /raffle — the whole flow (enter, accept/reject, it's-a-date) lives over there
// as its own page, since it's only for the raffle. This is just a status-aware
// nudge that points you to it.
export default function RaffleCard() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    fetch('/api/raffle/status').then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  if (!s || !s.eligible) return null;

  const ev = s.event;
  const other = s.other?.name ? s.other.name.split(' ')[0] : 'your match';
  let border = '#ff6a1f', accent = '#ff6a1f', head = ev.tagline, sub = '', label = 'enter the raffle →', fine = false;

  if (s.draw?.bothAccepted) {
    border = accent = '#2d7a4f'; head = `it’s a date with ${other}. ✦`; sub = `your $${ev.budget} dinner is locked · ${ev.dateLabel}`; label = 'see the details →';
  } else if (s.draw && s.draw.status === 'pending' && !s.draw.myAccepted) {
    border = accent = '#2563ff'; head = `🎉 you’ve been picked — meet ${other}!`; sub = 'open the raffle to accept or reject your match.'; label = 'open the raffle →';
  } else if (s.draw?.myAccepted && !s.draw.bothAccepted) {
    border = accent = '#2563ff'; head = `you’re in — waiting on ${other}.`; sub = `as soon as ${other} accepts, it’s locked for ${ev.dateLabel}.`; label = 'view your entry →';
  } else if (s.entered) {
    head = 'you’re in the raffle. ✓'; sub = `we draw ${ev.drawLabel} and ping you the second you’re picked.`; label = 'view your entry →';
  } else if (!ev.entriesOpen) {
    head = `${ev.series} is on pause.`;
    sub = `The dinner round is being tuned quietly. Date: ${ev.dateLabel || 'TBD'}.`;
    label = 'see details →';
    fine = false;
  } else if (ev.closed) {
    head = 'raffle entries are closed.'; sub = `watch here for the next ${ev.series} drop.`; label = '';
  } else {
    head = ev.tagline; sub = `a fully-covered $${ev.budget}* dinner · ${ev.dateLabel} · ${ev.spotsLeft} of ${ev.cap} spots left.`; label = 'enter the raffle →'; fine = true;
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${border}`, borderRadius: 18, padding: '1.2rem 1.35rem', boxShadow: '0 18px 50px -30px rgba(255,106,31,0.5)' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.4rem', fontWeight: 700 }}>🎟️ {ev.series} · {ev.statusLabel || ev.city}</div>
      <h3 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.3rem' }}>{head}</h3>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 }}>{sub}</p>
      {label && (
        <Link href="/raffle" style={{ display: 'inline-block', marginTop: '0.9rem', background: accent, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.04em', textDecoration: 'none' }}>{label}</Link>
      )}
      {fine && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.62rem', color: 'var(--h-text-faint)', lineHeight: 1.4 }}>
          * No purchase necessary · 21+ · winner by chance
        </div>
      )}
      <div style={{ marginTop: fine ? '0.3rem' : '0.7rem', fontSize: '0.56rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
        <Link href="/raffle/rules" style={{ color: 'var(--h-text-faint)', textDecoration: 'underline' }}>*terms &amp; conditions apply</Link>
      </div>
    </div>
  );
}
