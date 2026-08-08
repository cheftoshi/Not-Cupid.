'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Compact hub teaser for the Dating Experiment. Legacy API names stay internal.
export default function RaffleCard() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    fetch('/api/raffle/status').then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  if (!s || !s.eligible) return null;

  const ev = s.event;
  const other = s.other?.name ? s.other.name.split(' ')[0] : 'your match';
  let border = '#ff6a1f', accent = '#ff6a1f', head = ev.tagline, sub = '', label = 'join the experiment →', fine = false;

  if (s.draw?.bothAccepted) {
    border = accent = '#2d7a4f'; head = `it’s a date with ${other}. ✦`; sub = `your $${ev.budget} dinner is locked · ${ev.dateLabel}`; label = 'see the details →';
  } else if (s.draw && s.draw.status === 'pending' && !s.draw.myAccepted) {
    border = accent = '#2563ff'; head = `🎉 you’ve been selected — meet ${other}!`; sub = 'preview each other privately, then decide.'; label = 'open the experiment →';
  } else if (s.draw?.myAccepted && !s.draw.bothAccepted) {
    border = accent = '#2563ff'; head = `you’re in — waiting on ${other}.`; sub = `as soon as ${other} accepts, it’s locked for ${ev.dateLabel}.`; label = 'view your entry →';
  } else if (s.entered) {
    head = 'you’re in the dating experiment. ✓'; sub = `selection runs ${ev.drawLabel}; we’ll ping you if you’re selected.`; label = 'view your entry →';
  } else if (!ev.entriesOpen) {
    head = `${ev.series} is on pause.`;
    sub = `The dinner round is being tuned quietly. Date: ${ev.dateLabel || 'TBD'}.`;
    label = 'see details →';
    fine = false;
  } else if (ev.closed) {
    head = 'experiment entries are closed.'; sub = 'watch here for the next dinner round.'; label = '';
  } else {
    head = ev.tagline; sub = `dinner up to $${ev.budget}* · ${ev.dateLabel} · ${ev.spotsLeft} of ${ev.cap} spots left.`; label = 'join the experiment →'; fine = true;
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${border}`, borderRadius: 18, padding: '1.2rem 1.35rem', boxShadow: '0 18px 50px -30px rgba(255,106,31,0.5)' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.4rem', fontWeight: 700 }}>🎟️ {ev.series} · {ev.statusLabel || ev.city}</div>
      <h3 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.3rem' }}>{head}</h3>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 }}>{sub}</p>
      {label && (
        <Link href="/dating-experiment" style={{ display: 'inline-block', marginTop: '0.9rem', background: accent, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.04em', textDecoration: 'none' }}>{label}</Link>
      )}
      {fine && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.62rem', color: 'var(--h-text-faint)', lineHeight: 1.4 }}>
          * Free entry · 21+ · compatibility-weighted selection
        </div>
      )}
      <div style={{ marginTop: fine ? '0.3rem' : '0.7rem', fontSize: '0.56rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
        <Link href="/dating-experiment/terms" style={{ color: 'var(--h-text-faint)', textDecoration: 'underline' }}>*terms &amp; conditions apply</Link>
      </div>
    </div>
  );
}
