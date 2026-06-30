'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { NEIGHBORHOODS } from '@/lib/neighborhoods';
import ReactivateButton from '@/components/reactivate-button';
import LocationControls from '@/components/location-controls';
import { ConnectionSigil } from '@/components/connection-ui';

// ── Friend Line theme (warm MBTA transit) ──
const INK = '#0b0b0b';           // brand ink (signage) — aligned to the app ink
const LINE = '#ff6a1f';          // the Friend Line — BRAND orange (was off-brand #e8842b)
const LINE_DEEP = '#d2530f';     // brand orange-deep for shadows/hover
const CREAM = 'var(--h-surface)'; // warm station-tile cream → themed surface
// Activity-rich categories — what people actually do together (fitness/sports
// lead, then social/culture). Drives the Scene filter chips + the post composer.
const CATS = ['fitness', 'gym', 'running', 'tennis', 'pickleball', 'sports', 'outdoors', 'food', 'coffee', 'drinks', 'movies', 'concerts', 'music', 'arts', 'books', 'games', 'chill'];
// Guided composer — "what do you want to do?" cards (set category + kind + a title hint).
const WHAT_CARDS: { label: string; emoji: string; category: string; kind: 'post' | 'event'; ph: string }[] = [
  { label: 'Grab food', emoji: '🍜', category: 'food', kind: 'event', ph: 'grabbing food — who’s in?' },
  { label: 'Coffee / walk', emoji: '☕', category: 'coffee', kind: 'event', ph: 'coffee + a walk?' },
  { label: 'Drinks', emoji: '🍸', category: 'drinks', kind: 'event', ph: 'drinks later?' },
  { label: 'Sports', emoji: '🎾', category: 'sports', kind: 'event', ph: 'pickup game — beginners welcome' },
  { label: 'Movie / Show', emoji: '🎬', category: 'movies', kind: 'event', ph: 'movie night?' },
  { label: 'Explore the city', emoji: '🧭', category: 'outdoors', kind: 'event', ph: 'wander the city?' },
  { label: 'Just talk', emoji: '💬', category: 'chill', kind: 'post', ph: 'what’s on your mind?' },
  { label: 'Custom', emoji: '✨', category: 'chill', kind: 'event', ph: 'what’s the move?' },
];
// Format a Date → datetime-local string (YYYY-MM-DDTHH:mm), for the composer.
function localDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Flat interest chips for the Scene — each maps to a set of stored categories
// (the last two are vibe-based: low-pressure = coffee/chill, new-in-town = chill).
const SCENE_INTERESTS: { label: string; emoji: string; cats: string[] }[] = [
  { label: 'Food & Drink', emoji: '🍜', cats: ['food', 'coffee', 'drinks'] },
  { label: 'Sports', emoji: '🎾', cats: ['sports', 'tennis', 'pickleball', 'running', 'outdoors'] },
  { label: 'Movies', emoji: '🎬', cats: ['movies'] },
  { label: 'Concerts', emoji: '🎵', cats: ['concerts', 'music'] },
  { label: 'Art & Culture', emoji: '🎨', cats: ['arts', 'books'] },
  { label: 'Fitness', emoji: '💪', cats: ['fitness', 'gym'] },
  { label: 'New in town', emoji: '🧭', cats: ['chill', 'coffee'] },
  { label: 'Low-pressure hangs', emoji: '☕', cats: ['coffee', 'chill'] },
];
const CAT_EMOJI: Record<string, string> = {
  fitness: '🏋️', gym: '💪', running: '🏃', tennis: '🎾', pickleball: '🥒', sports: '⚽', outdoors: '⛰️',
  food: '🍜', coffee: '☕', drinks: '🍸', movies: '🎬', concerts: '🎶', music: '🎵', arts: '🎨',
  books: '📚', games: '🎲', chill: '🛋️', hang: '🧡', other: '✨',
};
const CLUB_CATS = ['running', 'books', 'fitness', 'sports', 'food', 'coffee', 'movies', 'music', 'arts', 'games', 'outdoors', 'other'];
const LINK_KINDS = ['discord', 'whatsapp', 'groupme', 'telegram', 'slack', 'other'];
const KIND_EMOJI: Record<string, string> = { discord: '🎮', whatsapp: '💬', groupme: '👥', telegram: '✈️', slack: '💼', other: '🔗' };

