'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { NEIGHBORHOODS } from '@/lib/neighborhoods';
import ReactivateButton from '@/components/reactivate-button';
import LocationControls from '@/components/location-controls';

// ── Friend Line theme (warm MBTA transit) ──
const INK = '#241d12';           // warm near-black (signage)
const LINE = '#e8842b';          // the Friend Line — warm orange
const LINE_DEEP = '#c96a18';     // deeper orange for shadows/hover
const CREAM = 'var(--h-surface)'; // warm station-tile cream → themed surface
const CATS = ['food', 'drinks', 'active', 'outdoors', 'culture', 'nightlife', 'games', 'chill', 'hang'];

// Calm chrome: thin borders + soft shadows (was 3px ink borders + hard 5px offset
// shadows — too loud). Surfaces read quiet so the content + connections lead.
const card: React.CSSProperties = { background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 16, boxShadow: '0 12px 36px -26px rgba(0,0,0,0.6)' };
const chip: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.22rem 0.6rem', color: 'var(--h-text-dim)' };
// Section headers: a small connection-node + a calmer (smaller) display size.
const sectionLabel: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.05em', margin: '1.7rem 0 0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--h-text)' };
const poppyBtn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', color: '#fff', background: LINE, border: 'none', borderRadius: 999, padding: '0.6rem 1.5rem', boxShadow: '0 12px 26px -14px rgba(232,132,43,0.7)', cursor: 'pointer' };
// A small filled node (the connection motif), not a chunky station ring.
const StationDot = () => <span style={{ width: 7, height: 7, borderRadius: '50%', background: LINE, flexShrink: 0, display: 'inline-block' }} />;

// City Pulse — a live "departure board" of three headline stats.
function PulseBoard({ stats, line, ink, deep }: { stats: { n: number; label: string; icon: string; onClick?: () => void }[]; line: string; ink: string; deep: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem' }}>
      {stats.map((t) => {
        const Tag: any = t.onClick ? 'button' : 'div';
        return (
          <Tag key={t.label} onClick={t.onClick}
            style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', background: 'var(--h-surface)', border: `1px solid var(--h-border)`, borderRadius: 14, boxShadow: `0 8px 22px -16px rgba(0,0,0,0.5)`, padding: '0.7rem 0.75rem 0.6rem', cursor: t.onClick ? 'pointer' : 'default', font: 'inherit', color: ink }}>
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: line }} />
            <div style={{ fontSize: '1rem', marginTop: '0.2rem' }}>{t.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', lineHeight: 0.9, color: deep }}>{t.n}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.15rem' }}>{t.label}</div>
          </Tag>
        );
      })}
    </div>
  );
}

