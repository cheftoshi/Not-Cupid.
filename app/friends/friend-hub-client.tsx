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
// Activity-rich categories — what people actually do together (fitness/sports
// lead, then social/culture). Drives the Scene filter chips + the post composer.
const CATS = ['fitness', 'gym', 'running', 'tennis', 'pickleball', 'sports', 'outdoors', 'food', 'coffee', 'drinks', 'movies', 'concerts', 'music', 'arts', 'books', 'games', 'chill'];

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

// City Pulse zones as BUBBLES — each neighborhood a teal bubble sized + glowing by
// how much is happening (members + events). Tap one to load its active events.
function ZoneBubbles({ areas, onPick, active }: { areas: any[]; onPick: (a: string) => void; active: string }) {
  const scored = [...areas]
    .map((a) => ({ ...a, score: (a.members || 0) + (a.activities || 0) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);
  if (!scored.length) return <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>quiet out there right now — be the first to start something.</div>;
  const max = Math.max(1, ...scored.map((a) => a.score));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0' }}>
      {scored.map((a) => {
        const sel = active === a.area;
        const size = 56 + Math.round((a.score / max) * 58); // 56–114px
        return (
          <button key={a.area} onClick={() => onPick(a.area)} title={`${a.activities || 0} events · ${a.members || 0} here`}
            style={{ width: size, height: size, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', border: `1px solid ${sel ? 'var(--h-accent)' : 'var(--h-border)'}`, background: sel ? 'var(--h-accent)' : 'var(--h-surface-2)', color: sel ? '#0c2029' : 'var(--h-text)', boxShadow: sel ? '0 0 0 4px rgba(79,214,200,0.22)' : `0 0 ${10 + Math.round((a.score / max) * 22)}px -4px rgba(79,214,200,0.45)`, padding: '0.3rem' }}>
            <span style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: size > 84 ? '0.74rem' : '0.6rem', fontWeight: 600, lineHeight: 1.04, overflow: 'hidden' }}>{a.area}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', opacity: 0.82, marginTop: '0.15rem' }}>{a.activities ? `${a.activities} ev` : `${a.members || 0}👥`}</span>
          </button>
        );
      })}
    </div>
  );
}

// Scene categories — the activity filter as choice "bubbles" with mini sub-tags
// (movies, concerts, fitness, sports… each opens its own tags). Tags map to the
// stored activity `category` values (CATS).
const SCENE_CATS: { key: string; icon: string; label: string; tags: string[] }[] = [
  { key: 'fitness', icon: '💪', label: 'fitness', tags: ['fitness', 'gym', 'running', 'yoga'] },
  { key: 'sports', icon: '🎾', label: 'sports', tags: ['sports', 'tennis', 'pickleball'] },
  { key: 'movies', icon: '🎬', label: 'movies', tags: ['movies'] },
  { key: 'concerts', icon: '🎶', label: 'concerts', tags: ['concerts', 'music'] },
  { key: 'food', icon: '🍜', label: 'food & drink', tags: ['food', 'coffee', 'drinks'] },
  { key: 'culture', icon: '🎨', label: 'culture', tags: ['arts', 'books', 'games', 'chill', 'outdoors'] },
];
function SceneCats({ main, setMain, sub, setSub }: { main: string; setMain: (m: string) => void; sub: string; setSub: (s: string) => void }) {
  return (
    <div style={{ ...card, padding: '0.95rem 1rem' }}>
      <div style={sideHd}>🎟️ what are you into?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.65rem' }}>
        {SCENE_CATS.map((c) => {
          const on = main === c.key;
          return (
            <div key={c.key}>
              <button onClick={() => { setMain(on ? '' : c.key); setSub(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: on ? 'var(--h-accent)' : 'var(--h-surface-2)', color: on ? '#0c2029' : 'var(--h-text)', border: `1px solid ${on ? 'var(--h-accent)' : 'var(--h-border)'}`, borderRadius: 999, padding: '0.45rem 0.95rem', cursor: 'pointer', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '0.88rem', fontWeight: 600 }}>
                {c.icon} {c.label}
              </button>
              {on && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem', margin: '0.5rem 0 0.3rem 0.4rem' }}>
                  {c.tags.map((t) => (
                    <button key={t} onClick={() => setSub(sub === t ? '' : t)} style={{ ...chip, cursor: 'pointer', background: sub === t ? 'var(--h-accent)' : 'var(--h-surface-3)', color: sub === t ? '#0c2029' : 'var(--h-text-dim)' }}>{sub === t ? '✓ ' : ''}{t}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The backdrop IS the conversation — rising comic speech bubbles (the city's group
// chat). Canvas; reduced-motion still-frame; pauses when the tab's hidden.
function ConnectionBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(1.4, window.devicePixelRatio || 1);
    let w = 1, h = 1;
    // The backdrop IS the conversation — catchy, real things people say to make
    // plans, rising like the whole city's group chat. (Dropped the tech node-
    // network — it read "crypto dashboard," not a warm social app. This is human.)
    const SAYS = [
      'who’s down for pickleball? 🎾', 'coffee this week? ☕', 'new in town — say hi 👋',
      'sat morning run? 🏃', 'movie night, who’s in? 🎬', 'starting a book club 📚',
      'let’s actually hang irl', 'friends > swiping', 'gym buddy wanted 💪',
      'concert friday? 🎶', 'taco tuesday? 🌮', 'beach day this weekend? 🏖️',
      'looking for a hiking crew ⛰️', 'board game night? 🎲', 'ramen run, anyone? 🍜',
      'tennis at the park? 🎾', 'pottery class — join me 🎨', 'find your people 🧡',
      'who wants to grab a drink?', 'farmers market sunday? 🥕', 'climbing gym buddy?',
    ];
    const PAL = ['#ff6a1f', '#2563ff', '#e0457f', '#1f9e6e', '#8b46d6']; // vibey bubble colors
    const EMOJI = /[\uD800-\uDBFF☀-➿⬀-⯿]/; // emoji surrogates + symbol ranges (no /u flag — ES5 target)
    type Bub = { x: number; y: number; text: string; emoji: boolean; c: number; rot: number; speed: number };
    let bubs: Bub[] = [];
    let nextSpawn = 0;
    const roundRect = (x: number, y: number, bw: number, bh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + bh, r); ctx.arcTo(x + bw, y + bh, x, y + bh, r);
      ctx.arcTo(x, y + bh, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.closePath();
    };
    const spawn = (seed = false) => {
      const text = SAYS[(Math.random() * SAYS.length) | 0];
      bubs.push({
        x: 0.08 + Math.random() * 0.84,
        y: seed ? 0.12 + Math.random() * 0.8 : 1.08,
        text, emoji: EMOJI.test(text),
        c: (Math.random() * 5) | 0, rot: (Math.random() - 0.5) * 0.1,
        speed: 0.0016 + Math.random() * 0.0013,
      });
    };
    const size = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    if (!reduce) for (let i = 0; i < 8; i++) spawn(true);
    let raf = 0, last = 0, on = true;
    const draw = (ts: number) => {
      if (!on) return;
      raf = requestAnimationFrame(draw);
      if (ts - last < 34) return; last = ts; // ~30fps
      ctx.clearRect(0, 0, w, h);
      if (!reduce) { nextSpawn -= 1; if (nextSpawn <= 0 && bubs.length < 15) { spawn(); nextSpawn = 14 + ((Math.random() * 20) | 0); } }
      ctx.font = "600 13.5px ui-sans-serif, system-ui, -apple-system, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = bubs.length - 1; k >= 0; k--) {
        const bb = bubs[k];
        if (!reduce) bb.y -= bb.speed; // rise
        if (bb.y < -0.08) { bubs.splice(k, 1); continue; }
        const alpha = Math.max(0, Math.min(1, bb.y > 0.96 ? (1.08 - bb.y) / 0.12 : bb.y < 0.12 ? bb.y / 0.12 : 0.95));
        // canvas measureText under-reports emoji advance width → pad extra when the
        // line has one, cap to the viewport, and keep the whole bubble on-screen.
        const bw = Math.min(w - 18, ctx.measureText(bb.text).width + (bb.emoji ? 44 : 26));
        const bh = 32, r = Math.min(16, bw / 2 - 1);
        const cx = Math.max(bw / 2 + 8, Math.min(w - bw / 2 - 8, bb.x * w));
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(bb.y * h)); ctx.rotate(bb.rot); ctx.globalAlpha = alpha;
        const col = PAL[bb.c];
        ctx.shadowColor = 'rgba(120,70,30,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
        roundRect(-bw / 2, -bh - 9, bw, bh, r); ctx.fillStyle = '#fffaf3'; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(0, -1); ctx.lineTo(7, -10); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); // tail nub
        roundRect(-bw / 2, -bh - 9, bw, bh, r); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.fillStyle = col; ctx.fillText(bb.text, 0, -bh / 2 - 9);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => { on = !document.hidden; if (on) { last = 0; raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { on = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(100% 55% at 50% -10%, rgba(255,150,70,0.10), transparent 60%), radial-gradient(85% 50% at 100% 110%, rgba(37,99,255,0.06), transparent 55%)' }} />
      {/* faint warm dot-grid + grain so the field has texture, not a plain wash */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(150,110,60,0.13) 1px, transparent 1.5px)', backgroundSize: '23px 23px', WebkitMaskImage: 'radial-gradient(135% 110% at 50% -8%, #000 50%, transparent 92%)', maskImage: 'radial-gradient(135% 110% at 50% -8%, #000 50%, transparent 92%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'multiply', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")", backgroundSize: '160px 160px' }} />
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
function HomeFeed({ me, firstName, activeGroups, popular, hasCrew, onCrew, onScene, onRsvp, onDelete, onOpen }: {
  me?: any; firstName: string; activeGroups: number; popular: any[]; hasCrew: boolean; onCrew: () => void; onScene: () => void; onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void; onDelete: (id: string) => void; onOpen: (v: NavKey) => void;
}) {
  return (
    <div>
      <div style={{ ...card, padding: '0.85rem 1rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        {me?.photo_url
          ? <img src={me.photo_url} alt="" style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
          : <div style={{ width: 58, height: 58, borderRadius: 14, border: '1px solid var(--h-border)', background: 'var(--h-surface-3)', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.55rem', lineHeight: 1.05 }}>{me?.name || firstName}</div>
          {me?.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP }}>{me.archetype}</div>}
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
      <div style={{ borderTop: '1px solid var(--h-border)', padding: '0.45rem 0.6rem' }}>
        {!isEvent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            {(a.rsvpCount || 0) >= 3
              ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#d2530f', background: 'rgba(255,106,31,0.12)', border: '1px solid rgba(255,106,31,0.32)', borderRadius: 999, padding: '0.18rem 0.55rem' }}>🔥 popular</span>
              : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: 'var(--h-text-faint)' }}>{a.rsvpCount ? `${a.rsvpCount} into this` : 'be the first'}</span>}
            <button onClick={() => onRsvp(a.id)} title={a.iRsvped ? 'you’re into this' : 'i’m into this'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: a.iRsvped ? 'var(--h-accent)' : 'var(--h-surface-2)', color: a.iRsvped ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${a.iRsvped ? 'var(--h-accent)' : 'var(--h-border)'}`, borderRadius: 999, padding: '0.3rem 0.75rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700 }}>
              {a.iRsvped ? '♥' : '♡'} {a.rsvpCount || 0}
            </button>
          </div>
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
  const [termsChecked, setTermsChecked] = useState(false); // localStorage read done? (avoids a modal flash)
  const [ghosted, setGhosted] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [chat, setChat] = useState<any>({ circleId: null, members: [], messages: [] });
  const [pulse, setPulse] = useState<any>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState<string>(''); // selected sub-tag (exact category)
  const [filterMain, setFilterMain] = useState<string>(''); // selected main category bubble
  const [kindFilter, setKindFilter] = useState<'all' | 'post' | 'event'>('all');
  const [sceneSort, setSceneSort] = useState<'new' | 'popular'>('new');
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
    const r = await fetch('/api/friend/activities'); // fetch all; category filtering is client-side now (mains group several)
    if (r.ok) setActs((await r.json()).activities || []);
  }, []);
  useEffect(() => { try { if (localStorage.getItem('nc-friend-terms') === '1') setTermsOk(true); } catch { /* ignore */ } setTermsChecked(true); }, []);

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
    <div className="friendDark" style={{ minHeight: '100vh', background: 'radial-gradient(95% 65% at 4% 0%, #f6d4b4 0%, transparent 46%), radial-gradient(90% 60% at 99% 5%, #f4cadd 0%, transparent 44%), radial-gradient(120% 80% at 50% 116%, #c9d9f5 0%, transparent 54%), #f0e4d0', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif', position: 'relative', overflow: 'hidden' }}>
      <ConnectionBackdrop />

      {/* T&C GATE — a blocking pop-up; you agree once before you can use the friend line */}
      {termsChecked && !termsOk && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(24,14,6,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'var(--h-surface)', borderRadius: 20, maxWidth: 440, width: '100%', padding: '1.7rem 1.6rem', boxShadow: '0 34px 90px -22px rgba(0,0,0,0.55)', border: '1px solid var(--h-border)' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.1rem', color: 'var(--h-text)', lineHeight: 1 }}>before you dive in 🧡</div>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.95rem', color: 'var(--h-text-dim)', lineHeight: 1.6, margin: '0.7rem 0 1.2rem' }}>
              the friend line is about meeting real people. by continuing you agree to NotCupid&apos;s <a href="/terms" style={{ color: LINE_DEEP }}>terms</a> &amp; <a href="/safety" style={{ color: LINE_DEEP }}>community guidelines</a> — be kind, be real, and meet new people safely.
            </p>
            <button onClick={agreeTerms} style={{ ...poppyBtn, width: '100%', fontSize: '1.25rem' }}>I agree — let me in →</button>
            <a href="/hub" style={{ display: 'block', textAlign: 'center', marginTop: '0.75rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)', textDecoration: 'none' }}>not now — back to hub</a>
          </div>
        </div>
      )}

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
        /* Scene = filters/categories on the LEFT, the feed in the MIDDLE (pack + around live in the shared right rail). */
        .sceneGrid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 760px) {
          .sceneGrid { grid-template-columns: 215px minmax(0,1fr); align-items: start; }
          .sceneLeft { position: sticky; top: 1rem; }
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
        .crewLower { margin-top: 1.5rem; }
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
          <HomeFeed me={me} firstName={firstName} activeGroups={activeGroups} popular={myEvents} hasCrew={matches.length > 0}
            onCrew={() => setView('crew')} onScene={() => setView('scene')} onRsvp={rsvp} onDelete={deleteAct} onOpen={setView} />
        )}

        {view === 'crew' && (
        <div>
          {/* YOUR FRIEND CARD — on top, so the page leads with you */}
          {profileSet && me ? (
            <div style={{ ...card, padding: '0.85rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              {me.photo_url
                ? <img src={me.photo_url} alt="" style={{ width: 66, height: 66, borderRadius: 14, objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                : <div style={{ width: 66, height: 66, borderRadius: 14, border: '1px solid var(--h-border)', background: 'var(--h-surface-3)', flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP }}>your friend card</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', lineHeight: 1.05 }}>{me.name}{me.archetype && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: LINE_DEEP, marginLeft: '0.5rem' }}>{me.archetype}</span>}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {[...me.hobbies, ...me.music, ...me.food].slice(0, 5).map((t) => <span key={t} style={chip}>{t}</span>)}
                </div>
              </div>
              <a href="/friends/profile" style={{ flexShrink: 0, alignSelf: 'flex-start', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>edit →</a>
            </div>
          ) : (
            <a href="/friends/profile" style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem 1rem', marginBottom: '1.2rem', textDecoration: 'none', color: 'var(--h-text)' }}>
              <span style={{ fontSize: '1.6rem' }}>📸</span>
              <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>set up your friend card so crews know it&apos;s you.</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: LINE_DEEP }}>set up →</span>
            </a>
          )}

          {/* PAUSED / EMPTY / CHOOSE-PACK — your pack itself lives in the right rail */}
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
          ) : matches.some((m) => !m.connected && !m.iAccepted) ? (
            <div style={{ ...card, padding: '1rem 1.2rem', marginBottom: '1.1rem' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', marginBottom: '0.6rem', color: 'var(--h-text-dim)', fontSize: '0.92rem' }}>
                <b style={{ color: 'var(--h-text)' }}>choose your pack</b> to open the group chat with everyone — then tap <b>connect</b> on anyone in <b>your pack</b> (over on the right) for a 1:1.
              </div>
              <button onClick={choosePack} disabled={busy || !termsOk}
                style={{ ...poppyBtn, width: '100%', opacity: termsOk ? 1 : 0.45, cursor: termsOk && !busy ? 'pointer' : 'not-allowed' }}>
                {busy ? '…' : '🎒 choose this pack — open the group chat →'}
              </button>
            </div>
          ) : null}

          {/* LOWER — the group chat, full-width now (friend card lives up top) */}
          <div className="crewLower">
            {/* CHAT — roomy, full-width */}
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
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', margin: '-0.3rem 0 1rem', fontSize: '0.92rem' }}>
            the city&apos;s social life — where it&apos;s happening, what&apos;s on, who&apos;s gathering. tap a zone to dive in.
          </p>
          {!pulse ? (
            <div style={{ ...card, padding: '1.1rem 1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>reading the city&apos;s pulse…</div>
          ) : (
            <>
              {/* the live board — three headline numbers */}
              <PulseBoard
                line={LINE} ink={INK} deep={LINE_DEEP}
                stats={[
                  { n: pulse.totalMembers, label: 'on the line', icon: '👥' },
                  { n: pulse.activeGroups, label: pulse.activeGroups === 1 ? 'circle live' : 'circles live', icon: '🫂' },
                  { n: pulse.liveActivities, label: 'things to do', icon: '📣', onClick: () => { setKindFilter('event'); setView('scene'); } },
                ]}
              />
              {/* where it's happening — neighborhoods as bubbles (tap → events) */}
              <div style={{ ...card, padding: '1.1rem 1.1rem 1.25rem', marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '0.03em' }}>where it&apos;s happening</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginLeft: 'auto' }}>tap a zone</span>
                </div>
                <ZoneBubbles areas={pulse.areas} onPick={(a) => setAreaFilter(areaFilter === a ? '' : a)} active={areaFilter} />
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
                      <button onClick={() => rsvp(a.id)} style={{ ...chip, cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.7rem', background: a.iRsvped ? 'var(--h-accent)' : 'var(--h-surface-3)', color: a.iRsvped ? '#0c2029' : 'var(--h-text-dim)', flexShrink: 0 }}>
                        {a.kind === 'post' ? `✦ ${a.rsvpCount || ''}` : (a.iRsvped ? `in · ${a.rsvpCount}` : `i'm in${a.rsvpCount ? ` · ${a.rsvpCount}` : ''}`)}
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

        <div className="sceneGrid">
          <aside className="sceneLeft">
            <div style={{ ...card, padding: '0.85rem 0.9rem' }}>
              <div style={sideHd}>show</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.55rem' }}>
                {([['all', 'all'], ['event', '📅 plans'], ['post', '💬 talk']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setKindFilter(k)} style={{ textAlign: 'left', fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', letterSpacing: '0.05em', padding: '0.45rem 0.7rem', border: `1px solid ${kindFilter === k ? LINE : 'var(--h-border)'}`, borderRadius: 9, cursor: 'pointer', background: kindFilter === k ? LINE : 'var(--h-surface-2)', color: kindFilter === k ? '#fff' : 'var(--h-text-dim)' }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.7rem' }}>
                {([['new', '🆕 new'], ['popular', '🔥 popular']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSceneSort(k)} style={{ flex: 1, fontFamily: "'DM Mono',monospace", fontSize: '0.58rem', letterSpacing: '0.02em', padding: '0.4rem 0.3rem', border: `1px solid ${sceneSort === k ? 'var(--h-accent)' : 'var(--h-border)'}`, borderRadius: 9, cursor: 'pointer', background: sceneSort === k ? 'var(--h-accent)' : 'var(--h-surface-2)', color: sceneSort === k ? '#fff' : 'var(--h-text-dim)' }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '0.85rem' }}>
              <SceneCats main={filterMain} setMain={setFilterMain} sub={filterCat} setSub={setFilterCat} />
            </div>
          </aside>

          <div className="sceneMid">
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

            {/* active filter chips — the kind/sort/category controls live in the left rail */}
            {(filterMain || filterCat || areaFilter) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              {(filterMain || filterCat) && (
                <button onClick={() => { setFilterMain(''); setFilterCat(''); }} style={{ ...chip, cursor: 'pointer', background: 'var(--h-accent)', color: '#0c2029', display: 'inline-flex', gap: '0.4rem' }}>
                  {filterCat || filterMain} <span style={{ fontWeight: 800 }}>×</span>
                </button>
              )}
              {areaFilter && (
                <button onClick={() => setAreaFilter('')} style={{ ...chip, cursor: 'pointer', background: 'var(--h-accent)', color: '#0c2029', display: 'inline-flex', gap: '0.4rem' }}>
                  📍 {areaFilter} <span style={{ fontWeight: 800 }}>×</span>
                </button>
              )}
            </div>
            )}

            {(() => {
              const subTags = filterMain ? (SCENE_CATS.find((c) => c.key === filterMain)?.tags || []) : [];
              const shown = acts.filter((a) =>
                (kindFilter === 'all' || (a.kind || 'event') === kindFilter) &&
                (!areaFilter || a.area === areaFilter) &&
                (filterCat ? a.category === filterCat : filterMain ? subTags.includes(a.category) : true))
                .sort((a, b) => sceneSort === 'popular'
                  ? ((b.rsvpCount || 0) - (a.rsvpCount || 0)) || String(b.created_at || '').localeCompare(String(a.created_at || ''))
                  : String(b.created_at || '').localeCompare(String(a.created_at || '')));
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {shown.length === 0 && <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>{kindFilter === 'event' ? 'no plans here yet — start one above!' : 'nothing here yet — be the one to start something.'}</div>}
                  {shown.map((a) => <ActivityPost key={a.id} a={a} onRsvp={rsvp} onDelete={deleteAct} />)}
                </div>
              );
            })()}
          </div>
        </div>
        </div>
        )}
          </main>
          <aside className="fbRail">
            {view !== 'scene' && (
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
            )}

            {/* CREW VIEW — your pack lives here on the right */}
            {view === 'crew' && !ghosted && cooledUntil === null && matches.length > 0 && (
            <div style={{ ...card, padding: '0.9rem 1rem', marginTop: '0.85rem' }}>
              <div style={sideHd}>🎒 your pack</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
                {matches.map((m) => (
                  <div key={m.otherId} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt="" style={{ width: 42, height: 42, borderRadius: 11, objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                      : <span style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', flexShrink: 0, display: 'inline-block' }} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name} <span style={{ color: 'var(--h-text-faint)', fontSize: '0.7rem' }}>· {m.age}</span></div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: m.connected ? '#3f7d57' : (m.theyAccepted && !m.iAccepted) ? '#ff2d8e' : 'var(--h-text-faint)' }}>{m.score}% · {m.connected ? 'in your crew' : m.iAccepted ? 'waiting' : m.theyAccepted ? 'wants you' : 'new'}</div>
                    </div>
                    {m.connected ? (
                      <span style={{ flexShrink: 0, fontSize: '0.95rem', color: '#3f7d57' }}>✓</span>
                    ) : m.iAccepted ? (
                      <span style={{ flexShrink: 0, fontSize: '0.85rem' }}>⏳</span>
                    ) : (
                      <button onClick={() => connectOne(m.otherId)} disabled={busy || !termsOk}
                        style={{ flexShrink: 0, cursor: !termsOk ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: termsOk ? 1 : 0.5, background: m.theyAccepted ? '#ff2d8e' : LINE, color: '#fff', border: 'none', borderRadius: 8, padding: '0.32rem 0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                        {m.theyAccepted ? 'accept' : 'connect'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {sealedCount > 0 && (
                <a href="/friends/pack" style={{ display: 'block', marginTop: '0.8rem', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(135deg, #e8842b, #c96a18)', color: '#fff', borderRadius: 10, padding: '0.55rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.02em' }}>🎒 open sealed pack ({sealedCount}) →</a>
              )}
              <a href="/friends/pack" style={{ ...poppyBtn, display: 'block', marginTop: '0.7rem', textAlign: 'center', textDecoration: 'none', fontSize: '0.95rem', padding: '0.5rem' }}>open another pack · $1.99</a>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-faint)', fontSize: '0.66rem', marginTop: '0.5rem', textAlign: 'center' }}>first pack free · <a href="/pro" style={{ color: LINE_DEEP }}>Pro</a> makes packs free</div>
              <button onClick={leaveCrew} disabled={busy} style={{ display: 'block', width: '100%', marginTop: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: 3 }}>{busy ? '…' : 'opt out of the group →'}</button>
            </div>
            )}

            {view === 'scene' && (
            <div style={{ ...card, padding: '0.9rem 1rem' }}>
              <div style={sideHd}>🎒 my pack</div>
              {matches.length === 0 ? (
                <div style={sideEmpty}>your pack is forming — check back soon.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' }}>
                    {matches.slice(0, 8).map((m) => (
                      m.photo_url
                        ? <img key={m.otherId} src={m.photo_url} alt="" title={(m.name || '').split(' ')[0]} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)' }} />
                        : <span key={m.otherId} title={(m.name || '').split(' ')[0]} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', display: 'inline-block' }} />
                    ))}
                  </div>
                  <button onClick={() => setView('crew')} style={{ marginTop: '0.7rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>open my circle →</button>
                </>
              )}
            </div>
            )}

            {view === 'scene' && (
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
            )}
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