// Calm chrome: thin borders + soft shadows (was 3px ink borders + hard 5px offset
// shadows — too loud). Surfaces read quiet so the content + connections lead.
const card: React.CSSProperties = { background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)' };
const chip: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.22rem 0.6rem', color: 'var(--h-text-dim)' };
// Section headers: a small connection-node + a calmer (smaller) display size.
const sectionLabel: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.05em', margin: '1.7rem 0 0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--h-text)' };
const poppyBtn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', color: '#fff', background: LINE, border: 'none', borderRadius: 'var(--r-pill)', padding: '0.6rem 1.5rem', boxShadow: '0 12px 26px -14px rgba(255,106,31,0.55)', cursor: 'pointer', transition: 'transform .2s var(--ease), box-shadow .2s var(--ease)' };
const inputStyle: React.CSSProperties = { border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.5rem 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', background: 'var(--h-surface)', color: 'var(--h-text)', outline: 'none' };
const pulseBtn: React.CSSProperties = { background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-text-dim)', fontWeight: 700 };
const pulseBtnGhost: React.CSSProperties = { background: 'transparent', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-text-dim)' };
// A small filled node (the connection motif), not a chunky station ring.
const StationDot = () => <span style={{ width: 7, height: 7, borderRadius: '50%', background: LINE, flexShrink: 0, display: 'inline-block' }} />;

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
      'concert friday? 🎶', 'ball game tuesday? ⚾', 'beach day this weekend? 🌊',
      'looking for a hiking crew 🌲', 'board game night? 🎲', 'ramen run, anyone? 🍜',
      'tennis at the park? 🎾', 'pottery class — join me 🎨', 'find your people 🧡',
      'who wants to grab a drink?', 'farmers market sunday? 🥕', 'climbing gym buddy?',
    ];
    const PAL = ['#ff6a1f', '#2563ff', '#e0457f', '#1f9e6e', '#8b46d6']; // vibey bubble colors
    const EMOJI = /[\uD800-\uDBFF☀-➿⬀-⯿]/; // emoji surrogates + symbol ranges (no /u flag — ES5 target)
    type Bub = { x: number; y: number; text: string; emoji: boolean; c: number; rot: number; speed: number };
    let bubs: Bub[] = [];
    let nextSpawn = 0;
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
    const size = () => { w = cv.clientWidth || window.innerWidth; h = cv.clientHeight || window.innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    for (let i = 0; i < 9; i++) spawn(true); // seed always → reduced-motion still shows a frame
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
        const bw = Math.max(64, Math.min(w - 18, ctx.measureText(bb.text).width + (bb.emoji ? 44 : 26)));
        const bh = 32, r = Math.min(15, bw / 2 - 1), tx = -bw / 2 + 24;
        const cx = Math.max(bw / 2 + 8, Math.min(w - bw / 2 - 8, bb.x * w));
        // one continuous path: rounded body + an integrated pointer tail (a real
        // speech bubble, not a colored nub stuck on the bottom).
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(-bw / 2 + r, -bh - 9);
          ctx.arcTo(bw / 2, -bh - 9, bw / 2, -9, r);
          ctx.arcTo(bw / 2, -9, -bw / 2, -9, r);
          ctx.lineTo(tx + 8, -9); ctx.lineTo(tx, -1); ctx.lineTo(tx - 8, -9);
          ctx.lineTo(-bw / 2 + r, -9);
          ctx.arcTo(-bw / 2, -9, -bw / 2, -bh - 9, r);
          ctx.arcTo(-bw / 2, -bh - 9, bw / 2, -bh - 9, r);
          ctx.closePath();
        };
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(bb.y * h)); ctx.rotate(bb.rot); ctx.globalAlpha = alpha;
        const col = PAL[bb.c];
        ctx.shadowColor = 'rgba(120,70,30,0.20)'; ctx.shadowBlur = 11; ctx.shadowOffsetY = 4;
        path(); ctx.fillStyle = '#fffaf3'; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        path(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
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
  { key: 'home', icon: '✨', label: 'today' },
  { key: 'scene', icon: '🎟️', label: 'the scene' },
  { key: 'crew', icon: '🧡', label: 'my circle' },
  { key: 'pulse', icon: '🌆', label: 'city pulse' },
];
const sideHd: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP, fontWeight: 700 };
const sideEmpty: React.CSSProperties = { fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.82rem', marginTop: '0.4rem' };
const miniCount: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999, background: LINE, color: '#fff', border: `1px solid var(--h-border)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

type Person = { id: string; name: string; photo_url: string | null; tag?: string };

// Friendly "when" — Tonight · 6:30 PM / Tomorrow / Saturday · 10 AM / Jul 8.
function friendlyWhen(iso?: string | null): string {
  if (!iso) return 'anytime';
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diff === 0) return `${d.getHours() >= 17 ? 'Tonight' : 'Today'} · ${time}`;
  if (diff === 1) return `Tomorrow · ${time}`;
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}
// "For: …" vibe descriptor from the plan's category.
const VIBE_FOR: Record<string, string> = {
  coffee: 'low-pressure first hangs', chill: 'low-key, no pressure', food: 'food & drink people',
  drinks: 'after-work crowd', running: 'active mornings', tennis: 'beginner-friendly',
  pickleball: 'beginner-friendly', sports: 'active crowd', fitness: 'active crowd', gym: 'gym crowd',
  outdoors: 'outdoorsy types', movies: 'culture nights', concerts: 'live-music people',
  music: 'music heads', arts: 'arts & culture', books: 'book-club energy', games: 'game-night crowd',
};
function vibeFor(a: any): string { return VIBE_FOR[String(a.category || '').toLowerCase()] || 'open invite · new faces welcome'; }
// Headcount status badge for a plan: forming / needs N more / N interested.
function planStatus(a: any): { label: string; cta: string; hot: boolean } {
  const yes = a.responses?.yes ?? a.rsvpCount ?? 0;
  const cap = a.capacity || null;
  if (cap && yes < cap) {
    const need = cap - yes;
    return { label: need <= 2 ? `needs ${need} more` : 'group forming', cta: 'join the plan', hot: need <= 2 };
  }
  if (yes <= 1) return { label: 'group forming', cta: 'ask to join', hot: false };
  return { label: `${yes} interested`, cta: "i'm interested", hot: yes >= 4 };
}

// A compact, lively "vibe card" for the Today page recommendation rails.
function VibeCard({ a, onRsvp, onAuthor }: { a: any; onRsvp: (id: string, r?: 'yes' | 'maybe' | 'no') => void; onAuthor?: (a: any) => void }) {
  const st = planStatus(a);
  const joined = a.myResponse === 'yes';
  const yes = a.responses?.yes ?? a.rsvpCount ?? 0;
  return (
    <div style={{ ...card, padding: '0.95rem 1.05rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 230 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', lineHeight: 1.05, letterSpacing: '0.01em' }}>{a.title || 'a plan'}</div>
        <span style={{ flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: st.hot ? '#fff' : LINE_DEEP, background: st.hot ? LINE : 'var(--h-surface-3)', border: `1px solid ${st.hot ? LINE : 'var(--h-border)'}`, borderRadius: 999, padding: '0.2rem 0.5rem', fontWeight: 700 }}>{st.label}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.03em', color: 'var(--h-text)' }}>
        {a.happens_at ? friendlyWhen(a.happens_at) : (a.area || 'your city')}{a.area && a.happens_at ? ` · ${a.area}` : ''}{yes ? ` · ${yes} interested` : ''}
      </div>
      <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--h-text-dim)' }}>for: {vibeFor(a)}</div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.1rem' }}>
        <button onClick={() => onRsvp(a.id, joined ? 'no' : 'yes')} style={{ ...poppyBtn, fontSize: '0.95rem', padding: '0.4rem 0.95rem', background: joined ? 'var(--h-surface-3)' : LINE, color: joined ? LINE_DEEP : '#fff', boxShadow: joined ? 'none' : poppyBtn.boxShadow }}>{joined ? '✓ you’re in' : `${st.cta} →`}</button>
        {onAuthor && a.authorName && <button onClick={() => onAuthor(a)} title="who's organizing" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)', textDecoration: 'underline', textUnderlineOffset: 2 }}>by {(a.authorName).split(' ')[0]}</button>}
      </div>
    </div>
  );
}

// TODAY / VIBES — the entry point: what can I do on NotCupid today? Recommendation
// rails (today's vibe / drop / near you / people / your plans / start something).
function HomeFeed({ me, firstName, acts, people, myEvents, hasCrew, onCrew, onScene, onStart, onRsvp, onAuthor, city }: {
  me?: any; firstName: string; acts: any[]; people: Person[]; myEvents: any[]; hasCrew: boolean;
  onCrew: () => void; onScene: () => void; onStart: () => void;
  onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void; onAuthor?: (a: any) => void; city?: string | null;
}) {
  const now = Date.now();
  const myInterests = new Set([...(me?.hobbies || []), ...(me?.food || []), ...(me?.music || []), ...(me?.sports || [])].map((x: any) => String(x).toLowerCase()));
  const open = acts.filter((a) => !a.mine && a.myResponse !== 'yes' && a.eligible !== false);
  const upcoming = open.filter((a) => (a.kind || 'event') === 'event' && a.happens_at && new Date(a.happens_at).getTime() > now);
  const score = (a: any) => (myInterests.has(String(a.category || '').toLowerCase()) ? 100 : 0) + (a.responses?.yes ?? a.rsvpCount ?? 0);
  const ranked = [...upcoming].sort((a, b) => score(b) - score(a) || new Date(a.happens_at).getTime() - new Date(b.happens_at).getTime());
  const recs = ranked.slice(0, 5);
  const recIds = new Set(recs.map((a) => a.id));
  const drop = ranked.find((a) => !recIds.has(a.id)) || [...open].sort((a, b) => (b.rsvpCount ?? 0) - (a.rsvpCount ?? 0))[0] || null;
  const nearYou = ranked.filter((a) => !recIds.has(a.id) && a.id !== drop?.id).slice(0, 4);
  const vibePeople = people.filter((p) => p.tag !== 'crew').slice(0, 8);
  const connectedCount = people.filter((p) => p.tag === 'crew').length;
  const focus = recs[0] || drop;
  const cityName = city?.split(',')[0] || 'your city';
  const QUICK: [string, string][] = [['☕', 'coffee / walk'], ['🍜', 'grab food'], ['🍸', 'drinks'], ['🎾', 'sports'], ['🎬', 'movie / show'], ['💬', 'just talk']];

  const railHd = (emoji: string, text: string, sub?: string) => (
    <div style={{ margin: '1.6rem 0 0.7rem' }}>
      <h2 style={{ ...sectionLabel, margin: 0 }}><StationDot />{emoji} {text}</h2>
      {sub && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--h-text-dim)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
  const scrollRow: React.CSSProperties = { display: 'flex', gap: '0.85rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollSnapType: 'x mandatory' };

  return (
    <div>
      <div className="friendTodayHero">
        <div>
          <div className="friendHeroSignal">
            <ConnectionSigil tone="friend" />
            <div className="friendHeroKicker">today on friend line</div>
          </div>
          <h1 className="friendHeroTitle">what can we make happen today?</h1>
          <p className="friendHeroCopy">
            A softer daily home for {cityName}: join a plan, notice your people nearby, or be the one who gives the city something to say yes to.
          </p>
          <div className="friendHeroActions">
            <button onClick={onStart} className="friendHeroPrimary">post a plan →</button>
            {hasCrew && <button onClick={onCrew} className="friendHeroSecondary">open my circle</button>}
            <button onClick={onScene} className="friendHeroSecondary">browse scene</button>
          </div>
        </div>
        <div className="friendHeroStats" aria-label="today's Friend Line stats">
          <div><strong>{open.length}</strong><span>open plans</span></div>
          <div><strong>{vibePeople.length}</strong><span>people nearby</span></div>
          <div><strong>{myEvents.length}</strong><span>your plans</span></div>
          <div><strong>{connectedCount}</strong><span>in circle</span></div>
        </div>
      </div>

      {focus && (
        <div className="friendFocus">
          <div className="friendFocusMeta">best next move · {planStatus(focus).label}</div>
          <div className="friendFocusBody">
            <div>
              <h2>{focus.title || 'a plan worth joining'}</h2>
              <p>{focus.happens_at ? friendlyWhen(focus.happens_at) : (focus.area || cityName)}{focus.area && focus.happens_at ? ` · ${focus.area}` : ''} · for {vibeFor(focus)}</p>
            </div>
            <button onClick={() => onRsvp(focus.id, focus.myResponse === 'yes' ? 'no' : 'yes')} className="friendHeroPrimary">
              {focus.myResponse === 'yes' ? 'you’re in ✓' : `${planStatus(focus).cta} →`}
            </button>
          </div>
        </div>
      )}

      {/* TODAY'S VIBE — recommended cards */}
      {railHd('✨', 'best fits', 'hand-picked from what is happening soon')}
      {recs.length === 0 ? (
        <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>
          quiet right now — <button onClick={onStart} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, textDecoration: 'underline', font: 'inherit', fontStyle: 'italic' }}>start something →</button> and others will join.
        </div>
      ) : (
        <div style={scrollRow}>{recs.map((a) => <div key={a.id} style={{ flex: '0 0 260px', scrollSnapAlign: 'start' }}><VibeCard a={a} onRsvp={onRsvp} onAuthor={onAuthor} /></div>)}</div>
      )}

      {/* TODAY'S DROP — one featured plan */}
      {drop && (<>
        {railHd('🎁', 'city signal', 'the one people are noticing')}
        <div style={{ ...card, padding: '1.2rem 1.3rem', borderColor: LINE, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP }}>{planStatus(drop).label}</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', lineHeight: 0.95 }}>{drop.title}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: 'var(--h-text)' }}>{drop.happens_at ? friendlyWhen(drop.happens_at) : (drop.area || city)}{drop.area && drop.happens_at ? ` · ${drop.area}` : ''}</div>
          <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--h-text-dim)' }}>for: {vibeFor(drop)}</div>
          <div><button onClick={() => onRsvp(drop.id, drop.myResponse === 'yes' ? 'no' : 'yes')} style={{ ...poppyBtn }}>{drop.myResponse === 'yes' ? '✓ you’re in' : 'i’m interested →'}</button></div>
        </div>
      </>)}

      {/* PLANS NEAR YOU */}
      {nearYou.length > 0 && (<>
        {railHd('📍', 'easy ways in', `happening around ${cityName}`)}
        <div style={scrollRow}>{nearYou.map((a) => <div key={a.id} style={{ flex: '0 0 260px', scrollSnapAlign: 'start' }}><VibeCard a={a} onRsvp={onRsvp} onAuthor={onAuthor} /></div>)}</div>
      </>)}

      {/* PEOPLE YOU MIGHT VIBE WITH */}
      {vibePeople.length > 0 && (<>
        {railHd('🧑‍🤝‍🧑', 'people you might vibe with', 'familiar faces before they become familiar')}
        <div style={scrollRow}>
          {vibePeople.map((p) => (
            <div key={p.id} style={{ ...card, flex: '0 0 130px', scrollSnapAlign: 'start', padding: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', textAlign: 'center' }}>
              {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)' }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--h-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', color: LINE_DEEP }}>{(p.name || '?').charAt(0)}</div>}
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', lineHeight: 1 }}>{(p.name || 'someone').split(' ')[0]}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>{p.tag === 'match' ? 'in your pack' : p.tag === 'crew' ? 'connected' : 'around town'}</div>
            </div>
          ))}
        </div>
      </>)}

      {/* YOUR UPCOMING PLANS */}
      {myEvents.length > 0 && (<>
        {railHd('📅', 'your upcoming plans')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {myEvents.map((a) => <ActivityPost key={a.id} a={a} onRsvp={onRsvp} onDelete={() => {}} onAuthor={onAuthor} />)}
        </div>
      </>)}

      {/* START SOMETHING */}
      {railHd('➕', 'start something', 'be the one who makes the plan')}
      <div style={{ ...card, padding: '1.1rem 1.2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {QUICK.map(([emoji, label]) => (
            <button key={label} onClick={onStart} style={{ ...chip, cursor: 'pointer', fontSize: '0.66rem', padding: '0.4rem 0.8rem', background: 'var(--h-surface-3)' }}>{emoji} {label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={onStart} style={{ ...poppyBtn }}>📣 post a plan →</button>
          {hasCrew && <button onClick={onCrew} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.04em', color: INK, background: '#ffd23d', border: '1px solid var(--h-border)', borderRadius: 12, padding: '0.5rem 1.1rem', cursor: 'pointer' }}>🎒 my circle →</button>}
        </div>
      </div>
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
function ActivityPost({ a, onRsvp, onDelete, onAuthor }: { a: any; onRsvp: (id: string, response?: 'yes' | 'maybe' | 'no') => void; onDelete: (id: string) => void; onAuthor?: (a: any) => void }) {
  const isEvent = (a.kind || 'event') !== 'post';
  const aud = isEvent ? audienceLabel(a) : null;
  const r = a.responses || { yes: 0, maybe: 0, no: 0 };
  const eligible = a.eligible !== false;
  const RESP: Array<['yes' | 'maybe' | 'no', string]> = [['yes', '✅ i’m interested'], ['maybe', '🔖 save'], ['no', '🚫 pass']];
  // Comments (talk posts become a little thread).
  const [showC, setShowC] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [cCount, setCCount] = useState<number>(a.commentCount || 0);
  const [cErr, setCErr] = useState<string | null>(null);
  async function loadComments() {
    try { const res = await fetch(`/api/friend/activities/${a.id}/comments`); if (res.ok) { const d = await res.json(); setComments(d.comments || []); setCCount((d.comments || []).length); } } catch { /* ignore */ }
  }
  function toggleComments() { const next = !showC; setShowC(next); if (next) { setCErr(null); loadComments(); } }
  async function postComment() {
    const body = cText.trim(); if (!body || cBusy) return; setCBusy(true); setCText(''); setCErr(null);
    // optimistic — show it immediately so it never just "vanishes"
    const tmpId = 'tmp-' + Date.now();
    setComments((prev) => [...prev, { id: tmpId, body, isMe: true, name: 'you', pending: true }]);
    setCCount((n) => n + 1);
    try {
      const res = await fetch(`/api/friend/activities/${a.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setComments((prev) => prev.filter((c) => c.id !== tmpId)); setCCount((n) => Math.max(0, n - 1));
        setCErr(j.error || 'couldn’t post — try again.');
        return;
      }
      const d = await res.json();
      if (d.comment) setComments((prev) => prev.map((c) => (c.id === tmpId ? d.comment : c)));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tmpId)); setCCount((n) => Math.max(0, n - 1));
      setCErr('couldn’t post — check your connection.');
    } finally { setCBusy(false); }
  }
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.8rem 1rem 0.5rem' }}>
        {/* author is clickable → their friend card (vet who's behind a post/event) */}
        <button onClick={() => onAuthor && !a.isMine && onAuthor(a)} title={a.isMine ? '' : `see ${a.authorName?.split(' ')[0] || 'who'}'s card`}
          style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onAuthor && !a.isMine ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
          {a.authorPhoto
            ? <img src={a.authorPhoto} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', lineHeight: 1 }}>{a.authorName?.split(' ')[0] || 'someone'}{onAuthor && !a.isMine && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', color: LINE_DEEP, marginLeft: '0.4rem', verticalAlign: 'middle' }}>view ›</span>}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: isEvent ? LINE_DEEP : 'var(--h-text-dim)', marginTop: '0.2rem' }}>
              {isEvent ? '📅 organizing this' : '💬 post'} · 📍 {a.area || 'greater boston'}{a.created_at ? ` · ${timeAgo(a.created_at)}` : ''}
            </div>
          </div>
        </button>
        <span style={{ ...chip, flexShrink: 0 }}>{a.category}</span>
        {a.isMine && <button onClick={() => onDelete(a.id)} title="delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>✕</button>}
      </div>
      <div style={{ padding: '0 1rem 0.75rem' }}>
        <div style={{ fontSize: '1.02rem', lineHeight: 1.4 }}>{a.title}</div>
        {isEvent && (() => {
          const st = planStatus(a);
          return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 999, padding: '0.22rem 0.55rem', color: st.hot ? '#fff' : LINE_DEEP, background: st.hot ? LINE : 'var(--h-surface-3)', border: `1px solid ${st.hot ? LINE : 'var(--h-border)'}` }}>{st.label}</span>
              {a.location && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 999, padding: '0.22rem 0.55rem', color: '#2d7a4f', background: 'rgba(45,122,79,0.1)', border: '1px solid rgba(45,122,79,0.3)' }}>✓ host confirmed</span>}
              {a.datingFriendly && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 999, padding: '0.22rem 0.55rem', color: '#c2185b', background: 'rgba(194,24,91,0.1)', border: '1px solid rgba(194,24,91,0.3)' }}>💘 dating-friendly</span>}
            </div>
          );
        })()}
        {isEvent && a.happens_at && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginTop: '0.55rem' }}>
            <span style={{ ...chip, background: 'var(--h-surface-3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' })}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em' }}><Countdown to={a.happens_at} /></span>
          </div>
        )}
        {isEvent && a.location && (
          <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', letterSpacing: '0.03em', color: 'var(--h-text)' }}>
            📍 <b>{a.location}</b>{a.area ? <span style={{ color: 'var(--h-text-faint)' }}>· {a.area}</span> : null}
          </div>
        )}
        {isEvent && aud && (
          <div style={{ marginTop: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: LINE_DEEP }}>
            👥 open to {aud}
          </div>
        )}
        {isEvent && !a.isMine && (
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.72rem', color: 'var(--h-text-dim)', lineHeight: 1.4, background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.5rem 0.65rem' }}>
            <span style={{ flexShrink: 0 }}>🛡</span>
            <span>before you go — <button onClick={() => onAuthor && onAuthor(a)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontStyle: 'italic', color: LINE_DEEP, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>see who&apos;s organizing</button>, and keep the first hang somewhere public.</span>
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--h-border)', padding: '0.45rem 0.6rem' }}>
        {!isEvent ? (
          <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {(a.rsvpCount || 0) >= 3
                ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#d2530f', background: 'rgba(255,106,31,0.12)', border: '1px solid rgba(255,106,31,0.32)', borderRadius: 999, padding: '0.18rem 0.55rem' }}>🔥 popular</span>
                : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: 'var(--h-text-faint)' }}>{a.rsvpCount ? `${a.rsvpCount} into this` : 'be the first'}</span>}
              <button onClick={toggleComments} title="comments"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: showC ? 'var(--h-surface-3)' : 'transparent', color: 'var(--h-text-dim)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.2rem 0.6rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', fontWeight: 700 }}>
                💬 {cCount > 0 ? cCount : 'comment'}
              </button>
            </div>
            <button onClick={() => onRsvp(a.id)} title={a.iRsvped ? 'you’re into this' : 'i’m into this'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: a.iRsvped ? 'var(--h-accent)' : 'var(--h-surface-2)', color: a.iRsvped ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${a.iRsvped ? 'var(--h-accent)' : 'var(--h-border)'}`, borderRadius: 999, padding: '0.3rem 0.75rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700 }}>
              {a.iRsvped ? '♥' : '♡'} {a.rsvpCount || 0}
            </button>
          </div>
          {showC && (
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--h-border)', paddingTop: '0.6rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: 240, overflowY: 'auto' }}>
                {comments.length === 0 && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--h-text-faint)' }}>no comments yet — say something.</div>}
                {comments.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                      : <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', flexShrink: 0, display: 'inline-block' }} />}
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em', color: LINE_DEEP, marginRight: '0.4rem' }}>{(c.name || 'someone').split(' ')[0]}</span>
                      <span style={{ fontSize: '0.86rem', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.body}</span>
                    </div>
                  </div>
                ))}
              </div>
              {cErr && <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.7rem', background: 'rgba(192,57,43,0.1)', color: '#c0392b', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.78rem', borderRadius: 8 }}>{cErr}</div>}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <input value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && postComment()} placeholder="add a comment…"
                  style={{ flex: 1, minWidth: 0, border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.45rem 0.85rem', fontSize: '0.85rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                <button onClick={postComment} disabled={cBusy || !cText.trim()} style={{ ...poppyBtn, opacity: cText.trim() ? 1 : 0.5, padding: '0.4rem 0.9rem', fontSize: '0.9rem' }}>{cBusy ? '…' : 'post'}</button>
              </div>
            </div>
          )}
          </>
        ) : eligible ? (() => {
          const cap = a.capacity || null;
          const full = !!cap && r.yes >= cap; // all spots taken
          return (
          <div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {RESP.map(([val, label]) => {
                const on = a.myResponse === val;
                const blocked = val === 'yes' && full && !on; // can't join a full plan
                return (
                  <button key={val} onClick={() => !blocked && onRsvp(a.id, val)} disabled={blocked} title={blocked ? 'this plan is full' : ''}
                    style={{ flex: 1, background: on ? (val === 'no' ? '#f0d2c8' : '#ffd23d') : 'transparent', border: `2px solid ${on ? INK : 'rgba(36,29,18,0.2)'}`, borderRadius: 8, padding: '0.45rem 0.3rem', cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.45 : 1, font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: on ? INK : 'var(--h-text)', fontWeight: on ? 700 : 500 }}>
                    {blocked ? '🔒 full' : label}{val === 'yes' && r.yes ? ` · ${r.yes}` : val === 'maybe' && r.maybe ? ` · ${r.maybe}` : ''}
                  </button>
                );
              })}
            </div>
            {(r.yes > 0 || r.maybe > 0 || cap) && (
              <div style={{ textAlign: 'center', marginTop: '0.35rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: full ? '#c0392b' : 'var(--h-text-dim)' }}>
                {cap ? `${r.yes}/${cap} spots filled` : `${r.yes} going`}{full ? ' · full' : ''}{r.maybe ? ` · ${r.maybe} maybe` : ''}
              </div>
            )}
          </div>
          );
        })()
        : (
          <div style={{ textAlign: 'center', padding: '0.4rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--h-text-dim)' }}>
            🔒 {a.capacity && (a.responses?.yes ?? 0) >= a.capacity ? 'this plan is full' : `open to ${aud || 'a specific group'}`}{r.yes ? ` · ${r.yes} going` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

type Me = { name: string; photo_url: string | null; archetype: string | null; bio: string; music: string[]; food: string[]; hobbies: string[]; galleryCount: number; friendSeeking?: string[]; friendAgeMin?: number | null; friendAgeMax?: number | null; gender?: string | null; isLgbtq?: boolean };
export default function FriendHubClient({ firstName, me, city, metro, myArea }: { firstName: string; me?: Me; city?: string | null; metro?: string | null; myArea?: string | null; accessTier?: string; daysLeft?: number }) {
  const profileSet = !!(me && (me.photo_url || me.bio || (me.hobbies?.length || 0) > 0));
  // Events default to EVERYONE. You CAN make a same-gender space (some people want
  // same-gender friendships) — but only for a group you're part of, so a woman can
  // post "women only" and a man can't. These are the options the poster may pick.
  const ownAudienceOpts: [string, string][] = (() => {
    const g = me?.gender;
    const out: [string, string][] = [];
    if (g === 'm') out.push(['m', 'men only']);
    else if (g === 'f') out.push(['f', 'women only']);
    else if (g === 'nb') out.push(['nb', 'non-binary only']);
    if (me?.isLgbtq) out.push(['lgbtq', 'LGBTQ+ only']);
    return out;
  })();
  const prefAud = { audGenders: [] as string[], audMin: '', audMax: '' };
  // Buying / opening packs now lives on the cinematic /friends/pack page.
  const [matches, setMatches] = useState<any[]>([]);
  const [sealedCount, setSealedCount] = useState(0);
  const [cooledUntil, setCooledUntil] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false); // localStorage read done? (avoids a modal flash)
  const [cardMember, setCardMember] = useState<any | null>(null); // friend-card popup (click a connection)
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [ghosted, setGhosted] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [chat, setChat] = useState<any>({ circleId: null, members: [], messages: [] });
  const [pulse, setPulse] = useState<any>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState<string>(''); // selected sub-tag (exact category)
  const [filterMain, setFilterMain] = useState<string>(''); // selected main category bubble
  const [kindFilter, setKindFilter] = useState<'all' | 'post' | 'event'>('all');
  const [sceneSort, setSceneSort] = useState<'new' | 'popular'>('new');
  const [sceneTime, setSceneTime] = useState<'all' | 'tonight' | 'weekend'>('all'); // quick time filter
  const [nearMe, setNearMe] = useState(false); // only plans in my neighborhood
  const [interest, setInterest] = useState<string>(''); // selected interest chip (label)
  const [areaFilter, setAreaFilter] = useState<string>('');
  const feedRef = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('');
  const [newAct, setNewAct] = useState<{ title: string; category: string; happens_at: string; kind: 'post' | 'event'; area: string; location: string; audGenders: string[]; audMin: string; audMax: string; capacity: string; datingFriendly: boolean }>({ title: '', category: 'hang', happens_at: '', kind: 'post', area: '', location: '', audGenders: prefAud.audGenders, audMin: prefAud.audMin, audMax: prefAud.audMax, capacity: '', datingFriendly: false });
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false); // guided post wizard
  const [composerStep, setComposerStep] = useState(1);
  // Deep-link: a crew push opens /friends?view=crew straight into the chat.
  const [view, setView] = useState<NavKey>(() => {
    if (typeof window === 'undefined') return 'home';
    const v = new URLSearchParams(window.location.search).get('view');
    return (['home', 'scene', 'crew', 'pulse'] as string[]).includes(v || '') ? (v as NavKey) : 'home';
  });
  const [chatOpen, setChatOpen] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  // Private 1:1 DM with a connection (separate from the pack/crew group chat).
  const [dmWith, setDmWith] = useState<any | null>(null);
  const [dmMsgs, setDmMsgs] = useState<any[]>([]);
  const [dmText, setDmText] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const dmEndRef = useRef<HTMLDivElement>(null);
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

  // ── City Pulse communities: user-run clubs + submitted community links ──
  const [clubs, setClubs] = useState<any[]>([]);
  const [comLinks, setComLinks] = useState<any[]>([]);
  const [clubBusy, setClubBusy] = useState(false);
  const [showNewClub, setShowNewClub] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', category: 'books', description: '', area: '' });
  const [showNewLink, setShowNewLink] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', kind: 'discord', description: '' });
  const [clubChat, setClubChat] = useState<{ id: string; name: string } | null>(null);
  const [clubMsgs, setClubMsgs] = useState<any[]>([]);
  const [clubText, setClubText] = useState('');
  const clubEndRef = useRef<HTMLDivElement>(null);
  const [clubManage, setClubManage] = useState<{ id: string; name: string } | null>(null);
  const [clubReqs, setClubReqs] = useState<any[]>([]);
  const loadClubs = useCallback(async () => { try { const r = await fetch('/api/friend/clubs'); if (r.ok) setClubs((await r.json()).clubs || []); } catch { /* ignore */ } }, []);
  const loadComLinks = useCallback(async () => { try { const r = await fetch('/api/friend/community-links'); if (r.ok) setComLinks((await r.json()).links || []); } catch { /* ignore */ } }, []);
  const loadClubChat = useCallback(async (id: string) => { try { const r = await fetch(`/api/friend/clubs/${id}/messages`); if (r.ok) setClubMsgs((await r.json()).messages || []); } catch { /* ignore */ } }, []);
  async function createClub() {
    const name = newClub.name.trim(); if (!name || clubBusy) return; setClubBusy(true);
    try { const r = await fetch('/api/friend/clubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClub) });
      if (r.ok) { setShowNewClub(false); setNewClub({ name: '', category: 'books', description: '', area: '' }); await loadClubs(); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not create the club.'); }
    } catch { /* ignore */ } finally { setClubBusy(false); }
  }
  async function clubAct(id: string, action: string, userId?: string) {
    try { await fetch(`/api/friend/clubs/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, userId }) }); } catch { /* ignore */ }
  }
  async function openClubChat(c: { id: string; name: string }) { setClubManage(null); setClubChat(c); setClubText(''); setClubMsgs([]); await loadClubChat(c.id); setTimeout(() => clubEndRef.current?.scrollIntoView({ block: 'end' }), 90); }
  async function sendClubMsg() { const body = clubText.trim(); if (!body || !clubChat) return; setClubText(''); try { await fetch(`/api/friend/clubs/${clubChat.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }); } catch { /* ignore */ } await loadClubChat(clubChat.id); setTimeout(() => clubEndRef.current?.scrollIntoView({ block: 'end' }), 60); }
  async function openClubManage(c: { id: string; name: string }) { setClubChat(null); setClubManage(c); setClubReqs([]); try { const r = await fetch(`/api/friend/clubs/${c.id}`); if (r.ok) setClubReqs((await r.json()).requests || []); } catch { /* ignore */ } }
  async function reqAction(clubId: string, userId: string, action: 'approve' | 'decline') { setClubReqs((prev) => prev.filter((x) => x.id !== userId)); await clubAct(clubId, action, userId); await loadClubs(); }
  async function submitLink() {
    const title = newLink.title.trim(); const url = newLink.url.trim(); if (!title || !url || clubBusy) return; setClubBusy(true);
    try { const r = await fetch('/api/friend/community-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLink) });
      if (r.ok) { setShowNewLink(false); setNewLink({ title: '', url: '', kind: 'discord', description: '' }); alert('Submitted! It shows up once the team approves it.'); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not submit.'); }
    } catch { /* ignore */ } finally { setClubBusy(false); }
  }

  useEffect(() => { try { if (localStorage.getItem('nc-friend-terms') === '1') setTermsOk(true); } catch { /* ignore */ } setTermsChecked(true); }, []);

  useEffect(() => { loadMatches(); loadChat(); loadPulse(); }, [loadMatches, loadChat, loadPulse]);
  useEffect(() => { loadActs(); }, [loadActs]);
  // light polling for the group chat
  // only poll the group chat when it's actually on screen + the tab is visible
  useEffect(() => { const t = setInterval(() => { if (!document.hidden && view === 'crew') loadChat(); }, 4000); return () => clearInterval(t); }, [loadChat, view]);
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
  useEffect(() => { if (view === 'pulse' || view === 'crew') loadClubs(); }, [view, loadClubs]);
  useEffect(() => { if (view === 'pulse') { loadComLinks(); loadPulse(); } }, [view, loadComLinks, loadPulse]);
  useEffect(() => { if (!clubChat) return; const t = setInterval(() => { if (!document.hidden) loadClubChat(clubChat.id); }, 5000); return () => clearInterval(t); }, [clubChat, loadClubChat]);
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

  // Choose the whole pack — opt in to open the pack chat with everyone in it.
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
  // Vet who's behind a post/event — open their friend card. If they're already a
  // match/connection, show the real card; otherwise build it from the post's author data.
  function openAuthorCard(a: any) {
    if (!a?.authorId || a.isMine) return;
    const match = matches.find((m: any) => m.otherId === a.authorId);
    if (match) { setConfirmDrop(false); setCardMember(match); return; }
    setConfirmDrop(false);
    setCardMember({
      otherId: a.authorId, name: a.authorName, age: a.authorAge ?? null, photo_url: a.authorPhoto || null,
      archetype: a.authorArchetype || null, sharedActivities: a.authorInterests || [],
      gender: a.authorGender || null, connected: false, iAccepted: false, theyAccepted: false,
    });
  }
  // Safety: flag a person to the team (routes to the feedback inbox admins read).
  async function reportUser(m: any) {
    const who = (m?.name || 'this person');
    if (!confirm(`Report ${who} to the NotCupid team? We review every report. (For anything urgent or unsafe, email match@notcupid.com.)`)) return;
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: `[FRIEND SAFETY REPORT] ${who} (id ${m?.otherId || m?.id || '?'}) flagged from a Scene post/card.` }) });
      alert('Thanks — our team will review this. You can also just not connect; they can’t message you unless you do.');
    } catch { alert('Could not send that report — please email match@notcupid.com.'); }
    setCardMember(null);
  }
  async function leaveCrew() {
    if (!confirm("Opt out of this crew? You'll leave the group for everyone in it and the algo will route you to a fresh one.")) return;
    setBusy(true);
    await fetch('/api/friend/leave', { method: 'POST' });
    setChatOpen(false);
    await loadMatches(); await loadChat();
    setBusy(false);
  }
  // Drop a single 1:1 connection (leaves the shared chat if it was your last tie there).
  async function dropConnection(otherId: string) {
    setBusy(true);
    await fetch('/api/friend/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otherId }) });
    await loadMatches(); await loadChat();
    setBusy(false); setCardMember(null); setConfirmDrop(false);
  }
  async function send() {
    const body = msg.trim(); if (!body) return; setMsg('');
    await fetch('/api/friend/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    await loadChat();
  }
  // ── Private 1:1 DM with a connection ──
  const loadDm = useCallback(async (otherId: string): Promise<boolean> => {
    try { const r = await fetch('/api/friend/dm?with=' + otherId); if (r.ok) { setDmMsgs((await r.json()).messages || []); return true; } return false; } catch { return false; }
  }, []);
  async function openDm(m: any) {
    setCardMember(null); setConfirmDrop(false); setDmText(''); setDmMsgs([]); setDmError(null); setDmWith(m);
    const ok = await loadDm(m.otherId);
    if (!ok) setDmError('Couldn’t open this chat. If you just connected, give it a second and reopen.');
    setTimeout(() => dmEndRef.current?.scrollIntoView({ block: 'end' }), 90);
  }
  async function sendDm() {
    const body = dmText.trim(); if (!body || !dmWith) return;
    setDmText(''); setDmError(null);
    // optimistic — show it immediately so it never just "vanishes"
    const tmpId = 'tmp-' + Date.now();
    setDmMsgs((prev) => [...prev, { id: tmpId, body, isMe: true, pending: true }]);
    setTimeout(() => dmEndRef.current?.scrollIntoView({ block: 'end' }), 40);
    try {
      const res = await fetch('/api/friend/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otherId: dmWith.otherId, body }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDmMsgs((prev) => prev.map((mm) => (mm.id === tmpId ? { ...mm, pending: false, failed: true } : mm)));
        setDmError(res.status === 403 ? 'You can only message a connection.' : (j.error || 'Couldn’t send — try again.'));
        return;
      }
      await loadDm(dmWith.otherId); // reconcile with the server (replaces the optimistic row)
    } catch {
      setDmMsgs((prev) => prev.map((mm) => (mm.id === tmpId ? { ...mm, pending: false, failed: true } : mm)));
      setDmError('Couldn’t send — check your connection and try again.');
    }
    setTimeout(() => dmEndRef.current?.scrollIntoView({ block: 'end' }), 60);
  }
  // poll the open DM thread for new messages
  useEffect(() => {
    if (!dmWith) return;
    const id = setInterval(() => { if (!document.hidden) loadDm(dmWith.otherId); }, 5000);
    return () => clearInterval(id);
  }, [dmWith, loadDm]);
  // arriving from a DM push (/friends?dm=<id>) → open that thread once matches load
  const dmParamDone = useRef(false);
  useEffect(() => {
    if (dmParamDone.current) return;
    const id = new URLSearchParams(window.location.search).get('dm');
    if (!id) { dmParamDone.current = true; return; }
    const conn = matches.find((mm) => mm.connected && mm.otherId === id);
    if (conn) { dmParamDone.current = true; openDm(conn); }
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps
  async function createAct() {
    if (!newAct.title.trim()) return; setBusy(true);
    const payload = {
      ...newAct,
      audience_gender: newAct.kind === 'event' ? newAct.audGenders : undefined,
      audience_age_min: newAct.kind === 'event' && newAct.audMin ? parseInt(newAct.audMin) : undefined,
      audience_age_max: newAct.kind === 'event' && newAct.audMax ? parseInt(newAct.audMax) : undefined,
      capacity: newAct.kind === 'event' && newAct.capacity ? parseInt(newAct.capacity) : undefined,
      dating_friendly: newAct.kind === 'event' ? newAct.datingFriendly : undefined,
    };
    const res = await fetch('/api/friend/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || "Couldn't post that — try again.");
      setBusy(false);
      return;
    }
    setNewAct({ title: '', category: 'hang', happens_at: '', kind: newAct.kind, area: newAct.area, location: '', audGenders: prefAud.audGenders, audMin: prefAud.audMin, audMax: prefAud.audMax, capacity: '', datingFriendly: false });
    setComposerOpen(false); setComposerStep(1);
    await loadActs(); await loadPulse(); setBusy(false);
  }
  async function rsvp(id: string, response?: 'yes' | 'maybe' | 'no') {
    const r = await fetch(`/api/friend/activities/${id}/rsvp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response ? { response } : {}),
    });
    if (r.ok) {
      const d = await r.json();
      setActs((a) => a.map((x) => x.id === id ? { ...x, iRsvped: d.joined, rsvpCount: d.count, myResponse: d.myResponse, responses: d.responses } : x));
    } else {
      const d = await r.json().catch(() => ({} as any));
      if (d?.full) { alert('This plan is full — the host capped the headcount. You can say “maybe” in case a spot opens.'); await loadActs(); }
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

      {/* GUIDED COMPOSER — what → when → who → where → post */}
      {composerOpen && (() => {
        const close = () => setComposerOpen(false);
        const isPost = newAct.kind === 'post';
        const setWhen = (preset: 'tonight' | 'tomorrow' | 'weekend') => {
          const d = new Date();
          if (preset === 'tonight') d.setHours(19, 0, 0, 0);
          else if (preset === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); }
          else { const toSat = (6 - d.getDay() + 7) % 7; d.setDate(d.getDate() + toSat); d.setHours(12, 0, 0, 0); }
          setNewAct((s) => ({ ...s, happens_at: localDT(d) }));
        };
        const stepBox: React.CSSProperties = { background: 'var(--h-surface)', borderRadius: 18, maxWidth: 520, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 24px 70px -20px rgba(0,0,0,0.45)' };
        const q: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', lineHeight: 1, margin: '0 0 1rem' };
        const opt = (active: boolean): React.CSSProperties => ({ cursor: 'pointer', textAlign: 'left', borderRadius: 12, padding: '0.8rem 1rem', border: `2px solid ${active ? LINE : 'var(--h-border)'}`, background: active ? 'rgba(255,106,31,0.08)' : 'var(--h-surface-2)', color: 'var(--h-text)', fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' });
        const navBtn: React.CSSProperties = { ...poppyBtn, fontSize: '1rem', padding: '0.5rem 1.2rem' };
        const back = (to: number) => <button onClick={() => setComposerStep(to)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>← back</button>;
        return (
          <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 130 }}>
            <div onClick={(e) => e.stopPropagation()} style={stepBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: LINE_DEEP }}>{isPost ? 'say something' : `step ${composerStep > 4 ? 4 : composerStep} of 4`}</span>
                <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--h-text-dim)' }}>✕</button>
              </div>

              {/* STEP 1 — what */}
              {composerStep === 1 && (<>
                <h3 style={q}>What do you want to do?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                  {WHAT_CARDS.map((c) => (
                    <button key={c.label} onClick={() => { setNewAct((s) => ({ ...s, kind: c.kind, category: c.category })); if (c.kind === 'post') setComposerStep(5); else setComposerStep(2); }}
                      style={{ ...opt(false), display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.5rem' }}>{c.emoji}</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.02em' }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </>)}

              {/* STEP 2 — when */}
              {composerStep === 2 && (<>
                <h3 style={q}>When?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {([['tonight', '🌙 Tonight'], ['tomorrow', '☀️ Tomorrow'], ['weekend', '🗓 This weekend']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setWhen(k)} style={opt(false)}>{label}</button>
                  ))}
                  <div style={{ ...opt(false), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 pick a date
                    <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ flex: 1, border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.3rem 0.5rem', fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                  </div>
                  {newAct.happens_at && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.82rem', color: LINE_DEEP }}>✓ {friendlyWhen(newAct.happens_at)}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.3rem' }}>{back(1)}<button onClick={() => setComposerStep(3)} disabled={!newAct.happens_at} style={{ ...navBtn, opacity: newAct.happens_at ? 1 : 0.5 }}>next →</button></div>
              </>)}

              {/* STEP 3 — who */}
              {composerStep === 3 && (<>
                <h3 style={q}>Who can join?</h3>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.4rem' }}>open to</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <button onClick={() => setNewAct((s) => ({ ...s, audGenders: [] }))} style={opt(newAct.audGenders.length === 0)}>👥 Everyone</button>
                  {ownAudienceOpts.map(([v, label]) => (
                    <button key={v} onClick={() => setNewAct((s) => ({ ...s, audGenders: [v] }))} style={opt(newAct.audGenders.includes(v))}>{label}</button>
                  ))}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.4rem' }}>vibe</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <button onClick={() => setNewAct((s) => ({ ...s, datingFriendly: false }))} style={opt(!newAct.datingFriendly)}>🧡 Just friends</button>
                  <button onClick={() => setNewAct((s) => ({ ...s, datingFriendly: true }))} style={opt(newAct.datingFriendly)}>💘 Dating-friendly</button>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.4rem' }}>age range (optional)</div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input type="number" min={18} max={120} placeholder="any" value={newAct.audMin} onChange={(e) => setNewAct({ ...newAct, audMin: e.target.value })} style={{ width: 64, border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                  <span style={{ color: 'var(--h-text-dim)' }}>–</span>
                  <input type="number" min={18} max={120} placeholder="any" value={newAct.audMax} onChange={(e) => setNewAct({ ...newAct, audMax: e.target.value })} style={{ width: 64, border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                </div>
                {newAct.audGenders.length > 0 && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.74rem', color: 'var(--h-text-dim)', marginTop: '0.7rem' }}>a same-gender plan stays {newAct.audGenders.includes('f') ? 'women' : newAct.audGenders.includes('m') ? 'men' : 'group'}-run — you can only open it to a group you’re part of.</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.3rem' }}>{back(2)}<button onClick={() => setComposerStep(4)} style={navBtn}>next →</button></div>
              </>)}

              {/* STEP 4 — where */}
              {composerStep === 4 && (<>
                <h3 style={q}>Where?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button onClick={() => { setNewAct((s) => ({ ...s, area: '', location: '' })); setComposerStep(5); }} style={opt(false)}>📍 My area{myArea ? ` (${myArea})` : ''}</button>
                  <div style={{ ...opt(false) }}>
                    <div style={{ marginBottom: '0.4rem' }}>🗺 Pick a neighborhood</div>
                    <select value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} style={{ width: '100%', border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', background: 'var(--h-surface)', color: 'var(--h-text)' }}>
                      <option value="">— choose —</option>
                      {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input type="text" value={newAct.location} onChange={(e) => setNewAct({ ...newAct, location: e.target.value })} maxLength={120} placeholder="exact spot? (e.g. Tatte, Charles River loop)" style={{ width: '100%', marginTop: '0.4rem', border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem 0.55rem', fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                  </div>
                  <button onClick={() => { setNewAct((s) => ({ ...s, area: '', location: '' })); setComposerStep(5); }} style={opt(false)}>🤷 Decide later</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.3rem' }}>{back(3)}<button onClick={() => setComposerStep(5)} style={navBtn}>next →</button></div>
              </>)}

              {/* STEP 5 — name it + post */}
              {composerStep === 5 && (<>
                <h3 style={q}>{isPost ? 'Say something' : 'Name your plan'}</h3>
                <input value={newAct.title} autoFocus onChange={(e) => setNewAct({ ...newAct, title: e.target.value })}
                  placeholder={isPost ? `what's on your mind, ${firstName.toLowerCase()}?` : (WHAT_CARDS.find((c) => c.category === newAct.category)?.ph || 'what’s the move?')}
                  style={{ width: '100%', border: '1px solid var(--h-border)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '1rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
                {!isPost && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem', fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', color: 'var(--h-text-dim)' }}>
                    👥 cap <input type="number" min={1} max={1000} placeholder="∞" value={newAct.capacity} onChange={(e) => setNewAct({ ...newAct, capacity: e.target.value })} style={{ width: 70, border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.35rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} /> <span>people (blank = no limit)</span>
                  </div>
                )}
                {!isPost && (
                  <div style={{ marginTop: '1rem', padding: '0.7rem 0.85rem', background: 'var(--h-surface-2)', borderRadius: 10, fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--h-text-dim)', lineHeight: 1.6 }}>
                    {newAct.happens_at ? `🕒 ${friendlyWhen(newAct.happens_at)}` : '🕒 anytime'} · {newAct.audGenders.length ? `👥 ${newAct.audGenders.includes('f') ? 'women' : newAct.audGenders.includes('m') ? 'men' : newAct.audGenders[0]} only` : '👥 everyone'}{newAct.datingFriendly ? ' · 💘 dating-friendly' : ''} · 📍 {newAct.location || newAct.area || 'TBD'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.3rem' }}>
                  {back(isPost ? 1 : 4)}
                  <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...navBtn, opacity: busy || !newAct.title.trim() ? 0.5 : 1 }}>{busy ? 'posting…' : 'post to the scene →'}</button>
                </div>
              </>)}
            </div>
          </div>
        );
      })()}

      {/* FRIEND CARD pop-up — click a connection / pack member → their card + connect/drop */}
      {cardMember && (() => { const m = cardMember; const first = (m.name || 'they').split(' ')[0]; const close = () => { setCardMember(null); setConfirmDrop(false); }; return (
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(24,14,6,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--h-surface)', borderRadius: 20, maxWidth: 380, width: '100%', overflow: 'hidden', boxShadow: '0 34px 90px -22px rgba(0,0,0,0.55)', border: '1px solid var(--h-border)' }}>
            <div style={{ position: 'relative' }}>
              {m.photo_url
                ? <img src={m.photo_url} alt="" style={{ width: '100%', aspectRatio: '1.25', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '1.25', background: 'var(--h-surface-3)' }} />}
              <button onClick={close} aria-label="close" style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(10,8,12,0.55)', color: '#fff', fontSize: '0.95rem' }}>✕</button>
              {typeof m.score === 'number' && <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(10,8,12,0.72)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 999, padding: '0.15rem 0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem' }}>{m.score}% match</span>}
            </div>
            <div style={{ padding: '1rem 1.2rem 1.25rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.9rem', lineHeight: 1 }}>{m.name}{m.age ? <span style={{ color: 'var(--h-text-dim)', fontSize: '1rem' }}> · {m.age}</span> : null}</div>
              {m.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, marginTop: '0.2rem' }}>{m.archetype}</div>}
              {(m.gender === 'm' || m.gender === 'f' || m.gender === 'nb') && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.25rem' }}>{m.gender === 'f' ? '♀ woman' : m.gender === 'm' ? '♂ man' : '⚧ non-binary'}</div>}
              {m.metro && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.82rem', marginTop: '0.2rem' }}>📍 {m.metro}</div>}
              {(m.sharedActivities || []).length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)', marginBottom: '0.35rem' }}>you both like</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>{m.sharedActivities.map((a: string) => <span key={a} style={chip}>{a}</span>)}</div>
                </div>
              )}
              <div style={{ marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {m.connected ? (confirmDrop ? (
                  <>
                    <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5 }}>drop your connection with {first}? you&apos;ll leave the shared chat if they were your last tie there.</div>
                    <button onClick={() => dropConnection(m.otherId)} disabled={busy} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 12, padding: '0.7rem', cursor: busy ? 'wait' : 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.02em' }}>{busy ? '…' : 'yes, drop the connection'}</button>
                    <button onClick={() => setConfirmDrop(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)' }}>keep {first}</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => openDm(m)} style={{ ...poppyBtn, width: '100%' }}>💬 message {first} →</button>
                    <button onClick={() => setConfirmDrop(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: 3 }}>drop connection</button>
                  </>
                )) : m.theyAccepted ? (
                  <button onClick={() => { setCardMember(null); connectOne(m.otherId); }} disabled={busy || !termsOk} style={{ background: '#ff2d8e', color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem', cursor: termsOk && !busy ? 'pointer' : 'not-allowed', opacity: termsOk ? 1 : 0.5, fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.02em' }}>{busy ? '…' : `🤝 accept — connect with ${first} →`}</button>
                ) : m.iAccepted ? (
                  <>
                    <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', border: `2px dashed ${LINE_DEEP}`, borderRadius: 10, padding: '0.6rem' }}>⏳ waiting on {first} to accept</div>
                    <button onClick={() => dropConnection(m.otherId)} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>cancel request</button>
                  </>
                ) : (
                  <button onClick={() => { setCardMember(null); connectOne(m.otherId); }} disabled={busy || !termsOk} style={{ ...poppyBtn, width: '100%', opacity: termsOk ? 1 : 0.5, cursor: termsOk && !busy ? 'pointer' : 'not-allowed' }}>{busy ? '…' : `🤝 connect with ${first}`}</button>
                )}
                {!termsOk && !m.connected && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-faint)', fontSize: '0.74rem', textAlign: 'center' }}>agree to the terms (on the page) before you connect.</div>}
              </div>
              {/* safety: vet + report. Connecting is opt-in; they can't DM you unless you connect. */}
              <div style={{ marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px solid var(--h-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-faint)', fontSize: '0.7rem' }}>they can only message you if you connect.</span>
                <button onClick={() => reportUser(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c0392b', flexShrink: 0 }}>⚑ report</button>
              </div>
            </div>
          </div>
        </div>
      ); })()}

      {/* PRIVATE DM — a 1:1 thread with a connection, as a bottom sheet (not a page) */}
      {dmWith && (() => { const m = dmWith; const first = (m.name || '').split(' ')[0]; return (
        <div onClick={() => setDmWith(null)} style={{ position: 'fixed', inset: 0, zIndex: 195, background: 'rgba(24,14,6,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--h-surface)', width: '100%', maxWidth: 520, height: 'min(82vh, 680px)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--h-border)', borderBottom: 'none', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--h-border)', background: 'var(--h-surface-2)', flexShrink: 0 }}>
              {m.photo_url
                ? <img src={m.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)' }} />
                : <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', display: 'inline-block' }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', lineHeight: 1 }}>{m.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP }}>🔒 private message · just you two</div>
              </div>
              <button onClick={() => setDmWith(null)} aria-label="close" style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--h-surface-3)', color: 'var(--h-text-dim)', fontSize: '0.9rem', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dmMsgs.length === 0 && (
                <div style={{ margin: 'auto', textAlign: 'center', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem' }}>you&apos;re connected with {first} 🧡<br />say hi — this chat is just the two of you.</div>
              )}
              {dmMsgs.map((msg: any) => (
                <div key={msg.id} style={{ alignSelf: msg.isMe ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: msg.isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ background: msg.failed ? 'var(--h-surface-3)' : msg.isMe ? LINE : 'var(--h-surface-2)', color: msg.failed ? 'var(--h-text-dim)' : msg.isMe ? '#fff' : 'var(--h-text)', border: msg.isMe && !msg.failed ? 'none' : '1px solid var(--h-border)', borderRadius: msg.isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '0.5rem 0.8rem', fontSize: '0.92rem', lineHeight: 1.4, wordBreak: 'break-word', opacity: msg.pending ? 0.6 : 1 }}>{msg.body}</div>
                  {msg.failed && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c0392b', marginTop: '0.15rem' }}>not sent</span>}
                </div>
              ))}
              <div ref={dmEndRef} />
            </div>
            {dmError && <div style={{ padding: '0.5rem 1rem', background: 'rgba(192,57,43,0.1)', color: '#c0392b', fontFamily: 'Georgia,serif', fontSize: '0.82rem', textAlign: 'center', flexShrink: 0 }}>{dmError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem', borderTop: '1px solid var(--h-border)', flexShrink: 0 }}>
              <input value={dmText} onChange={(e) => setDmText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendDm()} placeholder={`message ${first}…`}
                style={{ flex: 1, minWidth: 0, border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.6rem 1rem', fontSize: '0.95rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
              <button onClick={sendDm} disabled={!dmText.trim()} style={{ ...poppyBtn, opacity: dmText.trim() ? 1 : 0.5, padding: '0.5rem 1.1rem' }}>send</button>
            </div>
          </div>
        </div>
      ); })()}

      {/* CLUB CHAT — a member-only bottom-sheet thread for a club */}
      {clubChat && (
        <div onClick={() => setClubChat(null)} style={{ position: 'fixed', inset: 0, zIndex: 195, background: 'rgba(24,14,6,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--h-surface)', width: '100%', maxWidth: 520, height: 'min(82vh, 680px)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--h-border)', borderBottom: 'none', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--h-border)', background: 'var(--h-surface-2)', flexShrink: 0 }}>
              <span style={{ fontSize: '1.4rem' }}>🤝</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', lineHeight: 1 }}>{clubChat.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP }}>club chat · members only</div>
              </div>
              <button onClick={() => setClubChat(null)} aria-label="close" style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--h-surface-3)', color: 'var(--h-text-dim)', fontSize: '0.9rem', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {clubMsgs.length === 0 && <div style={{ margin: 'auto', textAlign: 'center', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem' }}>say hi to the club 👋</div>}
              {clubMsgs.map((msg: any) => (
                <div key={msg.id} style={{ alignSelf: msg.isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  {!msg.isMe && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.04em', color: LINE_DEEP, margin: '0 0 0.1rem 0.5rem' }}>{(msg.name || 'someone').split(' ')[0]}</div>}
                  <div style={{ background: msg.isMe ? LINE : 'var(--h-surface-2)', color: msg.isMe ? '#fff' : 'var(--h-text)', border: msg.isMe ? 'none' : '1px solid var(--h-border)', borderRadius: msg.isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '0.5rem 0.8rem', fontSize: '0.92rem', lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.body}</div>
                </div>
              ))}
              <div ref={clubEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem', borderTop: '1px solid var(--h-border)', flexShrink: 0 }}>
              <input value={clubText} onChange={(e) => setClubText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendClubMsg()} placeholder="message the club…" style={{ flex: 1, minWidth: 0, border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.6rem 1rem', fontSize: '0.95rem', background: 'var(--h-surface)', color: 'var(--h-text)' }} />
              <button onClick={sendClubMsg} disabled={!clubText.trim()} style={{ ...poppyBtn, opacity: clubText.trim() ? 1 : 0.5, padding: '0.5rem 1.1rem' }}>send</button>
            </div>
          </div>
        </div>
      )}

      {/* CLUB MANAGE — the owner approves/declines join requests */}
      {clubManage && (
        <div onClick={() => setClubManage(null)} style={{ position: 'fixed', inset: 0, zIndex: 196, background: 'rgba(24,14,6,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--h-surface)', borderRadius: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '1.4rem 1.4rem 1.2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--h-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem' }}>{clubManage.name}</div>
              <button onClick={() => setClubManage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--h-text-faint)' }}>✕</button>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, marginBottom: '0.9rem' }}>join requests</div>
            {clubReqs.length === 0 ? (
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem' }}>no pending requests right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {clubReqs.map((r: any) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {r.photo_url ? <img src={r.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--h-border)' }} /> : <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', display: 'inline-block' }} />}
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || 'someone'}</span>
                    <button onClick={() => reqAction(clubManage.id, r.id, 'approve')} style={{ ...poppyBtn, fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>approve</button>
                    <button onClick={() => reqAction(clubManage.id, r.id, 'decline')} style={pulseBtnGhost}>decline</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => openClubChat(clubManage)} style={{ ...pulseBtnGhost, width: '100%', marginTop: '1rem', padding: '0.5rem' }}>💬 open the club chat →</button>
          </div>
        </div>
      )}

      {/* in-app "new event" pop-up — tap to jump to the Scene */}
      {evToast && (
        <button onClick={() => { setView('scene'); setEvToast(null); setNewScene(0); }}
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, maxWidth: 'min(440px, 92vw)', display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left', background: LINE, color: '#fff', border: "1px solid var(--h-border)", borderRadius: 14, boxShadow: '0 16px 38px -14px rgba(232,132,43,0.6)', padding: '0.7rem 0.95rem', cursor: 'pointer', font: 'inherit', animation: 'fbToastIn 0.25s ease' }}>
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
        .friendTodayHero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0,1fr); gap: 1rem; background: radial-gradient(circle at 88% 18%, rgba(224,69,127,0.07), transparent 24%), linear-gradient(135deg, color-mix(in srgb, ${LINE} 7%, var(--h-surface)) 0%, var(--h-surface) 72%); border: 1px solid color-mix(in srgb, ${LINE} 18%, var(--h-border)); border-radius: 28px; box-shadow: 0 24px 70px -48px rgba(232,132,43,0.42), var(--shadow-sm); padding: 1.25rem; margin-bottom: 1rem; }
        .friendTodayHero::after { content: ''; position: absolute; right: -78px; bottom: -96px; width: 220px; height: 220px; border: 1px solid rgba(255,106,31,0.14); border-radius: 50%; box-shadow: 0 0 0 32px rgba(255,106,31,0.035), 0 0 0 66px rgba(224,69,127,0.018); pointer-events: none; }
        .friendHeroSignal { position: relative; z-index: 1; display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.65rem; }
        .friendHeroKicker { font-family: 'DM Mono', monospace; font-size: 0.54rem; letter-spacing: 0.18em; text-transform: uppercase; color: ${LINE_DEEP}; }
        .friendHeroTitle { font-family: 'Bebas Neue', sans-serif; font-size: clamp(2.05rem, 6vw, 3rem); line-height: 0.95; letter-spacing: 0.01em; margin: 0; color: var(--h-text); }
        .friendHeroCopy { font-family: Georgia, serif; font-style: italic; font-size: 0.95rem; line-height: 1.5; color: var(--h-text-dim); margin: 0.55rem 0 0; max-width: 52ch; }
        .friendHeroActions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1rem; }
        .friendHeroPrimary, .friendHeroSecondary { border: 1px solid var(--h-border); border-radius: 999px; padding: 0.62rem 1rem; font-family: 'Bebas Neue', sans-serif; font-size: 1rem; letter-spacing: 0.04em; cursor: pointer; text-decoration: none; }
        .friendHeroPrimary { background: ${LINE}; color: #fff; box-shadow: 0 12px 26px -14px rgba(232,132,43,0.75); }
        .friendHeroSecondary { background: var(--h-surface); color: var(--h-text); }
        .friendHeroStats { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0.55rem; }
        .friendHeroStats div { background: color-mix(in srgb, var(--h-surface) 88%, ${LINE} 5%); border: 1px solid var(--h-border); border-radius: 14px; padding: 0.85rem; }
        .friendHeroStats strong { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; line-height: 0.9; color: ${LINE_DEEP}; }
        .friendHeroStats span { display: block; margin-top: 0.35rem; font-family: 'DM Mono', monospace; font-size: 0.5rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--h-text-dim); }
        .friendFocus { position: relative; overflow: hidden; background: #101010; color: #fff; border: 1px solid var(--h-border); border-radius: 24px; box-shadow: var(--shadow-md); padding: 1rem; margin: 1rem 0 0.5rem; }
        .friendFocus::after { content: ''; position: absolute; right: -46px; top: -58px; width: 140px; height: 140px; border: 1px solid rgba(255,255,255,0.18); border-radius: 50%; box-shadow: 0 0 0 28px rgba(255,255,255,0.06); pointer-events: none; }
        .friendFocusMeta { font-family: 'DM Mono', monospace; font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.66); margin-bottom: 0.65rem; }
        .friendFocusBody { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .friendFocus h2 { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; line-height: 0.95; letter-spacing: 0.01em; margin: 0; }
        .friendFocus p { font-family: Georgia, serif; font-style: italic; font-size: 0.9rem; color: rgba(255,255,255,0.72); margin: 0.4rem 0 0; }
        @media (min-width: 720px) { .friendTodayHero { grid-template-columns: minmax(0,1fr) 260px; align-items: stretch; } }
        @media (max-width: 560px) { .friendHeroSignal { align-items: flex-start; } .friendHeroActions { flex-direction: column; } .friendHeroPrimary, .friendHeroSecondary { width: 100%; text-align: center; } .friendFocusBody { align-items: flex-start; flex-direction: column; } .friendHeroStats { grid-template-columns: repeat(2,minmax(0,1fr)); } }
        .fmGrid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 880px) {
          .fmGrid { grid-template-columns: minmax(0,1fr) 320px; align-items: start; }
          .fmRail { grid-column: 2; grid-row: 1; position: sticky; top: 1rem; }
          .fmMain { grid-column: 1; grid-row: 1; }
        }
        /* Scene = filters/categories on the LEFT, the feed in the MIDDLE (pack + around live in the shared right rail). */
        .sceneGrid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 760px) {
          .sceneGrid { grid-template-columns: minmax(0,1fr); align-items: start; }
        }
        .fmMap { position: relative; min-height: min(72vh, 600px); margin: 1.25rem 0 0; }
        .fmMapLine { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
        .fmStop { position: absolute; transform: translateX(-50%); width: min(300px, 84vw); text-align: left; display: flex; flex-direction: column; background: var(--h-surface); border: 1px solid var(--h-border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); padding: 1.4rem 1.3rem 1.2rem; cursor: pointer; color: var(--h-text); font: inherit; min-height: 190px; z-index: 1; transition: transform .12s ease, box-shadow .12s ease; }
        .fmStop:hover { transform: translate(calc(-50% - 2px), -3px); box-shadow: var(--shadow-lg); }
        .fmStopDot { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 20px; height: 20px; border-radius: 50%; background: ${CREAM}; border: 5px solid ${LINE}; box-shadow: 0 0 0 3px var(--h-surface); }
        @media (max-width: 759px) {
          .fmMap { min-height: 0; display: flex; flex-direction: column; gap: 1.6rem; padding-top: 0.6rem; }
          .fmStop { position: static; transform: none; width: auto; }
          .fmStop:hover { transform: translate(-2px,-3px); }
          .fmMapLine { display: none; }
        }
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

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,8vw,3.6rem)', lineHeight: 0.92, color: 'var(--h-text)', margin: '0.6rem 0 1.4rem' }}>
          your people are <span style={{ color: 'var(--h-accent)' }}>out there.</span>
        </h1>

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
          <HomeFeed me={me} firstName={firstName} acts={acts} people={people} myEvents={myEvents} hasCrew={matches.length > 0} city={city}
            onCrew={() => setView('crew')} onScene={() => setView('scene')} onStart={() => { setView('scene'); setComposerStep(1); setComposerOpen(true); }} onRsvp={rsvp} onAuthor={openAuthorCard} />
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
                  <a href="mailto:match@notcupid.com" style={{ display: 'inline-block', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', background: INK, border: `1px solid var(--h-border)`, borderRadius: 10, padding: '0.55rem 1rem', boxShadow: '0 10px 24px -12px rgba(0,0,0,0.45)', textDecoration: 'none' }}>
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
          ) : (!chat.circleId && matches.some((m) => !m.connected && !m.iAccepted)) ? (
            <div style={{ ...card, padding: '1rem 1.2rem', marginBottom: '1.1rem' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', marginBottom: '0.6rem', color: 'var(--h-text-dim)', fontSize: '0.92rem' }}>
                a <b style={{ color: 'var(--h-text)' }}>pack</b> is a batch of people to meet. <b>choose your pack</b> to open one group chat with everyone — then tap <b>connect</b> on anyone in <b>your pack</b> (over on the right) for a private 1:1.
              </div>
              <button onClick={choosePack} disabled={busy || !termsOk}
                style={{ ...poppyBtn, width: '100%', opacity: termsOk ? 1 : 0.45, cursor: termsOk && !busy ? 'pointer' : 'not-allowed' }}>
                {busy ? '…' : '🎒 choose this pack — open the pack chat →'}
              </button>
            </div>
          ) : null}

          {/* YOUR CLUBS — clubs you're in show up in your circle too, each with its chat */}
          {(() => { const mine = clubs.filter((c: any) => c.myStatus === 'member' || c.myStatus === 'owner'); return mine.length > 0 && (
            <div style={{ ...card, padding: '0.9rem 1rem', marginBottom: '1rem' }}>
              <div style={sideHd}>🤝 your clubs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
                {mine.map((c: any) => (
                  <button key={c.id} onClick={() => openClubChat({ id: c.id, name: c.name })}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 12, padding: '0.5rem 0.75rem', cursor: 'pointer', font: 'inherit', color: 'var(--h-text)', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{CAT_EMOJI[c.category] || '✨'}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>{c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}{c.myStatus === 'owner' ? ' · you run it' : ''}</div>
                    </div>
                    {c.myStatus === 'owner' && c.pendingCount > 0 && <span onClick={(e) => { e.stopPropagation(); openClubManage({ id: c.id, name: c.name }); }} style={{ flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', color: '#fff', background: '#da291c', borderRadius: 999, padding: '0.12rem 0.45rem' }}>{c.pendingCount} req</span>}
                    <span style={{ flexShrink: 0, fontSize: '0.9rem', color: LINE_DEEP }}>💬</span>
                  </button>
                ))}
              </div>
            </div>
          ); })()}

          {/* LOWER — the group chat, full-width now (friend card lives up top) */}
          <div className="crewLower">
            {/* CHAT — roomy, full-width */}
            <div>
              {(chat.circleId || matches.length > 0) && (
                <>
                  <button onClick={() => { setChatOpen((v) => !v); setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80); }}
                    style={{ ...poppyBtn, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💬 pack chat</span>
                    <span style={{ fontSize: '0.8rem' }}>{chatOpen ? '▲ hide' : `▾ ${crewRoster.length}`}</span>
                  </button>
                  <div ref={chatRef} />
                  {chatOpen && (
                    <div style={{ ...card, overflow: 'hidden', marginTop: '0.6rem', padding: 0 }}>
                      {/* header + who's-here roster — names, not just avatars */}
                      <div style={{ background: LINE, color: '#fff', padding: '0.6rem 0.85rem 0.7rem', borderBottom: "1px solid var(--h-border)" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}>
                          💬 your pack · {crewRoster.length}
                          <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: chatLive ? '#3f7d57' : 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0.18rem 0.55rem' }}>
                            {chatLive ? '● live' : '○ forming'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginTop: '0.55rem', paddingBottom: '0.1rem' }} className="crewWho">
                          {crewRoster.map((u) => (
                            <button key={u.id} onClick={() => { if (u.you) return; const mm = matches.find((x) => x.otherId === u.id); if (mm) setCardMember(mm); }} title={u.here ? `${u.name} · in the chat` : `${u.name} · invited`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, cursor: u.you ? 'default' : 'pointer', font: 'inherit', background: 'var(--h-surface)', color: 'var(--h-text)', border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.18rem 0.55rem 0.18rem 0.22rem' }}>
                              {u.photo_url
                                ? <img src={u.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: `1px solid var(--h-border)` }} />
                                : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--h-surface-3)', border: `1px solid var(--h-border)`, display: 'inline-block' }} />}
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', whiteSpace: 'nowrap', fontWeight: u.you ? 700 : 400 }}>{u.you ? 'you' : (u.name?.split(' ')[0] || '—')}</span>
                              {!u.you && matches.find((x) => x.otherId === u.id)?.connected && <span title="your connection — message them" style={{ fontSize: '0.7rem', flexShrink: 0 }}>🧡</span>}
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.here ? '#3f7d57' : '#c9a06a', flexShrink: 0 }} />
                            </button>
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
                          <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="say something to the pack…" style={{ flex: 1, border: `1px solid var(--h-border)`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.9rem' }} />
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
        <div>
          <h2 style={sectionLabel}><StationDot />🌆 city pulse</h2>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', margin: '-0.3rem 0 1.3rem', fontSize: '0.98rem' }}>
            city vibes — find your tribe. the clubs, crews &amp; community hubs of {city ? city.split(',')[0].toLowerCase() : 'your city'}.
          </p>

          {/* CLUBS — user-run groups (book club, run club). Join by request → the
              creator approves, then it's in your circle with its own chat. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.75rem' }}>
            <h3 style={{ ...sectionLabel, margin: 0, fontSize: '1.3rem' }}>🤝 clubs</h3>
            <button onClick={() => setShowNewClub((v) => !v)} style={{ ...poppyBtn, marginLeft: 'auto', fontSize: '0.95rem', padding: '0.38rem 0.9rem' }}>{showNewClub ? '✕ cancel' : '+ start a club'}</button>
          </div>
          {showNewClub && (
            <div style={{ ...card, padding: '1rem 1.1rem', marginBottom: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <input value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} maxLength={80} placeholder="club name (e.g. sunday run club)" style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select value={newClub.category} onChange={(e) => setNewClub({ ...newClub, category: e.target.value })} style={{ ...inputStyle, flex: '0 0 auto' }}>{CLUB_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <input value={newClub.area} onChange={(e) => setNewClub({ ...newClub, area: e.target.value })} maxLength={60} placeholder="📍 area (optional)" style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
              </div>
              <textarea value={newClub.description} onChange={(e) => setNewClub({ ...newClub, description: e.target.value })} maxLength={400} placeholder="what's it about? when do you meet?" rows={2} style={{ ...inputStyle, resize: 'vertical', borderRadius: 12 }} />
              <button onClick={createClub} disabled={clubBusy || !newClub.name.trim() || !termsOk} style={{ ...poppyBtn, alignSelf: 'flex-start', opacity: newClub.name.trim() && termsOk ? 1 : 0.5 }}>{clubBusy ? '…' : 'create the club →'}</button>
            </div>
          )}
          {clubs.length === 0 ? (
            <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>no clubs in your city yet — start the first one ☝️</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {clubs.map((c) => (
                <div key={c.id} style={{ ...card, padding: '0.9rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ fontSize: '1.7rem', flexShrink: 0 }}>{CAT_EMOJI[c.category] || '✨'}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', lineHeight: 1 }}>{c.name}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.2rem' }}>{c.category} · {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'} · by {(c.creatorName || '').split(' ')[0]}{c.area ? ` · 📍 ${c.area}` : ''}</div>
                    </div>
                    <button onClick={async () => { if (confirm(`report "${c.name}" to the team?`)) { await clubAct(c.id, 'report'); await loadClubs(); } }} title="report this club" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--h-text-faint)', fontSize: '0.85rem', flexShrink: 0 }}>⚑</button>
                  </div>
                  {c.description && <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--h-text-dim)' }}>{c.description}</p>}
                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                    {c.myStatus === 'owner' ? (<>
                      <button onClick={() => openClubManage(c)} style={pulseBtn}>👀 requests{c.pendingCount ? ` (${c.pendingCount})` : ''}</button>
                      <button onClick={() => openClubChat(c)} style={{ ...poppyBtn, fontSize: '0.9rem', padding: '0.35rem 0.85rem' }}>💬 chat →</button>
                    </>) : c.myStatus === 'member' ? (<>
                      <button onClick={() => openClubChat(c)} style={{ ...poppyBtn, fontSize: '0.9rem', padding: '0.35rem 0.85rem' }}>💬 chat →</button>
                      <button onClick={async () => { await clubAct(c.id, 'leave'); await loadClubs(); }} style={pulseBtnGhost}>leave</button>
                    </>) : c.myStatus === 'pending' ? (
                      <span style={{ ...pulseBtnGhost, opacity: 0.7 }}>⏳ requested</span>
                    ) : (
                      <button onClick={async () => { await clubAct(c.id, 'join'); await loadClubs(); }} disabled={!termsOk} style={{ ...poppyBtn, fontSize: '0.9rem', padding: '0.35rem 0.85rem', opacity: termsOk ? 1 : 0.5 }}>🙋 request to join</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMMUNITY CHATS — submitted Discord/group-chat links (admin-approved). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '1.7rem 0 0.75rem' }}>
            <h3 style={{ ...sectionLabel, margin: 0, fontSize: '1.3rem' }}>💬 community hubs</h3>
            <button onClick={() => setShowNewLink((v) => !v)} style={{ ...pulseBtnGhost, marginLeft: 'auto' }}>{showNewLink ? '✕ cancel' : '+ submit a link'}</button>
          </div>
          {showNewLink && (
            <div style={{ ...card, padding: '1rem 1.1rem', marginBottom: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <input value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} maxLength={100} placeholder="what is it? (e.g. boston runners discord)" style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select value={newLink.kind} onChange={(e) => setNewLink({ ...newLink, kind: e.target.value })} style={{ ...inputStyle, flex: '0 0 auto' }}>{LINK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                <input value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} maxLength={400} placeholder="paste the invite link" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
              </div>
              <button onClick={submitLink} disabled={clubBusy || !newLink.title.trim() || !newLink.url.trim()} style={{ ...poppyBtn, alignSelf: 'flex-start', opacity: newLink.title.trim() && newLink.url.trim() ? 1 : 0.5 }}>{clubBusy ? '…' : 'submit for review →'}</button>
              <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--h-text-faint)' }}>we review every link before it goes live — keeps the spam out.</span>
            </div>
          )}
          {comLinks.length === 0 ? (
            <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>no community hubs yet — submit a Discord or group-chat link (we review before it shows).</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {comLinks.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" style={{ ...card, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', textDecoration: 'none', color: 'var(--h-text)' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{KIND_EMOJI[l.kind] || '🔗'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', lineHeight: 1 }}>{l.title}</div>
                    {l.description && <div style={{ fontSize: '0.82rem', color: 'var(--h-text-dim)', marginTop: '0.1rem' }}>{l.description}</div>}
                  </div>
                  <span style={{ ...poppyBtn, fontSize: '0.85rem', padding: '0.32rem 0.8rem', flexShrink: 0 }}>join →</span>
                </a>
              ))}
            </div>
          )}
        </div>
        )}

        {view === 'scene' && (
        <div>
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 5.5vw, 2.8rem)', lineHeight: 0.95, letterSpacing: '0.01em', margin: 0 }}>The Scene</h1>
          <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--h-text-dim)', margin: '0.25rem 0 0' }}>Plans, posts and open invites from people in and around {city || 'your city'}.</p>
        </div>

        {/* unified filter bar — kind · time · near me */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem' }}>
          {([['all', 'All'], ['event', 'Plans'], ['post', 'Talk']] as const).map(([k, label]) => {
            const on = kindFilter === k;
            return <button key={k} onClick={() => setKindFilter(k)} style={{ ...chip, cursor: 'pointer', fontSize: '0.66rem', padding: '0.4rem 0.85rem', background: on ? LINE : 'var(--h-surface-3)', color: on ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${on ? LINE : 'var(--h-border)'}` }}>{label}</button>;
          })}
          <span style={{ width: 1, height: 18, background: 'var(--h-border)', margin: '0 0.2rem' }} />
          {([['tonight', '🌙 Tonight'], ['weekend', '🗓 This Weekend']] as const).map(([k, label]) => {
            const on = sceneTime === k;
            return <button key={k} onClick={() => setSceneTime(on ? 'all' : k)} style={{ ...chip, cursor: 'pointer', fontSize: '0.66rem', padding: '0.4rem 0.85rem', background: on ? '#ffd23d' : 'var(--h-surface-3)', color: on ? INK : 'var(--h-text-dim)', border: `1px solid ${on ? '#ffd23d' : 'var(--h-border)'}` }}>{label}</button>;
          })}
          <button onClick={() => setNearMe((v) => !v)} style={{ ...chip, cursor: 'pointer', fontSize: '0.66rem', padding: '0.4rem 0.85rem', background: nearMe ? '#ffd23d' : 'var(--h-surface-3)', color: nearMe ? INK : 'var(--h-text-dim)', border: `1px solid ${nearMe ? '#ffd23d' : 'var(--h-border)'}` }}>📍 Near me</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
            {([['new', '🆕'], ['popular', '🔥']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setSceneSort(k)} title={k} style={{ ...chip, cursor: 'pointer', fontSize: '0.66rem', padding: '0.4rem 0.7rem', background: sceneSort === k ? 'var(--h-accent)' : 'var(--h-surface-3)', color: sceneSort === k ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${sceneSort === k ? 'var(--h-accent)' : 'var(--h-border)'}` }}>{label} {k}</button>
            ))}
          </div>
        </div>
        {/* interest chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
          {SCENE_INTERESTS.map((it) => {
            const on = interest === it.label;
            return <button key={it.label} onClick={() => setInterest(on ? '' : it.label)} style={{ ...chip, cursor: 'pointer', fontSize: '0.64rem', padding: '0.35rem 0.75rem', background: on ? LINE : 'var(--h-surface-2)', color: on ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${on ? LINE : 'var(--h-border)'}` }}>{it.emoji} {it.label}</button>;
          })}
        </div>

        <div className="sceneGrid">
          <div className="sceneMid">
        {/* composer trigger → guided wizard */}
        <button onClick={() => { setComposerStep(1); setComposerOpen(true); }} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '0.9rem 1rem', marginBottom: '1.1rem', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
          {me?.photo_url
            ? <img src={me.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid var(--h-border)`, background: 'var(--h-surface-3)', flexShrink: 0 }} />}
          <span style={{ flex: 1, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--h-text-dim)' }}>what do you want to do, {firstName.toLowerCase()}?</span>
          <span style={{ ...poppyBtn, fontSize: '0.95rem', padding: '0.4rem 1rem' }}>📣 start a plan →</span>
        </button>

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
              const interestCats = interest ? (SCENE_INTERESTS.find((i) => i.label === interest)?.cats || []) : [];
              const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              const isTonight = (a: any) => !!a.happens_at && startOf(new Date(a.happens_at)) === startOf(new Date());
              const isWeekend = (a: any) => { if (!a.happens_at) return false; const d = new Date(a.happens_at); const day = d.getDay(); const days = (startOf(d) - startOf(new Date())) / 86400000; return (day === 0 || day === 6) && days >= 0 && days <= 8; };
              const shown = acts.filter((a) =>
                (kindFilter === 'all' || (a.kind || 'event') === kindFilter) &&
                (!areaFilter || a.area === areaFilter) &&
                (!nearMe || !myArea || a.area === myArea) &&
                (sceneTime === 'all' || (sceneTime === 'tonight' ? isTonight(a) : isWeekend(a))) &&
                (interestCats.length ? interestCats.includes(a.category) : true) &&
                (filterCat ? a.category === filterCat : filterMain ? subTags.includes(a.category) : true))
                .sort((a, b) => sceneSort === 'popular'
                  ? ((b.rsvpCount || 0) - (a.rsvpCount || 0)) || String(b.created_at || '').localeCompare(String(a.created_at || ''))
                  : String(b.created_at || '').localeCompare(String(a.created_at || '')));
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {shown.length === 0 && <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-dim)' }}>{kindFilter === 'event' ? 'no plans here yet — start one above!' : 'nothing here yet — be the one to start something.'}</div>}
                  {shown.map((a) => <ActivityPost key={a.id} a={a} onRsvp={rsvp} onDelete={deleteAct} onAuthor={openAuthorCard} />)}
                </div>
              );
            })()}
          </div>
        </div>
        </div>
        )}
          </main>
          <aside className="fbRail">
            {/* CITY PULSE — your clubs on the right (quick chat access) */}
            {view === 'pulse' && (
            <div style={{ ...card, padding: '0.9rem 1rem' }}>
              <div style={sideHd}>🤝 your clubs</div>
              {(() => { const mine = clubs.filter((c: any) => c.myStatus === 'member' || c.myStatus === 'owner'); return mine.length === 0 ? (
                <div style={sideEmpty}>not in any clubs yet — join one, or start your own.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.55rem' }}>
                  {mine.map((c: any) => (
                    <button key={c.id} onClick={() => openClubChat({ id: c.id, name: c.name })} title={`open ${c.name}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: '0.34rem 0.4rem', borderRadius: 8, color: 'var(--h-text)', textAlign: 'left' }}>
                      <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{CAT_EMOJI[c.category] || '✨'}</span>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      {c.myStatus === 'owner' && c.pendingCount > 0 && <span style={{ flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', color: '#fff', background: '#da291c', borderRadius: 999, padding: '0.05rem 0.35rem' }}>{c.pendingCount}</span>}
                      <span style={{ flexShrink: 0, fontSize: '0.8rem', color: LINE_DEEP }}>💬</span>
                    </button>
                  ))}
                </div>
              ); })()}
            </div>
            )}

            {/* CITY PULSE — where it's happening (city hubs / active zones) */}
            {view === 'pulse' && pulse && pulse.areas && pulse.areas.length > 0 && (
            <div style={{ ...card, padding: '0.9rem 1rem', marginTop: '0.85rem' }}>
              <div style={sideHd}>📍 where it&apos;s happening</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.55rem' }}>
                {[...pulse.areas].sort((a: any, b: any) => (b.members + (b.activities || 0)) - (a.members + (a.activities || 0))).slice(0, 12).map((z: any, i: number) => (
                  <button key={z.area} onClick={() => { setAreaFilter(z.area); setView('scene'); }} title={`${z.members} around · ${z.activities || 0} happening — see it on the scene`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: '0.34rem 0.4rem', borderRadius: 8, color: 'var(--h-text)', textAlign: 'left' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i === 0 ? '🔥 ' : ''}{z.area}</span>
                    <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: 'var(--h-text-faint)' }}>{z.members ? `${z.members}👤` : ''}{z.activities ? `${z.members ? ' · ' : ''}${z.activities} ev` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
            )}

            {view !== 'scene' && view !== 'pulse' && (
            <div style={{ ...card, padding: '0.9rem 1rem' }}>
              <div style={sideHd}>🧡 your connections</div>
              {matches.filter((m) => m.connected).length === 0 ? (
                <div style={sideEmpty}>no connections yet — pick someone in your circle to connect.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.55rem' }}>
                  {matches.filter((m) => m.connected).slice(0, 8).map((m) => (
                    <button key={m.otherId} onClick={() => setCardMember(m)} title={`view ${(m.name || '').split(' ')[0]}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, color: 'var(--h-text)', textAlign: 'left' }}>
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
                    <button onClick={() => setCardMember(m)} title={`view ${(m.name || '').split(' ')[0]}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--h-text)', textAlign: 'left' }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--h-border)', flexShrink: 0 }} />
                        : <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', flexShrink: 0, display: 'inline-block' }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name} <span style={{ color: 'var(--h-text-faint)', fontSize: '0.7rem' }}>· {m.age}</span></div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: m.connected ? LINE_DEEP : m.theyAccepted ? '#ff2d8e' : 'var(--h-text-faint)' }}>{m.score}% · {m.connected ? '🧡 connection' : m.theyAccepted ? 'wants to connect' : m.iAccepted ? 'pending' : 'new'}</div>
                      </div>
                    </button>
                    {m.connected ? (
                      <span style={{ flexShrink: 0, fontSize: '0.85rem' }} title="connected — message them">🧡</span>
                    ) : (m.iAccepted && !m.theyAccepted) ? (
                      <span style={{ flexShrink: 0, fontSize: '0.85rem' }} title="waiting on them">⏳</span>
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
                <a href="/friends/pack" style={{ display: 'block', marginTop: '0.8rem', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(135deg, #ff6a1f, #d2530f)', color: '#fff', borderRadius: 'var(--r-sm)', padding: '0.55rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.02em', boxShadow: '0 12px 26px -16px rgba(255,106,31,0.6)' }}>🎒 open sealed pack · {sealedCount} new to meet →</a>
              )}
              <a href="/friends/pack" style={{ ...poppyBtn, display: 'block', marginTop: '0.7rem', textAlign: 'center', textDecoration: 'none', fontSize: '0.95rem', padding: '0.5rem' }}>open another pack · $1.99</a>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: 'var(--h-text-faint)', fontSize: '0.66rem', marginTop: '0.5rem', textAlign: 'center' }}>first pack free · <a href="/pro" style={{ color: LINE_DEEP }}>Pro</a> makes packs free</div>
              <button onClick={leaveCrew} disabled={busy} style={{ display: 'block', width: '100%', marginTop: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: 3 }}>{busy ? '…' : 'opt out of the group →'}</button>
            </div>
            )}

            {view === 'scene' && (
            <div style={{ ...card, padding: '0.9rem 1rem' }}>
              <div style={sideHd}>🎒 your pack</div>
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
                      {(() => { const conn = matches.find((mm) => mm.connected && mm.otherId === p.id); return conn ? (
                        <button onClick={() => openDm(conn)} title={`message ${(p.name || '').split(' ')[0]}`} style={{ marginLeft: 'auto', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', background: LINE, border: 'none', borderRadius: 999, padding: '0.12rem 0.45rem', flexShrink: 0 }}>🧡 connection</button>
                      ) : p.tag ? (
                        <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-accent)', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.1rem 0.4rem', flexShrink: 0 }}>{p.tag}</span>
                      ) : null; })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
