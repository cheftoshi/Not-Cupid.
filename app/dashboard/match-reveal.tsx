'use client';

import { useEffect, useState } from 'react';

// A one-time, warm "moment" when a new match drops. Light/soft palette (no
// dark takeover), gentle staged motion, algo-voice copy, and a compatibility
// number that counts up. Plays once per match (localStorage), then dismisses
// to the match card underneath.
export default function MatchReveal({
  matchId,
  name,
  score,
  archetype,
}: {
  matchId: string;
  name: string;
  score: number | null;
  archetype?: string | null;
}) {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState(0); // drives staggered entrances
  const first = (name || 'someone').split(' ')[0];
  const key = `nc_seen_match_${matchId}`;

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(key) === '1'; } catch { /* ignore */ }
    if (seen || !matchId) return;
    setShow(true);
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }

    // Stagger the lines in.
    const t1 = setTimeout(() => setStage(1), 120);
    const t2 = setTimeout(() => setStage(2), 700);
    const t3 = setTimeout(() => setStage(3), 1500);
    const t4 = setTimeout(() => setStage(4), 2100);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [key, matchId]);

  // Count the compatibility number up once the number stage is reached.
  useEffect(() => {
    if (stage < 2 || score == null) return;
    const target = score;
    const dur = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, score]);

  if (!show) return null;

  const line = (visible: boolean, extra: React.CSSProperties = {}): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity .6s ease, transform .6s cubic-bezier(.2,.7,.2,1)',
    ...extra,
  });

  return (
    <div style={overlay}>
      <div style={glow} aria-hidden />
      <div style={content}>
        <div style={{ ...line(stage >= 1), fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2563ff', marginBottom: 18 }}>
          <span style={{ marginRight: 8 }}>✦</span>notcupid · match found
        </div>

        {score != null && (
          <div style={line(stage >= 2, { marginBottom: 6 })}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(5rem, 22vw, 9rem)', lineHeight: 0.9, color: 'var(--h-text)', letterSpacing: '0.01em' }}>
              {count}<span style={{ fontSize: '0.4em', color: '#ff6a1f' }}>%</span>
            </span>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: 2 }}>compatibility</div>
          </div>
        )}

        <div style={{ ...line(stage >= 3), marginTop: 14 }}>
          <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', color: 'var(--h-text)', lineHeight: 1.1 }}>
            meet <span style={{ color: '#2563ff' }}>{first}</span>.
          </div>
          {archetype && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: 8 }}>{archetype}</div>
          )}
        </div>

        <div style={{ ...line(stage >= 4), marginTop: 22, maxWidth: 360 }}>
          <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.55, color: 'var(--h-text-dim)', margin: '0 0 22px 0' }}>
            no swiping. no scrolling. just the one the algorithm picked for you.
          </p>
          <button onClick={() => setShow(false)} style={cta}>see your match →</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 80,
  background: 'var(--h-bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
  animation: 'ncRevealIn .5s ease both',
};
const glow: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: 'radial-gradient(circle at 50% 38%, rgba(37,99,255,0.12), transparent 42%), radial-gradient(circle at 50% 70%, rgba(255,106,31,0.08), transparent 45%)',
};
const content: React.CSSProperties = { position: 'relative', textAlign: 'center', maxWidth: 520 };
const cta: React.CSSProperties = {
  background: '#0b0b0b', color: '#fff', border: 'none', borderRadius: 999, padding: '15px 30px',
  fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  cursor: 'pointer', transition: 'transform .12s ease, background .15s ease',
};