// City Pulse — ranked "where it's buzzing" list. Each neighborhood is a row with
// an intensity bar (members + things-to-do) so you read the hot spots at a glance.
function PulseRanked({ areas, line, ink, deep, onPick, active }: { areas: any[]; line: string; ink: string; deep: string; onPick: (area: string) => void; active: string }) {
  const scored = [...areas]
    .map((a) => ({ ...a, score: (a.members || 0) + (a.activities || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const max = Math.max(1, ...scored.map((a) => a.score));
  if (scored.length === 0) return <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>quiet out there right now — be the first to start something.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {scored.map((a, i) => {
        const sel = active === a.area;
        const hot = i === 0 && a.score > 0;
        const pct = Math.max(8, Math.round((a.score / max) * 100));
        return (
          <button key={a.area} onClick={() => onPick(a.area)} title={`see what's happening in ${a.area}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', background: sel ? 'var(--h-surface-3)' : 'var(--h-surface)', border: `1px solid var(--h-border)`, borderRadius: 12, boxShadow: sel ? `0 8px 22px -16px rgba(0,0,0,0.5)` : `0 8px 22px -16px rgba(0,0,0,0.5)`, padding: '0.5rem 0.7rem', cursor: 'pointer', font: 'inherit', color: ink }}>
            <span style={{ width: 96, flexShrink: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hot && '🔥 '}{a.area}
            </span>
            <span style={{ flex: 1, height: 12, background: 'var(--h-surface-3)', borderRadius: 999, border: `1px solid var(--h-border)`, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: sel ? '#ffce4d' : hot ? line : 'rgba(232,132,43,0.55)' }} />
            </span>
            <span style={{ flexShrink: 0, display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: deep }}>
              <span title="people here">👥{a.members || 0}</span>
              {a.activities ? <span title="things to do">📣{a.activities}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// A LIVING, CITY-AGNOSTIC connection field (canvas). Nodes drift slowly; a link
// forms between any two that wander near each other and fades as they part; every
// so often a "signal" pulse travels a link — a connection sparking in real time.
// Branded orange with a ~1-in-5 violet duotone for a funky/artsy color story.
// Calm by design: low density, ~30fps, low opacity. Reduced-motion → a still
// frame; pauses when the tab's hidden. Same anywhere — it's people, not a map.
function ConnectionBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(1.4, window.devicePixelRatio || 1);
    let w = 1, h = 1;
    const N = 30, LINK = 0.19, TAU = Math.PI * 2;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00015, vy: (Math.random() - 0.5) * 0.00015,
      r: 1.4 + Math.random() * 2.4, cool: Math.random() < 0.28,
    }));
    // "travelers" — little comets that journey node→node along the network,
    // leaving a fading trail and blooming each person they reach (a connection
    // finding its way to someone). Pac-Man energy, abstract + elegant.
    const nearest = (n: number, not: number) => {
      let best = -1, bd = Infinity;
      for (let k = 0; k < N; k++) { if (k === n || k === not) continue; const d = Math.hypot(nodes[n].x - nodes[k].x, nodes[n].y - nodes[k].y); if (d < bd) { bd = d; best = k; } }
      return best < 0 ? (n + 1) % N : best;
    };
    const travelers = Array.from({ length: 3 }, (_, i) => ({ from: i * 7 % N, to: -1, prev: -1, t: 0, col: i % 2 ? '95,184,255' : '79,224,210', trail: [] as { x: number; y: number }[] }));
    for (const tr of travelers) tr.to = nearest(tr.from, -1);
    const blooms: { x: number; y: number; t: number }[] = [];
    const size = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    let raf = 0, last = 0, on = true;
    const draw = (ts: number) => {
      if (!on) return;
      raf = requestAnimationFrame(draw);
      if (ts - last < 34) return; last = ts; // ~30fps — calm, easy on battery
      ctx.clearRect(0, 0, w, h);
      if (!reduce) for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -0.02) n.x = 1.02; else if (n.x > 1.02) n.x = -0.02;
        if (n.y < -0.02) n.y = 1.02; else if (n.y > 1.02) n.y = -0.02;
      }
      // links — teal/blue, brighter so they actually read (no shadow = fast)
      ctx.shadowBlur = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j];
        const dn = Math.hypot(a.x - b.x, a.y - b.y);
        if (dn >= LINK) continue;
        const o = (1 - dn / LINK) * 0.32;
        ctx.strokeStyle = (a.cool && b.cool) ? `rgba(95,184,255,${o})` : `rgba(79,214,200,${o})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
      }
      // nodes — neon teal glow (the un-flimsy part)
      ctx.shadowBlur = 8;
      for (const n of nodes) {
        ctx.shadowColor = n.cool ? 'rgba(95,184,255,0.85)' : 'rgba(79,214,200,0.85)';
        ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r, 0, TAU);
        ctx.fillStyle = n.cool ? 'rgba(140,205,255,0.72)' : 'rgba(110,228,214,0.74)'; ctx.fill();
      }
      // travelers — glowing comets that journey + bloom each person they reach
      for (const tr of travelers) {
        const a = nodes[tr.from], b = nodes[tr.to];
        if (!reduce) tr.t += 0.0075; // calm pace (~4.5s per hop)
        if (tr.t >= 1) { blooms.push({ x: b.x, y: b.y, t: 0 }); tr.prev = tr.from; tr.from = tr.to; tr.to = nearest(tr.from, tr.prev); tr.t = 0; }
        const x = (a.x + (b.x - a.x) * tr.t) * w, y = (a.y + (b.y - a.y) * tr.t) * h;
        tr.trail.push({ x, y }); if (tr.trail.length > 18) tr.trail.shift();
        ctx.shadowBlur = 0;
        for (let s = 0; s < tr.trail.length; s++) {
          const pt = tr.trail[s];
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.7, 0, TAU); ctx.fillStyle = `rgba(${tr.col},${(s / tr.trail.length) * 0.55})`; ctx.fill();
        }
        ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${tr.col},0.95)`;
        ctx.beginPath(); ctx.arc(x, y, 3.3, 0, TAU); ctx.fillStyle = `rgba(${tr.col},1)`; ctx.fill();
      }
      // blooms — an expanding ring as a connection lands on someone
      for (let k = blooms.length - 1; k >= 0; k--) {
        const bl = blooms[k]; bl.t += 0.045; if (bl.t >= 1) { blooms.splice(k, 1); continue; }
        ctx.shadowBlur = 9; ctx.shadowColor = 'rgba(79,214,200,0.7)';
        ctx.beginPath(); ctx.arc(bl.x * w, bl.y * h, 3 + bl.t * 18, 0, TAU);
        ctx.strokeStyle = `rgba(110,228,214,${(1 - bl.t) * 0.5})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => { on = !document.hidden; if (on) { last = 0; raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { on = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 60% at 50% -12%, rgba(79,214,200,0.10), transparent 60%), radial-gradient(90% 55% at 100% 112%, rgba(95,184,255,0.07), transparent 55%)' }} />
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}

// ── old-school-FB shell pieces (warm transit palette) ──
type NavKey = 'home' | 'scene' | 'crew' | 'pulse';
const NAV: Array<{ key: NavKey; icon: string; label: string }> = [
  { key: 'home', icon: '🏠', label: 'home' },
  { key: 'scene', icon: '🎟️', label: 'the scene' },
  { key: 'crew', icon: '🧡', label: 'my circle' },
  { key: 'pulse', icon: '🌆', label: 'city pulse' },
];
const sideHd: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP, fontWeight: 700 };
const sideEmpty: React.CSSProperties = { fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.82rem', marginTop: '0.4rem' };
const miniCount: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999, background: LINE, color: '#fff', border: `1px solid var(--h-border)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

type Person = { id: string; name: string; photo_url: string | null; tag?: string };

// The left rail: FB-style nav + active-crew stat + people + zones. Uses the
// module palette directly so the call site stays clean.
function FriendSidebar({ view, setView, activeGroups, people, zones, onZone, crewBadge, sceneBadge = 0 }: {
  view: NavKey; setView: (v: NavKey) => void; activeGroups: number; people: Person[]; zones: any[]; onZone: (a: string) => void; crewBadge: boolean; sceneBadge?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <nav className="fbSideNav" style={{ ...card, padding: '0.45rem' }}>
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button key={n.key} onClick={() => setView(n.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', background: active ? LINE : 'transparent', color: active ? '#fff' : 'var(--h-text)', border: 'none', borderRadius: 10, padding: '0.5rem 0.7rem', cursor: 'pointer', font: 'inherit', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.03em' }}>
              <span style={{ fontSize: '1.05rem' }}>{n.icon}</span>{n.label}
              {n.key === 'crew' && crewBadge && <span style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: '#da291c', border: `2px solid ${active ? '#fff' : INK}` }} />}
              {n.key === 'scene' && sceneBadge > 0 && <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#da291c', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${active ? '#fff' : INK}` }}>{sceneBadge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ ...card, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: activeGroups > 0 ? '#3f7d57' : '#c9a06a', boxShadow: activeGroups > 0 ? '0 0 0 4px rgba(63,125,87,0.18)' : 'none' }} />
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', lineHeight: 1 }}>{activeGroups} {activeGroups === 1 ? 'crew' : 'crews'} live</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>hanging right now</div>
        </div>
      </div>

      <div style={{ ...card, padding: '0.8rem 0.9rem' }}>
        <div style={sideHd}>👥 on the line</div>
        {people.length === 0 ? <div style={sideEmpty}>finding your people…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.55rem' }}>
            {people.slice(0, 8).map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `1px solid var(--h-border)`, flexShrink: 0 }} />
                  : <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--h-surface-3)', border: `1px solid var(--h-border)`, flexShrink: 0, display: 'inline-block' }} />}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name?.split(' ')[0] || '—'}</span>
                {p.tag && <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: LINE_DEEP, background: 'var(--h-surface-3)', border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.1rem 0.4rem', flexShrink: 0 }}>{p.tag}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, padding: '0.8rem 0.9rem' }}>
        <div style={sideHd}>📍 zones</div>
        {(!zones || zones.length === 0) ? <div style={sideEmpty}>no zones yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.5rem' }}>
            {[...zones].sort((a, b) => (b.members + (b.activities || 0)) - (a.members + (a.activities || 0))).slice(0, 8).map((z, i) => (
              <button key={z.area} onClick={() => onZone(z.area)} title={`see ${z.area}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: '0.3rem 0.1rem', color: 'var(--h-text)', borderRadius: 6 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i === 0 ? '🔥 ' : ''}{z.area}</span>
                <span style={{ marginLeft: 'auto', ...miniCount }}>{z.members}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// The center "home" hub — auto-pulls what's popular on the scene + your crew.
function HomeFeed({ firstName, activeGroups, popular, hasCrew, onCrew, onScene, onRsvp, onDelete, onOpen }: {
  firstName: string; activeGroups: number; popular: any[]; hasCrew: boolean; onCrew: () => void; onScene: () => void; onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void; onDelete: (id: string) => void; onOpen: (v: NavKey) => void;
}) {
  return (
    <div>
      <div style={{ ...card, padding: '1rem 1.15rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', lineHeight: 1 }}>welcome back, {firstName.toLowerCase()}.</div>
          <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '0.92rem' }}>
            {activeGroups > 0 ? `${activeGroups} ${activeGroups === 1 ? 'crew is' : 'crews are'} hanging right now.` : 'the line is warming up — post something to get it going.'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {hasCrew && <button onClick={onCrew} style={{ ...poppyBtn, fontSize: '1rem', padding: '0.45rem 0.95rem' }}>🎒 my crew →</button>}
          <button onClick={onScene} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.04em', color: INK, background: '#ffd23d', border: "1px solid var(--h-border)", borderRadius: 12, padding: '0.45rem 0.95rem', boxShadow: `3px 3px 0 ${INK}`, cursor: 'pointer' }}>📣 post →</button>
        </div>
      </div>

      <h2 style={sectionLabel}><StationDot />📅 your events</h2>
      {popular.length === 0 ? (
        <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>
          nothing on your calendar yet — <button onClick={onScene} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, textDecoration: 'underline', font: 'inherit', fontStyle: 'italic' }}>find something on the scene →</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {popular.map((a) => <ActivityPost key={a.id} a={a} onRsvp={onRsvp} onDelete={onDelete} />)}
          <button onClick={() => onOpen('scene')} style={{ alignSelf: 'center', marginTop: '0.2rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'underline', textUnderlineOffset: 4 }}>
            see everything on the scene →
          </button>
        </div>
      )}
    </div>
  );
}

// Relative "2h / 3d / 1w" stamp (client-only; acts load after mount so no SSR mismatch).
function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24; if (d < 7) return `${Math.floor(d)}d`;
  return `${Math.floor(d / 7)}w`;
}

// Live "starts in 3h 20m" ticker until an event kicks off (then "happening now").
function Countdown({ to }: { to: string }) {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  const ms = new Date(to).getTime() - Date.now();
  if (ms <= 0) return <span style={{ color: '#3f7d57', fontWeight: 700 }}>● happening now</span>;
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  const soon = ms < 3 * 3600 * 1000;
  return <span style={{ color: soon ? LINE_DEEP : 'var(--h-text-dim)', fontWeight: soon ? 700 : 400 }}>⏳ starts in {label}</span>;
}

function audienceLabel(a: any): string | null {
  const g = a.audienceGender;
  const gLabel = Array.isArray(g) && g.length
    ? g.map((x: string) => (x === 'm' ? 'men' : x === 'f' ? 'women' : x === 'lgbtq' ? 'LGBTQ+' : 'non-binary')).join(' + ')
    : null;
  const min = a.audienceAgeMin, max = a.audienceAgeMax;
  let ageLabel = '';
  if (min != null && max != null) ageLabel = `${min}–${max}`;
  else if (min != null) ageLabel = `${min}+`;
  else if (max != null) ageLabel = `under ${max + 1}`;
  if (!gLabel && !ageLabel) return null; // open to everyone
  return [gLabel, ageLabel].filter(Boolean).join(' · ');
}

// One Scene post, FB-post structured: header (who/when) · body · action bar.
// Events carry an audience (gender+age) and a live countdown; eligible people
// get yes/maybe/no, everyone else sees who it's open to. Posts keep a 👍 like.
function ActivityPost({ a, onRsvp, onDelete }: { a: any; onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void; onDelete: (id: string) => void }) {
  const isEvent = (a.kind || 'event') !== 'post';
  const aud = isEvent ? audienceLabel(a) : null;
  const r = a.responses || { yes: 0, maybe: 0, no: 0 };
  const eligible = a.eligible !== false;
  const RESP: Array<['yes' | 'maybe' | 'no', string]> = [['yes', '✅ in'], ['maybe', '🤔 maybe'], ['no', '🚫 out']];
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.8rem 1rem 0.5rem' }}>
        {a.authorPhoto
          ? <img src={a.authorPhoto} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', lineHeight: 1 }}>{a.authorName?.split(' ')[0] || 'someone'}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)', marginTop: '0.2rem' }}>
            {isEvent ? '📅 plan' : '💬 post'} · 📍 {a.area || 'greater boston'}{a.created_at ? ` · ${timeAgo(a.created_at)}` : ''}
          </div>
        </div>
        <span style={{ ...chip, flexShrink: 0 }}>{a.category}</span>
        {a.isMine && <button onClick={() => onDelete(a.id)} title="delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>✕</button>}
      </div>
      <div style={{ padding: '0 1rem 0.75rem' }}>
        <div style={{ fontSize: '1.02rem', lineHeight: 1.4 }}>{a.title}</div>
        {isEvent && a.happens_at && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginTop: '0.55rem' }}>
            <span style={{ ...chip, background: 'var(--h-surface-3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' })}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em' }}><Countdown to={a.happens_at} /></span>
          </div>
        )}
        {isEvent && aud && (
          <div style={{ marginTop: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: LINE_DEEP }}>
            👥 open to {aud}
          </div>
        )}
      </div>
      <div style={{ borderTop: `2px solid rgba(36,29,18,0.12)`, padding: '0.45rem 0.6rem' }}>
        {!isEvent ? (
          <button onClick={() => onRsvp(a.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: a.iRsvped ? '#ffd23d' : 'transparent', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: a.iRsvped ? INK : 'var(--h-text)', fontWeight: 700 }}>
            {a.iRsvped ? '👍 liked' : '👍 like'}{a.rsvpCount ? <span style={{ ...miniCount, background: a.iRsvped ? INK : LINE }}>{a.rsvpCount}</span> : null}
          </button>
        ) : eligible ? (
          <div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {RESP.map(([val, label]) => {
                const on = a.myResponse === val;
                return (
                  <button key={val} onClick={() => onRsvp(a.id, val)}
                    style={{ flex: 1, background: on ? (val === 'no' ? '#f0d2c8' : '#ffd23d') : 'transparent', border: `2px solid ${on ? INK : 'rgba(36,29,18,0.2)'}`, borderRadius: 8, padding: '0.45rem 0.3rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: on ? INK : 'var(--h-text)', fontWeight: on ? 700 : 500 }}>
                    {label}{val === 'yes' && r.yes ? ` · ${r.yes}` : val === 'maybe' && r.maybe ? ` · ${r.maybe}` : ''}
                  </button>
                );
              })}
            </div>
            {(r.yes > 0 || r.maybe > 0) && (
              <div style={{ textAlign: 'center', marginTop: '0.35rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)' }}>
                {r.yes} going{r.maybe ? ` · ${r.maybe} maybe` : ''}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.4rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--h-text-dim)' }}>
            🔒 open to {aud || 'a specific group'}{r.yes ? ` · ${r.yes} going` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

type Me = { name: string; photo_url: string | null; archetype: string | null; bio: string; music: string[]; food: string[]; hobbies: string[]; galleryCount: number; friendSeeking?: string[]; friendAgeMin?: number | null; friendAgeMax?: number | null };
export default function FriendHubClient({ firstName, me, city, metro }: { firstName: string; me?: Me; city?: string | null; metro?: string | null; accessTier?: string; daysLeft?: number }) {
  const profileSet = !!(me && (me.photo_url || me.bio || (me.hobbies?.length || 0) > 0));
  // An event defaults to the audience the poster set on the Friend Line quiz
  // (who they want to meet + their age range). 'o' = everyone → no gender limit.
  const prefAud = {
    audGenders: (me?.friendSeeking || []).includes('all') ? [] : (me?.friendSeeking || []).filter((g) => ['m', 'f', 'nb', 'lgbtq'].includes(g)),
    audMin: me?.friendAgeMin != null ? String(me.friendAgeMin) : '',
    audMax: me?.friendAgeMax != null ? String(me.friendAgeMax) : '',
  };
  // Buying / opening packs now lives on the cinematic /friends/pack page.
  async function sendFeedback() {
    const fb = window.prompt('what would make the friend line better? (bugs, ideas, anything)');
    if (!fb || !fb.trim()) return;
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: fb }) });
    alert('got it — thank you! 🙏');
  }
  const [matches, setMatches] = useState<any[]>([]);
  const [sealedCount, setSealedCount] = useState(0);
  const [cooledUntil, setCooledUntil] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [ghosted, setGhosted] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [chat, setChat] = useState<any>({ circleId: null, members: [], messages: [] });
  const [pulse, setPulse] = useState<any>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<'all' | 'post' | 'event'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('');
  const feedRef = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('');
  const [newAct, setNewAct] = useState<{ title: string; category: string; happens_at: string; kind: 'post' | 'event'; area: string; audGenders: string[]; audMin: string; audMax: string }>({ title: '', category: 'hang', happens_at: '', kind: 'post', area: '', audGenders: prefAud.audGenders, audMin: prefAud.audMin, audMax: prefAud.audMax });
  const [busy, setBusy] = useState(false);
  // Deep-link: a crew push opens /friends?view=crew straight into the chat.
  const [view, setView] = useState<NavKey>(() => {
    if (typeof window === 'undefined') return 'home';
    const v = new URLSearchParams(window.location.search).get('view');
    return (['home', 'scene', 'crew', 'pulse'] as string[]).includes(v || '') ? (v as NavKey) : 'home';
  });
  const [chatOpen, setChatOpen] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  // In-app "new event" notification (no email — the daily digest covers that).
  const [evToast, setEvToast] = useState<{ id: string; title: string; author: string } | null>(null);
  const [newScene, setNewScene] = useState(0);
  const seenEvents = useRef<Set<string>>(new Set());
  const seenBootstrapped = useRef(false);

  const loadMatches = useCallback(async () => {
    const r = await fetch('/api/friend/roster');
    if (r.ok) { const d = await r.json(); setMatches(d.matches || []); setSealedCount(d.sealedCount || 0); setGhosted(!!d.ghosted); setHardLocked(!!d.hardLocked); setCooledUntil(d.friendCooled ? (d.cooledUntil || '') : null); }
  }, []);
  const loadChat = useCallback(async () => {
    const r = await fetch('/api/friend/messages'); if (r.ok) setChat(await r.json());
  }, []);
  const loadPulse = useCallback(async () => {
    const r = await fetch('/api/friend/city-pulse'); if (r.ok) setPulse(await r.json());
  }, []);
  const loadActs = useCallback(async () => {
    const r = await fetch(`/api/friend/activities${filterCat ? `?category=${filterCat}` : ''}`);
    if (r.ok) setActs((await r.json()).activities || []);
  }, [filterCat]);
  useEffect(() => { try { if (localStorage.getItem('nc-friend-terms') === '1') setTermsOk(true); } catch { /* ignore */ } }, []);

  useEffect(() => { loadMatches(); loadChat(); loadPulse(); }, [loadMatches, loadChat, loadPulse]);
  useEffect(() => { loadActs(); }, [loadActs]);
  // light polling for the group chat
  useEffect(() => { const t = setInterval(loadChat, 4000); return () => clearInterval(t); }, [loadChat]);
  // poll the Scene so new posts/events surface live (and can notify)
  useEffect(() => { const t = setInterval(loadActs, 45000); return () => clearInterval(t); }, [loadActs]);

  // In-app "new event" notification: when an eligible event you didn't post
  // appears, pop a toast + bump the Scene badge. First load seeds the baseline
  // so existing events don't notify on open.
  useEffect(() => {
    const events = acts.filter((a) => (a.kind || 'event') === 'event' && !a.isMine && a.eligible !== false);
    if (!seenBootstrapped.current) {
      events.forEach((e) => seenEvents.current.add(e.id));
      seenBootstrapped.current = true;
      return;
    }
    const fresh = events.filter((e) => !seenEvents.current.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => seenEvents.current.add(e.id));
    const newest = fresh[0]; // acts come newest-first
    setEvToast({ id: newest.id, title: newest.title, author: newest.authorName || 'someone' });
    setNewScene((n) => n + fresh.length);
  }, [acts]);
  // Opening the Scene clears the badge + toast.
  useEffect(() => { if (view === 'scene') { setNewScene(0); setEvToast(null); } }, [view]);
  // Auto-dismiss the toast after a few seconds (the badge persists until viewed).
  useEffect(() => { if (!evToast) return; const t = setTimeout(() => setEvToast(null), 7000); return () => clearTimeout(t); }, [evToast]);

  const iAmIn = matches.some((m) => m.iAccepted);
  // The chat is free now — it's live once the crew (circle) exists. Until then
  // we still show the box with the prospective members so the section is visible.
  const chatLive = !!(chat.circleId && chat.chatLive);
  // Who's in the chat — a labeled roster (avatar + first name + active/invited dot).
  // ACTIVE (here:true) = opted into the pack (in the circle) → can message. Everyone
  // else in the pack is still ACCOUNTED FOR (here:false = invited) so non-opters
  // show up greyed until they opt in. Active members come first.
  type CrewMember = { id: string; name: string; photo_url: string | null; here: boolean; you: boolean };
  const crewRoster: CrewMember[] = (() => {
    const out: CrewMember[] = [];
    const seen = new Set<string>();
    if (chat.circleId) {
      (chat.members || []).forEach((u: any) => { seen.add(u.id); out.push({ id: u.id, name: u.name, photo_url: u.photo_url, here: true, you: !!u.isMe }); });
    } else if (me) {
      out.push({ id: 'me', name: me.name, photo_url: me.photo_url, here: iAmIn, you: true }); seen.add('me');
    }
    // Account for everyone else in the pack who hasn't opted in yet (invited, inactive).
    matches.forEach((m) => { if (!seen.has(m.otherId)) { seen.add(m.otherId); out.push({ id: m.otherId, name: m.name, photo_url: m.photo_url, here: false, you: false }); } });
    return out.sort((a, b) => (a.you === b.you ? (a.here === b.here ? 0 : a.here ? -1 : 1) : a.you ? -1 : 1));
  })();

  // ── derived data for the FB-style shell ──
  const activeGroups = pulse?.activeGroups ?? 0;
  const crewBadge = matches.some((m) => m.theyAccepted && !m.iAccepted);
  // "On the line" = your crew first, then recent faces posting on the scene
  // (deduped), so the rail feels alive even before you have a full crew.
  const people: Person[] = (() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    matches.forEach((m) => { if (!seen.has(m.otherId)) { seen.add(m.otherId); out.push({ id: m.otherId, name: m.name, photo_url: m.photo_url, tag: m.connected ? 'crew' : 'match' }); } });
    acts.forEach((a) => { const k = a.authorName || ''; if (a.authorName && !seen.has(k)) { seen.add(k); out.push({ id: `act-${a.id}`, name: a.authorName, photo_url: a.authorPhoto || null, tag: 'posting' }); } });
    return out;
  })();
  // Home feed = what's popular on the scene (most RSVPs/likes), freshest first.
  const popular = [...acts]
    .sort((a, b) => (b.rsvpCount || 0) - (a.rsvpCount || 0) || (b.happens_at ? new Date(b.happens_at).getTime() : 0) - (a.happens_at ? new Date(a.happens_at).getTime() : 0))
    .slice(0, 6);
  // The HUB is YOUR stuff: events you're going to (the Scene shows the whole city).
  const myEvents = acts
    .filter((a) => a.myResponse === 'yes' || a.myResponse === 'maybe' || a.mine)
    .sort((a, b) => (a.happens_at ? new Date(a.happens_at).getTime() : Infinity) - (b.happens_at ? new Date(b.happens_at).getTime() : Infinity))
    .slice(0, 6);

  function agreeTerms() { setTermsOk(true); try { localStorage.setItem('nc-friend-terms', '1'); } catch { /* ignore */ } }

  // Choose the whole pack — opt in to open the group chat with everyone in it.
  // (The pack is the baseline; connections are what you build from it.)
  async function choosePack() {
    if (!termsOk) return;
    setBusy(true);
    await fetch('/api/friend/accept', { method: 'POST' });
    await loadMatches(); await loadChat();
    setBusy(false);
    setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }
  // Independent 1:1 connection with one person in the pack. First pick → they get
  // notified; if they'd already picked you, this accept connects you both.
  async function connectOne(otherId: string) {
    if (!termsOk) return;
    setBusy(true);
    await fetch('/api/friend/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: otherId }) });
    await loadMatches(); await loadChat();
    setBusy(false);
  }
  async function leaveCrew() {
    if (!confirm("Opt out of this crew? You'll leave the group for everyone in it and the algo will route you to a fresh one.")) return;
    setBusy(true);
    await fetch('/api/friend/leave', { method: 'POST' });
    setChatOpen(false);
    await loadMatches(); await loadChat();
    setBusy(false);
  }
  async function send() {
    const body = msg.trim(); if (!body) return; setMsg('');
    await fetch('/api/friend/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    await loadChat();
  }
  async function createAct() {
    if (!newAct.title.trim()) return; setBusy(true);
    const payload = {
      ...newAct,
      audience_gender: newAct.kind === 'event' ? newAct.audGenders : undefined,
      audience_age_min: newAct.kind === 'event' && newAct.audMin ? parseInt(newAct.audMin) : undefined,
      audience_age_max: newAct.kind === 'event' && newAct.audMax ? parseInt(newAct.audMax) : undefined,
    };
    const res = await fetch('/api/friend/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || "Couldn't post that — try again.");
      setBusy(false);
      return;
    }
    setNewAct({ title: '', category: 'hang', happens_at: '', kind: newAct.kind, area: newAct.area, audGenders: prefAud.audGenders, audMin: prefAud.audMin, audMax: prefAud.audMax }); await loadActs(); await loadPulse(); setBusy(false);
  }
  async function rsvp(id: string, response?: 'yes' | 'maybe' | 'no') {
    const r = await fetch(`/api/friend/activities/${id}/rsvp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response ? { response } : {}),
    });
    if (r.ok) {
      const d = await r.json();
      setActs((a) => a.map((x) => x.id === id ? { ...x, iRsvped: d.joined, rsvpCount: d.count, myResponse: d.myResponse, responses: d.responses } : x));
    }
  }
  async function deleteAct(id: string) {
    if (!confirm('Delete this post?')) return;
    const r = await fetch(`/api/friend/activities/${id}`, { method: 'DELETE' });
    if (r.ok) setActs((a) => a.filter((x) => x.id !== id));
  }

  return (
    <div className="friendDark" style={{ minHeight: '100vh', background: 'radial-gradient(130% 95% at 50% -12%, #0e2a34 0%, #050d12 58%)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif', position: 'relative', overflow: 'hidden' }}>
      <ConnectionBackdrop />

      {/* in-app "new event" pop-up — tap to jump to the Scene */}
      {evToast && (
        <button onClick={() => { setView('scene'); setEvToast(null); setNewScene(0); }}
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, maxWidth: 'min(440px, 92vw)', display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left', background: LINE, color: '#fff', border: "1px solid var(--h-border)", borderRadius: 14, boxShadow: `4px 4px 0 ${INK}`, padding: '0.7rem 0.95rem', cursor: 'pointer', font: 'inherit', animation: 'fbToastIn 0.25s ease' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🔔</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85, display: 'block' }}>new hang on the scene</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {(evToast.author || 'someone').split(' ')[0]}: {evToast.title}
            </span>
          </span>
          <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>see →</span>
        </button>
      )}

      <style>{`
        @keyframes fbToastIn { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        /* nav floats on top (all viewports); content = main feed + a right rail */
        .fbTopNav { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0.4rem 0 0.2rem; }
        .fbShell { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-top: 1.25rem; }
        @media (max-width: 879px) { .fbRail { order: 2; } .fbMain { order: 1; } }
        @media (min-width: 880px) {
          .fbShell { grid-template-columns: minmax(0,1fr) 290px; align-items: start; }
          .fbRail { position: sticky; top: 1rem; }
        }
        .fmGrid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 880px) {
          .fmGrid { grid-template-columns: minmax(0,1fr) 320px; align-items: start; }
          .fmRail { grid-column: 2; grid-row: 1; position: sticky; top: 1rem; }
          .fmMain { grid-column: 1; grid-row: 1; }
        }
        .fmMap { position: relative; min-height: min(72vh, 600px); margin: 1.25rem 0 0; }
        .fmMapLine { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
        .fmStop { position: absolute; transform: translateX(-50%); width: min(300px, 84vw); text-align: left; display: flex; flex-direction: column; background: var(--h-surface); border: 1px solid var(--h-border); border-radius: 18px; box-shadow: 6px 6px 0 ${INK}; padding: 1.4rem 1.3rem 1.2rem; cursor: pointer; color: var(--h-text); font: inherit; min-height: 190px; z-index: 1; transition: transform .12s ease, box-shadow .12s ease; }
        .fmStop:hover { transform: translate(calc(-50% - 2px), -3px); box-shadow: 9px 9px 0 ${INK}; }
        .fmStopDot { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 20px; height: 20px; border-radius: 50%; background: ${CREAM}; border: 5px solid ${LINE}; box-shadow: 0 0 0 3px var(--h-surface); }
        @media (max-width: 759px) {
          .fmMap { min-height: 0; display: flex; flex-direction: column; gap: 1.6rem; padding-top: 0.6rem; }
          .fmStop { position: static; transform: none; width: auto; }
          .fmStop:hover { transform: translate(-2px,-3px); }
          .fmMapLine { display: none; }
        }
        /* crew as a deck you swipe through, so the chat gets real room below */
        .crewDeck { display: flex; gap: 1rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.4rem 0.2rem 1rem; scrollbar-width: thin; }
        .crewDeck::-webkit-scrollbar { height: 8px; }
        .crewDeck::-webkit-scrollbar-thumb { background: rgba(36,29,18,0.3); border-radius: 999px; }
        .crewDeck > * { flex: 0 0 210px; scroll-snap-align: start; }
        .crewWho { scrollbar-width: none; }
        .crewWho::-webkit-scrollbar { display: none; }
        .crewLower { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-top: 1.5rem; align-items: start; }
        @media (min-width: 820px) { .crewLower { grid-template-columns: 280px minmax(0,1fr); } }
      `}</style>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', position: 'relative', zIndex: 1 }}>
        {/* Transit header bar — the Friend Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <a href="/hub" style={{ background: LINE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6, border: `1px solid var(--h-border)`, textDecoration: 'none' }}>FRIEND LINE</a>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: LINE_DEEP }}>{city ? `all of ${city.split(',')[0].toLowerCase()}` : 'your metro'}</span>
          </div>
          {/* friends: change your city (metro-wide; no radius) */}
          <LocationControls city={city} currentMetro={metro} accent={LINE} />
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,8vw,3.6rem)', lineHeight: 0.92, color: 'var(--h-text)', margin: '0.6rem 0 0' }}>
          connect with <span style={{ color: 'var(--h-accent)' }}>your people.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', margin: '0.5rem 0 1.4rem' }}>
          hey {firstName.toLowerCase()} — here&apos;s who&apos;s around and the connections waiting to happen. come say hi.
        </p>

        {/* the nav — a floating pill bar across the top */}
        <div className="fbTopNav">
          {NAV.map((n) => {
            const active = view === n.key;
            return (
              <button key={n.key} onClick={() => setView(n.key)}
                style={{ flexShrink: 0, position: 'relative', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.03em', padding: '0.45rem 1.1rem', borderRadius: 999, border: `1px solid ${active ? LINE : 'var(--h-border)'}`, cursor: 'pointer', background: active ? LINE : 'var(--h-surface)', color: active ? '#fff' : 'var(--h-text-dim)', boxShadow: active ? '0 8px 20px -10px rgba(232,132,43,0.7)' : 'none' }}>
                {n.icon} {n.label}
                {n.key === 'crew' && crewBadge && <span style={{ position: 'absolute', top: -5, right: -5, width: 12, height: 12, borderRadius: '50%', background: '#da291c', border: `1px solid var(--h-border)` }} />}
                {n.key === 'scene' && newScene > 0 && <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#da291c', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid var(--h-border)` }}>{newScene}</span>}
              </button>
            );
          })}
        </div>

        <div className="fbShell">
          <main className="fbMain">
        {view === 'home' && (
          <HomeFeed firstName={firstName} activeGroups={activeGroups} popular={myEvents} hasCrew={matches.length > 0}
            onCrew={() => setView('crew')} onScene={() => setView('scene')} onRsvp={rsvp} onDelete={deleteAct} onOpen={setView} />
        )}

        {view === 'crew' && (
        <div>
          {/* T&C safeguard — agree once before connecting with anyone */}
          {!termsOk && matches.length > 0 && !ghosted && (
            <label style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.85rem 1.1rem', marginBottom: '1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={termsOk} onChange={agreeTerms} style={{ width: 18, height: 18, marginTop: '0.15rem', accentColor: LINE, flexShrink: 0 }} />
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '0.86rem', color: 'var(--h-text-dim)', lineHeight: 1.5 }}>
                before you connect — I agree to NotCupid&apos;s <a href="/terms" style={{ color: LINE_DEEP }}>terms</a> &amp; <a href="/safety" style={{ color: LINE_DEEP }}>community guidelines</a>: be kind, be real, and meet new people safely.
              </span>
            </label>
          )}

          {/* CHOOSE THE PACK — opt into the whole pack to open the group chat */}
          {matches.some((m) => !m.connected && !m.iAccepted) && (
            <div style={{ ...card, padding: '1rem 1.2rem', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', marginBottom: '0.6rem', color: 'var(--h-text-dim)', fontSize: '0.92rem' }}>
                <b style={{ color: 'var(--h-text)' }}>choose your pack</b> to open the group chat with everyone in it — the pack is just the room you meet in.
              </div>
              <button onClick={choosePack} disabled={busy || !termsOk}
                style={{ ...poppyBtn, width: '100%', opacity: termsOk ? 1 : 0.45, cursor: termsOk && !busy ? 'pointer' : 'not-allowed' }}>
                {busy ? '…' : '🎒 choose this pack — open the group chat →'}
              </button>
            </div>
          )}

          {matches.some((m) => !m.connected) && (
            <div style={{ ...card, padding: '0.85rem 1.1rem', marginBottom: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem' }}>
              🤝 then make the real <b>connections</b>: tap <b>connect</b> on anyone for a 1:1 — they get a ping, and once they accept you&apos;re connected for good. connect with as many people as you like.
            </div>
          )}

          {/* SEALED PACK — a friendship pack waiting to be opened cinematically */}
          {sealedCount > 0 && !ghosted && (
            <a href="/friends/pack" style={{ display: 'block', textDecoration: 'none', marginBottom: '1.25rem', background: 'linear-gradient(135deg, #e8842b, #c96a18)', border: 'none', borderRadius: 16, padding: '1.1rem 1.25rem', boxShadow: '0 16px 40px -20px rgba(232,132,43,0.6)', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.02em' }}>🎒 you have a pack to open</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.92 }}>{sealedCount} new friend{sealedCount > 1 ? 's' : ''} sealed inside</div>
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', whiteSpace: 'nowrap' }}>open it →</span>
              </div>
            </a>
          )}

          {/* CREW — a deck you swipe through (frees the room below for the chat) */}
          <h2 style={sectionLabel}><StationDot />🎒 your pack</h2>
          {ghosted ? (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: LINE_DEEP, marginBottom: '0.3rem' }}>⏸ your matching is paused</div>
              {hardLocked ? (
                <>
                  <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: '0 0 0.8rem' }}>
                    this has happened a few times now, so we&apos;ve paused your account on both lines. if you think that&apos;s a mistake, email us and we&apos;ll take a look.
                  </p>
                  <a href="mailto:match@notcupid.com" style={{ display: 'inline-block', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', background: INK, border: `1px solid var(--h-border)`, borderRadius: 10, padding: '0.55rem 1rem', boxShadow: `3px 3px 0 ${LINE_DEEP}`, textDecoration: 'none' }}>
                    email match@notcupid.com →
                  </a>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: '0 0 0.8rem' }}>
                    a few of your matches went quiet, so we paused you on both lines to keep things fair. no harm done — your crew &amp; profile stay put. pick back up whenever you&apos;re ready.
                  </p>
                  <ReactivateButton accent={LINE} />
                </>
              )}
            </div>
          ) : cooledUntil !== null ? (
            <div style={{ ...card, padding: '1.4rem 1.25rem', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', color: LINE_DEEP, marginBottom: '0.3rem' }}>⏸ taking a little break</div>
              <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.55, margin: 0 }}>
                you got a few packs and didn&apos;t open up to anyone, so we&apos;ve paused new packs to keep things fresh for everyone.{cooledUntil ? ` you're back on ${new Date(cooledUntil).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.` : ''} your existing chats &amp; connections stay put — and turn on notifications so you don&apos;t miss the next pack.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>the algo is still finding your people — check back soon.</div>
          ) : (
            <>
            <div className="crewDeck">
              {matches.map((m) => (
                <div key={m.otherId} style={{ ...card, padding: 0, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', borderBottom: "1px solid var(--h-border)" }} />
                      : <div style={{ width: '100%', aspectRatio: '1', borderBottom: "1px solid var(--h-border)", background: 'var(--h-surface-3)' }} />}
                    <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(10,8,12,0.72)', backdropFilter: 'blur(4px)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '0.12rem 0.55rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em' }}>{m.score}% match</span>
                  </div>
                  <div style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem' }}>{m.name} <span style={{ color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>· {m.age}</span></div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: m.connected ? '#3f7d57' : (m.theyAccepted && !m.iAccepted) ? '#ff2d8e' : LINE_DEEP, marginBottom: '0.4rem' }}>● {m.connected ? 'in your crew' : m.iAccepted ? 'waiting on them' : m.theyAccepted ? 'wants to connect with you' : 'new match'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: m.connected ? 0 : '0.55rem' }}>
                      {(m.sharedActivities || []).slice(0, 3).map((a: string) => <span key={a} style={chip}>{a}</span>)}
                    </div>
                    {!m.connected && (m.iAccepted ? (
                      <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', border: `2px dashed ${LINE_DEEP}`, borderRadius: 9, padding: '0.45rem' }}>⏳ waiting on them</div>
                    ) : (
                      <button onClick={() => connectOne(m.otherId)} disabled={busy || !termsOk}
                        style={{ width: '100%', cursor: !termsOk ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: termsOk ? 1 : 0.5, background: m.theyAccepted ? '#ff2d8e' : LINE, color: '#fff', border: `1px solid var(--h-border)`, borderRadius: 10, padding: '0.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.03em', boxShadow: `2px 2px 0 ${INK}` }}>
                        {busy ? '…' : m.theyAccepted ? '🤝 accept →' : '🤝 connect'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '-0.2rem' }}>← deck through your crew →</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
              <a href="/friends/pack" style={{ ...poppyBtn, textDecoration: 'none', textAlign: 'center' }}>
                🎒 open another pack · $1.99
              </a>
              <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '0.82rem' }}>group chats are free — a pack is a fresh batch of 7–8 people. <a href="/pro" style={{ color: LINE_DEEP }}>Pro</a> makes packs free.</span>
              <button onClick={leaveCrew} disabled={busy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                {busy ? '…' : 'not your crew? opt out of the group →'}
              </button>
            </div>
            </>
          )}

          {/* LOWER — your card on the left, a roomy group chat on the right */}
          <div className="crewLower">
            {profileSet && me ? (
              <div style={{ ...card, padding: '1rem 1.1rem' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP, marginBottom: '0.5rem' }}>your friend card</div>
                {me.photo_url
                  ? <img src={me.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, border: "1px solid var(--h-border)" }} />
                  : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, border: "1px solid var(--h-border)", background: 'var(--h-surface-3)' }} />}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', lineHeight: 1, marginTop: '0.5rem' }}>{me.name}</div>
                {me.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP }}>{me.archetype}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', margin: '0.5rem 0' }}>
                  {[...me.hobbies, ...me.music, ...me.food].slice(0, 5).map((t) => <span key={t} style={chip}>{t}</span>)}
                </div>
                <a href="/friends/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>edit card →</a>
              </div>
            ) : (
              <a href="/friends/profile" style={{ ...card, display: 'block', padding: '1.1rem', textDecoration: 'none', color: 'var(--h-text)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem' }}>📸</div>
                <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', margin: '0.4rem 0' }}>set up your friend card so crews know it&apos;s you.</div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP }}>set up →</span>
              </a>
            )}

            {/* CHAT — roomy now that the crew is a deck */}
            <div>
              {(chat.circleId || matches.length > 0) && (
                <>
                  <button onClick={() => { setChatOpen((v) => !v); setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80); }}
                    style={{ ...poppyBtn, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💬 group chat</span>
                    <span style={{ fontSize: '0.8rem' }}>{chatOpen ? '▲ hide' : `▾ ${crewRoster.length}`}</span>
                  </button>
                  <div ref={chatRef} />
                  {chatOpen && (
                    <div style={{ ...card, overflow: 'hidden', marginTop: '0.6rem', padding: 0 }}>
                      {/* header + who's-here roster — names, not just avatars */}
                      <div style={{ background: LINE, color: '#fff', padding: '0.6rem 0.85rem 0.7rem', borderBottom: "1px solid var(--h-border)" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}>
                          💬 your crew · {crewRoster.length}
                          <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: chatLive ? '#3f7d57' : 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0.18rem 0.55rem' }}>
                            {chatLive ? '● live' : '○ forming'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginTop: '0.55rem', paddingBottom: '0.1rem' }} className="crewWho">
                          {crewRoster.map((u) => (
                            <span key={u.id} title={u.here ? `${u.name} · in the chat` : `${u.name} · invited`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, background: 'var(--h-surface)', color: 'var(--h-text)', border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.18rem 0.55rem 0.18rem 0.22rem' }}>
                              {u.photo_url
                                ? <img src={u.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: `1px solid var(--h-border)` }} />
                                : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--h-surface-3)', border: `1px solid var(--h-border)`, display: 'inline-block' }} />}
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', whiteSpace: 'nowrap', fontWeight: u.you ? 700 : 400 }}>{u.you ? 'you' : (u.name?.split(' ')[0] || '—')}</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.here ? '#3f7d57' : '#c9a06a', flexShrink: 0 }} />
                            </span>
                          ))}
                        </div>
                      </div>
                      {chatLive ? (<>
                        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', minHeight: 240, maxHeight: 460, overflowY: 'auto' }}>
                          {chat.messages.length === 0 && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem' }}>say hi to the crew 👋</div>}
                          {chat.messages.map((mm: any) => {
                            const sender = chat.members.find((u: any) => u.id === mm.sender_id);
                            return (
                              <div key={mm.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                {sender?.photo_url ? <img src={sender.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)' }} />}
                                <div><span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.5rem', color: 'var(--h-text-dim)' }}>{sender?.name?.split(' ')[0] || '—'}</span>
                                  <div style={{ background: 'var(--h-surface-3)', border: `1px solid var(--h-border)`, borderRadius: 12, padding: '0.45rem 0.75rem', fontSize: '0.9rem', maxWidth: 520 }}>{mm.body}</div></div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem 1.1rem', borderTop: `3px dashed rgba(36,29,18,0.25)` }}>
                          <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="say something to the crew…" style={{ flex: 1, border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.9rem' }} />
                          <button onClick={send} style={{ ...poppyBtn, fontSize: '1.1rem', padding: '0 1rem' }}>→</button>
                        </div>
                      </>) : (
                        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem' }}>🚥</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', margin: '0.3rem 0 0.5rem' }}>chat opens when your crew locks in</div>
                          <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '0.92rem', margin: '0 auto', maxWidth: 420, lineHeight: 1.5 }}>
                            {matches.some((m) => m.iAccepted)
                              ? <>you&apos;re in 🎒 — waiting on the others to say they&apos;re in too. the second they do, this becomes your group thread.</>
                              : <>say <b>“I&apos;m in”</b> above to lock in your crew — then this opens up as your group thread.</>}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {view === 'pulse' && (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={sectionLabel}><StationDot />🌆 city pulse</h2>
          {!pulse ? (
            <div style={{ ...card, padding: '1.1rem 1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>reading the city&apos;s pulse…</div>
          ) : (
            <>
              {/* the live board — three headline numbers */}
              <PulseBoard
                line={LINE} ink={INK} deep={LINE_DEEP}
                stats={[
                  { n: pulse.totalMembers, label: 'on the line', icon: '👥' },
                  { n: pulse.activeGroups, label: pulse.activeGroups === 1 ? 'crew rolling' : 'crews rolling', icon: '🫂' },
                  { n: pulse.liveActivities, label: 'things to do', icon: '📣', onClick: () => { setKindFilter('event'); setView('scene'); } },
                ]}
              />
              {/* where it's buzzing — ranked intensity */}
              <div style={{ ...card, padding: '1rem 1.1rem', marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.7rem' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '0.03em' }}>where it&apos;s buzzing</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginLeft: 'auto' }}>tap to explore</span>
                </div>
                <PulseRanked areas={pulse.areas} line={LINE} ink={INK} deep={LINE_DEEP} onPick={(a) => setAreaFilter(areaFilter === a ? '' : a)} active={areaFilter} />
              </div>
            </>
          )}

          {/* the clicked neighborhood loads right here — no jump to another page */}
          {areaFilter && (
            <div style={{ marginTop: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.7rem' }}>
                <h3 style={{ ...sectionLabel, margin: 0, fontSize: '1.3rem' }}><StationDot />📍 {areaFilter}</h3>
                <button onClick={() => setAreaFilter('')} style={{ ...chip, cursor: 'pointer', marginLeft: 'auto' }}>clear ✕</button>
              </div>
              {(() => { const shown = acts.filter((a) => a.area === areaFilter); return shown.length === 0 ? (
                <div style={{ ...card, padding: '1rem 1.1rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>
                  nothing posted in {areaFilter} yet — <button onClick={() => { setNewAct({ ...newAct, area: areaFilter }); setView('scene'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, textDecoration: 'underline', font: 'inherit', fontStyle: 'italic' }}>start something →</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {shown.map((a) => (
                    <div key={a.id} style={{ ...card, padding: '0.8rem 1rem', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                      {a.authorPhoto ? <img src={a.authorPhoto} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{a.title}</div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span style={chip}>{a.category}</span>
                          {a.happens_at && <span style={chip}>🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}</span>}
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', color: 'var(--h-text-dim)', alignSelf: 'center' }}>by {a.authorName?.split(' ')[0] || '—'}</span>
                        </div>
                      </div>
                      <button onClick={() => rsvp(a.id)} style={{ ...chip, cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.7rem', background: a.iRsvped ? '#ffd23d' : 'var(--h-surface-3)', flexShrink: 0 }}>
                        {a.kind === 'post' ? `👍 ${a.rsvpCount || ''}` : (a.iRsvped ? `in · ${a.rsvpCount}` : `i'm in${a.rsvpCount ? ` · ${a.rsvpCount}` : ''}`)}
                      </button>
                    </div>
                  ))}
                </div>
              ); })()}
            </div>
          )}
        </div>
        )}

        {view === 'scene' && (
        <div>
        <h2 style={sectionLabel}><StationDot />📣 the scene</h2>

        {/* FB-style status composer */}
        <div style={{ ...card, padding: '0.9rem 1rem', marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            {me?.photo_url
              ? <img src={me.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)', flexShrink: 0 }} />}
            <input value={newAct.title} onChange={(e) => setNewAct({ ...newAct, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && !busy && newAct.title.trim() && createAct()}
              placeholder={newAct.kind === 'post' ? `what's on your mind, ${firstName.toLowerCase()}?` : "wanna plan a hang? what's the move?"}
              style={{ flex: 1, minWidth: 0, border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.6rem 1rem', fontSize: '0.95rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.7rem' }}>
            <div style={{ display: 'flex', border: `1px solid var(--h-border)`, borderRadius: 10, overflow: 'hidden' }}>
              {([['post', '💬 saying'], ['event', '📅 plan']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setNewAct({ ...newAct, kind: k })}
                  style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.05em', padding: '0.4rem 0.75rem', border: 'none', cursor: 'pointer', background: newAct.kind === k ? LINE : 'var(--h-surface)', color: newAct.kind === k ? '#fff' : 'var(--h-text)' }}>{label}</button>
              ))}
            </div>
            <select value={newAct.category} onChange={(e) => setNewAct({ ...newAct, category: e.target.value })} style={{ border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} style={{ border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }}>
              <option value="">📍 my area</option>
              {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {newAct.kind === 'event' && (
              <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }} />
            )}
            <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...poppyBtn, marginLeft: 'auto', fontSize: '1.05rem', padding: '0.45rem 1.1rem', opacity: busy || !newAct.title.trim() ? 0.5 : 1 }}>{newAct.kind === 'post' ? 'post →' : 'plan it →'}</button>
          </div>
          {newAct.kind === 'event' && (
            <div style={{ marginTop: '0.7rem', borderTop: `2px dashed rgba(36,29,18,0.18)`, paddingTop: '0.7rem' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, marginBottom: '0.45rem' }}>who&apos;s it open to?</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {([['m', 'men'], ['f', 'women'], ['lgbtq', 'LGBTQ+'], ['nb', 'non-binary']] as const).map(([v, label]) => {
                  const on = newAct.audGenders.includes(v);
                  return (
                    <button key={v} onClick={() => setNewAct((s) => ({ ...s, audGenders: on ? s.audGenders.filter((x) => x !== v) : [...s.audGenders, v] }))}
                      style={{ ...chip, cursor: 'pointer', background: on ? '#ffd23d' : 'var(--h-surface-3)' }}>{on ? '✓ ' : ''}{label}</button>
                  );
                })}
                {newAct.audGenders.length === 0 && <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--h-text-dim)' }}>everyone</span>}
                <span style={{ marginLeft: '0.5rem', fontFamily: "'DM Mono',monospace", fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>age</span>
                <input type="number" min={18} max={120} placeholder="18" value={newAct.audMin} onChange={(e) => setNewAct({ ...newAct, audMin: e.target.value })} style={{ width: 54, border: `1px solid var(--h-border)`, borderRadius: 8, padding: '0.3rem 0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }} />
                <span style={{ color: 'var(--h-text-dim)' }}>–</span>
                <input type="number" min={18} max={120} placeholder="99" value={newAct.audMax} onChange={(e) => setNewAct({ ...newAct, audMax: e.target.value })} style={{ width: 54, border: `1px solid var(--h-border)`, borderRadius: 8, padding: '0.3rem 0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }} />
              </div>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.72rem', color: 'var(--h-text-dim)', marginTop: '0.4rem' }}>pre-filled from who you set out to meet — tweak it per event. only people in range can RSVP. leave blank for everyone.</div>
            </div>
          )}
        </div>

        <div ref={feedRef} />

        {/* filters: kind segmented control + active-area chip */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <div style={{ display: 'flex', border: `1px solid var(--h-border)`, borderRadius: 10, overflow: 'hidden' }}>
            {([['all', 'all'], ['event', '📅 plans'], ['post', '💬 talk']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setKindFilter(k)} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.05em', padding: '0.4rem 0.8rem', border: 'none', cursor: 'pointer', background: kindFilter === k ? LINE : 'var(--h-surface)', color: kindFilter === k ? '#fff' : 'var(--h-text)' }}>{label}</button>
            ))}
          </div>
          {areaFilter && (
            <button onClick={() => setAreaFilter('')} style={{ ...chip, cursor: 'pointer', background: '#ffd23d', display: 'inline-flex', gap: '0.4rem' }}>
              📍 {areaFilter} <span style={{ fontWeight: 800, color: LINE_DEEP }}>×</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={() => setFilterCat('')} style={{ ...chip, cursor: 'pointer', background: filterCat === '' ? '#ffd23d' : 'var(--h-surface-3)' }}>all</button>
          {CATS.map((c) => <button key={c} onClick={() => setFilterCat(c)} style={{ ...chip, cursor: 'pointer', background: filterCat === c ? '#ffd23d' : 'var(--h-surface-3)' }}>{c}</button>)}
        </div>

        {(() => { const shown = acts.filter((a) => (kindFilter === 'all' || (a.kind || 'event') === kindFilter) && (!areaFilter || a.area === areaFilter)); return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {shown.length === 0 && <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>{kindFilter === 'event' ? 'no hangs planned yet — plan one above!' : 'nothing here yet — be the one to start something.'}</div>}
          {shown.map((a) => <ActivityPost key={a.id} a={a} onRsvp={rsvp} onDelete={deleteAct} />)}
        </div>
        ); })()}
        </div>
        )}
          </main>
          <aside className="fbRail">
            <div style={{ ...card, padding: '0.9rem 1rem' }}>
              <div style={sideHd}>🧡 your connections</div>
              {matches.filter((m) => m.connected).length === 0 ? (
                <div style={sideEmpty}>no connections yet — pick someone in your circle to connect.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.55rem' }}>
                  {matches.filter((m) => m.connected).slice(0, 8).map((m) => (
                    <button key={m.otherId} onClick={() => setView('crew')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, color: 'var(--h-text)', textAlign: 'left' }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                        : <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', flexShrink: 0, display: 'inline-block' }} />}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(m.name || '').split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setView('crew')} style={{ marginTop: '0.7rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>open my circle →</button>
            </div>

            <div style={{ ...card, padding: '0.9rem 1rem', marginTop: '0.85rem' }}>
              <div style={sideHd}>📍 around in {city ? city.split(',')[0].toLowerCase() : 'your city'}</div>
              {people.length === 0 ? <div style={sideEmpty}>finding who&apos;s around…</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.55rem' }}>
                  {people.slice(0, 8).map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                        : <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', flexShrink: 0, display: 'inline-block' }} />}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name?.split(' ')[0] || '—'}</span>
                      {p.tag && <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-accent)', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.1rem 0.4rem', flexShrink: 0 }}>{p.tag}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div style={{ maxWidth: 470, margin: '2.75rem auto 0', background: 'var(--h-surface)', border: `1px solid var(--h-border)`, borderRadius: 16, boxShadow: `4px 4px 0 ${INK}`, padding: '1rem 1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            <button onClick={sendFeedback} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text)', textDecoration: 'underline', textUnderlineOffset: 4 }}>💬 send feedback</button>
            <a href="/friends/how-it-works" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text)', textDecoration: 'underline', textUnderlineOffset: 4 }}>✨ what&apos;s new</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.85rem' }}>
            {[['instagram', 'https://instagram.com/notcupidapp'], ['tiktok', 'https://tiktok.com/@notcupid11'], ['x', 'https://x.com/notcupidapp']].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'lowercase', color: LINE_DEEP, textDecoration: 'none' }}>↗ {label}</a>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.85rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>
            © {new Date().getFullYear()} notcupid · a lemon labs property
          </div>
        </div>
      </div>
    </div>
  );
}
