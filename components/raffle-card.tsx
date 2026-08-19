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
  let border = '#ff6a1f', accent = '#ff6a1f', head = ev.tagline, sub = '', label = 'join the experiment →', href = '/dating-experiment', fine = false;

  if (s.draw?.bothAccepted) {
    border = accent = '#2d7a4f'; head = `it’s a date with ${other}. ✦`; sub = `your $${ev.budget} dinner is locked · ${ev.dateLabel}`; label = 'see the details →';
  } else if (s.shortlist?.length && !s.shortlistRound?.allResponded) {
    border = accent = '#2563ff'; head = 'your private shortlist is ready. ✦'; sub = `${s.shortlist.length} compatible ${s.shortlist.length === 1 ? 'person' : 'people'} · say yes to either, both, or neither.`; label = 'make your choices →';
  } else if (s.shortlist?.length && s.shortlistRound?.allResponded) {
    border = accent = '#2563ff'; head = 'your choices are sealed. 🔒'; sub = 'we’ll resolve the round when everyone responds or the window closes.'; label = 'view the experiment →';
  } else if (s.draw && s.draw.status === 'pending' && !s.draw.myAccepted) {
    border = accent = '#2563ff'; head = `🎉 you’ve been selected — meet ${other}!`; sub = 'preview each other privately, then decide.'; label = 'open the experiment →';
  } else if (s.draw?.myAccepted && !s.draw.bothAccepted) {
    border = accent = '#2563ff'; head = `you’re in — waiting on ${other}.`; sub = `as soon as ${other} accepts, it’s locked for ${ev.dateLabel}.`; label = 'view your entry →';
  } else if (s.entered) {
    head = 'you’re in the dating experiment. ✓'; sub = `shortlists form ${ev.drawLabel}; we’ll ping you if you receive one or two private options.`; label = 'view your entry →';
  } else if (ev.closed) {
    head = 'experiment entries are closed.'; sub = 'watch here for the next dinner round.'; label = '';
  } else if (!ev.entriesOpen) {
    head = `${ev.series} is on pause.`;
    sub = `The dinner round is being tuned quietly. Date: ${ev.dateLabel || 'TBD'}.`;
    label = 'see details →';
    fine = false;
  } else if (!s.hasProfile) {
    const missing = Array.isArray(s.profileMissing) ? s.profileMissing.join(', ') : 'a few profile basics';
    head = 'your experiment profile needs a quick finish.';
    sub = `Add ${missing}. We’ll bring everything else you already completed.`;
    label = 'finish my profile →';
    href = '/dating-experiment/profile?from=hub';
  } else {
    head = 'your profile is ready—finish your entry.';
    sub = `Choose your preferences and available dinner time. ${ev.spotsLeft} of ${ev.cap} spots remain.`;
    label = 'continue to the experiment →';
    href = '/dating-experiment?from=hub-ready';
    fine = true;
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${border}`, borderRadius: 18, padding: '1.2rem 1.35rem', boxShadow: '0 18px 50px -30px rgba(255,106,31,0.5)' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.4rem', fontWeight: 700 }}>🎟️ {ev.series} · {ev.statusLabel || ev.city}</div>
      <h3 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--h-text)', margin: '0 0 0.3rem' }}>{head}</h3>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 }}>{sub}</p>
      {label && (
        <Link href={href} style={{ display: 'inline-block', marginTop: '0.9rem', background: accent, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.04em', textDecoration: 'none' }}>{label}</Link>
      )}
      {fine && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.62rem', color: 'var(--h-text-faint)', lineHeight: 1.4 }}>
          * No purchase necessary · 21+ · compatibility-weighted selection
        </div>
      )}
      <div style={{ marginTop: fine ? '0.3rem' : '0.7rem', fontSize: '0.56rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
        <Link href="/dating-experiment/faq" style={{ color: 'var(--h-text-faint)', textDecoration: 'underline' }}>how it works + FAQ</Link>
        <span style={{ color: 'var(--h-text-faint)' }}> · </span>
        <Link href="/dating-experiment/terms" style={{ color: 'var(--h-text-faint)', textDecoration: 'underline' }}>official rules</Link>
      </div>
    </div>
  );
}
