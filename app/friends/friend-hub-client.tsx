'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { NEIGHBORHOODS } from '@/lib/neighborhoods';
import ReactivateButton from '@/components/reactivate-button';

// ── Friend Line theme (warm MBTA transit) ──
const INK = '#241d12';           // warm near-black (signage)
const LINE = '#e8842b';          // the Friend Line — warm orange
const LINE_DEEP = '#c96a18';     // deeper orange for shadows/hover
const CREAM = '#f7f1e3';         // warm station-tile cream
const CATS = ['food', 'drinks', 'active', 'outdoors', 'culture', 'nightlife', 'games', 'chill', 'hang'];

const card: React.CSSProperties = { background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 16, boxShadow: `5px 5px 0 ${INK}` };
const chip: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', background: '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.2rem 0.55rem' };
// Section headers look like station stops: a Friend-Line dot on the route.
const sectionLabel: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.04em', margin: '2rem 0 0.9rem', display: 'flex', gap: '0.55rem', alignItems: 'center' };
const poppyBtn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', color: '#fff', background: LINE, border: `3px solid ${INK}`, borderRadius: 12, padding: '0.55rem 1.4rem', boxShadow: `4px 4px 0 ${INK}`, cursor: 'pointer' };
// A station dot to prefix section labels (the route runs through the page).
const StationDot = () => <span style={{ width: 16, height: 16, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}`, flexShrink: 0, display: 'inline-block' }} />;

// Faint transit map behind everything: T-line colors criss-crossing + iconic
// Boston station/spot names as ghost labels. Decorative, pointer-events:none.
const T_RED = '#da291c', T_BLUE = '#003da5', T_GREEN = '#00843d', T_ORANGE = '#ed8b00';
// Funky Boston phrases/places as ghost accents (not literal T stops).
const SPOTS: Array<[string, string, string]> = [
  ['wicked pissah', '6%', '13%'], ['the Citgo sign', '60%', '8%'], ['Dunkies run', '30%', '19%'],
  ['the Common', '80%', '25%'], ['Sully’s on Castle Is.', '10%', '39%'], ['Newbury St', '70%', '37%'],
  ['the Esplanade', '40%', '51%'], ['Tasty Burger', '85%', '57%'], ['the Gahden', '8%', '66%'],
  ['cannoli @ Mike’s', '54%', '72%'], ['Wally’s jazz', '78%', '80%'], ['Spectacle Island', '20%', '86%'],
  ['Davis porchfest', '46%', '90%'], ['Charles river', '88%', '12%'],
];
// City Pulse — a live "departure board" of three headline stats.
function PulseBoard({ stats, line, ink, deep }: { stats: { n: number; label: string; icon: string; onClick?: () => void }[]; line: string; ink: string; deep: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem' }}>
      {stats.map((t) => {
        const Tag: any = t.onClick ? 'button' : 'div';
        return (
          <Tag key={t.label} onClick={t.onClick}
            style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', background: '#fffdf7', border: `3px solid ${ink}`, borderRadius: 14, boxShadow: `4px 4px 0 ${ink}`, padding: '0.7rem 0.75rem 0.6rem', cursor: t.onClick ? 'pointer' : 'default', font: 'inherit', color: ink }}>
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: line }} />
            <div style={{ fontSize: '1rem', marginTop: '0.2rem' }}>{t.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', lineHeight: 0.9, color: deep }}>{t.n}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b4a2f', marginTop: '0.15rem' }}>{t.label}</div>
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
  if (scored.length === 0) return <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>quiet out there right now — be the first to start something.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {scored.map((a, i) => {
        const sel = active === a.area;
        const hot = i === 0 && a.score > 0;
        const pct = Math.max(8, Math.round((a.score / max) * 100));
        return (
          <button key={a.area} onClick={() => onPick(a.area)} title={`see what's happening in ${a.area}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', background: sel ? '#fff7e6' : '#fffdf7', border: `2.5px solid ${ink}`, borderRadius: 12, boxShadow: sel ? `3px 3px 0 ${ink}` : `2px 2px 0 ${ink}`, padding: '0.5rem 0.7rem', cursor: 'pointer', font: 'inherit', color: ink }}>
            <span style={{ width: 96, flexShrink: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hot && '🔥 '}{a.area}
            </span>
            <span style={{ flex: 1, height: 12, background: '#f1e2c8', borderRadius: 999, border: `1.5px solid ${ink}`, overflow: 'hidden' }}>
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

// SVG paper-grain (fractal noise) data-URI — gives the flat cream a crafted,
// printed-poster texture without loading an image.
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function TransitBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* warm radial glow so it isn't flat beige */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -10%, rgba(232,132,43,0.14), transparent 60%), radial-gradient(100% 70% at 100% 100%, rgba(63,125,87,0.10), transparent 55%)' }} />
      {/* the T map — richer, softly blurred so it reads as ambient */}
      <svg viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, filter: 'blur(0.4px)' }}>
        <g fill="none" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-40 180 L260 180 L420 340 L420 1100 L600 1280 L1100 1280" stroke={T_RED} />
          <path d="M-40 420 L380 420 L520 560 L1100 560" stroke={T_BLUE} />
          <path d="M120 -40 L120 520 L320 720 L320 1450" stroke={T_GREEN} />
          <path d="M1080 120 L720 120 L560 280 L560 1450" stroke={T_ORANGE} />
        </g>
        {[[260,180,T_RED],[420,340,T_RED],[380,420,T_BLUE],[520,560,T_BLUE],[120,520,T_GREEN],[320,720,T_GREEN],[720,120,T_ORANGE],[560,280,T_ORANGE]].map(([x,y,c],i)=>(
          <circle key={i} cx={x as number} cy={y as number} r="15" fill="#fffdf7" stroke={c as string} strokeWidth="7" opacity="0.7" />
        ))}
      </svg>
      {SPOTS.map(([name, left, top], i) => (
        <span key={name} style={{
          position: 'absolute', left, top,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: i % 3 === 0 ? '2.1rem' : '1.45rem',
          letterSpacing: '0.05em', color: i % 2 ? LINE_DEEP : '#3f7d57', opacity: 0.2,
          transform: `rotate(${i % 2 ? -5 : 4}deg)`, whiteSpace: 'nowrap',
        }}>◉ {name}</span>
      ))}
      {/* paper grain on top, multiplied so it textures everything below */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.12, mixBlendMode: 'multiply' }} />
    </div>
  );
}

// ── old-school-FB shell pieces (warm transit palette) ──
type NavKey = 'home' | 'map' | 'scene' | 'crew' | 'pulse';
const NAV: Array<{ key: NavKey; icon: string; label: string }> = [
  { key: 'home', icon: '🏠', label: 'home' },
  { key: 'map', icon: '🗺️', label: 'the map' },
  { key: 'scene', icon: '🚇', label: 'the scene' },
  { key: 'crew', icon: '🎒', label: 'my crew' },
  { key: 'pulse', icon: '🌆', label: 'city pulse' },
];
const sideHd: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP, fontWeight: 700 };
const sideEmpty: React.CSSProperties = { fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f', fontSize: '0.82rem', marginTop: '0.4rem' };
const miniCount: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999, background: LINE, color: '#fff', border: `1.5px solid ${INK}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

type Person = { id: string; name: string; photo_url: string | null; tag?: string };

// The left rail: FB-style nav + active-crew stat + people + zones. Uses the
// module palette directly so the call site stays clean.
function FriendSidebar({ view, setView, activeGroups, people, zones, onZone, crewBadge }: {
  view: NavKey; setView: (v: NavKey) => void; activeGroups: number; people: Person[]; zones: any[]; onZone: (a: string) => void; crewBadge: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <nav className="fbSideNav" style={{ ...card, padding: '0.45rem' }}>
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button key={n.key} onClick={() => setView(n.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', background: active ? LINE : 'transparent', color: active ? '#fff' : INK, border: 'none', borderRadius: 10, padding: '0.5rem 0.7rem', cursor: 'pointer', font: 'inherit', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.03em' }}>
              <span style={{ fontSize: '1.05rem' }}>{n.icon}</span>{n.label}
              {n.key === 'crew' && crewBadge && <span style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: '#da291c', border: `2px solid ${active ? '#fff' : INK}` }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ ...card, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: activeGroups > 0 ? '#3f7d57' : '#c9a06a', boxShadow: activeGroups > 0 ? '0 0 0 4px rgba(63,125,87,0.18)' : 'none' }} />
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', lineHeight: 1 }}>{activeGroups} {activeGroups === 1 ? 'crew' : 'crews'} live</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b4a2f' }}>hanging right now</div>
        </div>
      </div>

      <div style={{ ...card, padding: '0.8rem 0.9rem' }}>
        <div style={sideHd}>👥 on the line</div>
        {people.length === 0 ? <div style={sideEmpty}>finding your people…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.55rem' }}>
            {people.slice(0, 8).map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${INK}`, flexShrink: 0 }} />
                  : <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#fbe6cf', border: `2px solid ${INK}`, flexShrink: 0, display: 'inline-block' }} />}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name?.split(' ')[0] || '—'}</span>
                {p.tag && <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: LINE_DEEP, background: '#fbe6cf', border: `1.5px solid ${INK}`, borderRadius: 999, padding: '0.1rem 0.4rem', flexShrink: 0 }}>{p.tag}</span>}
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
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', padding: '0.3rem 0.1rem', color: INK, borderRadius: 6 }}>
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
  firstName: string; activeGroups: number; popular: any[]; hasCrew: boolean; onCrew: () => void; onScene: () => void; onRsvp: (id: string) => void; onDelete: (id: string) => void; onOpen: (v: NavKey) => void;
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
          <button onClick={onScene} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.04em', color: INK, background: '#ffd23d', border: `3px solid ${INK}`, borderRadius: 12, padding: '0.45rem 0.95rem', boxShadow: `3px 3px 0 ${INK}`, cursor: 'pointer' }}>📣 post →</button>
        </div>
      </div>

      <h2 style={sectionLabel}><StationDot />🔥 what&apos;s popping</h2>
      {popular.length === 0 ? (
        <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>
          nothing on the board yet — <button onClick={onScene} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, textDecoration: 'underline', font: 'inherit', fontStyle: 'italic' }}>be the first to post →</button>
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

// One Scene post, FB-post structured: header (who/when) · body · action bar.
function ActivityPost({ a, onRsvp, onDelete }: { a: any; onRsvp: (id: string) => void; onDelete: (id: string) => void }) {
  const isEvent = (a.kind || 'event') !== 'post';
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.8rem 1rem 0.5rem' }}>
        {a.authorPhoto
          ? <img src={a.authorPhoto} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', lineHeight: 1 }}>{a.authorName?.split(' ')[0] || 'someone'}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: '#a8896a', marginTop: '0.2rem' }}>
            {isEvent ? '📅 plan' : '💬 post'} · 📍 {a.area || 'greater boston'}{a.created_at ? ` · ${timeAgo(a.created_at)}` : ''}
          </div>
        </div>
        <span style={{ ...chip, flexShrink: 0 }}>{a.category}</span>
        {a.isMine && <button onClick={() => onDelete(a.id)} title="delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>✕</button>}
      </div>
      <div style={{ padding: '0 1rem 0.75rem' }}>
        <div style={{ fontSize: '1.02rem', lineHeight: 1.4 }}>{a.title}</div>
        {isEvent && a.happens_at && (
          <div style={{ marginTop: '0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', ...chip, background: '#fff7e6' }}>
            🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' })}
          </div>
        )}
      </div>
      <div style={{ borderTop: `2px solid rgba(36,29,18,0.12)`, padding: '0.4rem 0.6rem' }}>
        <button onClick={() => onRsvp(a.id)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: a.iRsvped ? '#ffd23d' : 'transparent', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', font: 'inherit', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, fontWeight: 700 }}>
          {isEvent ? (a.iRsvped ? "✓ you're in" : '🎟️ i’m in') : (a.iRsvped ? '👍 liked' : '👍 like')}
          {a.rsvpCount ? <span style={{ ...miniCount, background: a.iRsvped ? INK : LINE }}>{a.rsvpCount}</span> : null}
        </button>
      </div>
    </div>
  );
}

type Me = { name: string; photo_url: string | null; archetype: string | null; bio: string; music: string[]; food: string[]; hobbies: string[]; galleryCount: number };
export default function FriendHubClient({ firstName, me }: { firstName: string; me?: Me; accessTier?: string; daysLeft?: number }) {
  const profileSet = !!(me && (me.photo_url || me.bio || (me.hobbies?.length || 0) > 0));
  const [payBusy, setPayBusy] = useState(false);
  async function buyMoreMatches() {
    setPayBusy(true);
    try {
      const r = await fetch('/api/friend/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      alert(d.error || 'Could not start checkout'); setPayBusy(false);
    } catch { setPayBusy(false); }
  }
  async function sendFeedback() {
    const fb = window.prompt('what would make the friend line better? (bugs, ideas, anything)');
    if (!fb || !fb.trim()) return;
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: fb }) });
    alert('got it — thank you! 🙏');
  }
  const [matches, setMatches] = useState<any[]>([]);
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
  const [newAct, setNewAct] = useState<{ title: string; category: string; happens_at: string; kind: 'post' | 'event'; area: string }>({ title: '', category: 'hang', happens_at: '', kind: 'post', area: '' });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<NavKey>('home');
  const [chatOpen, setChatOpen] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadMatches = useCallback(async () => {
    const r = await fetch('/api/friend/roster');
    if (r.ok) { const d = await r.json(); setMatches(d.matches || []); setGhosted(!!d.ghosted); setHardLocked(!!d.hardLocked); }
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

  useEffect(() => { loadMatches(); loadChat(); loadPulse(); }, [loadMatches, loadChat, loadPulse]);
  useEffect(() => { loadActs(); }, [loadActs]);
  // light polling for the group chat
  useEffect(() => { const t = setInterval(loadChat, 4000); return () => clearInterval(t); }, [loadChat]);

  const pendingToJoin = matches.some((m) => !m.iAccepted);
  const iAmIn = matches.some((m) => m.iAccepted);
  // The chat is free now — it's live once the crew (circle) exists. Until then
  // we still show the box with the prospective members so the section is visible.
  const chatLive = !!(chat.circleId && chat.chatLive);
  // Who's in the chat — a labeled roster (avatar + first name + in/invited dot).
  // Live circle → the actual members; pre-circle → me + prospective matches.
  type CrewMember = { id: string; name: string; photo_url: string | null; here: boolean; you: boolean };
  const crewRoster: CrewMember[] = chat.circleId
    ? (chat.members || []).map((u: any) => ({ id: u.id, name: u.name, photo_url: u.photo_url, here: true, you: !!u.isMe }))
    : [
        ...(me ? [{ id: 'me', name: me.name, photo_url: me.photo_url, here: iAmIn, you: true }] : []),
        ...matches.map((m) => ({ id: m.otherId, name: m.name, photo_url: m.photo_url, here: !!m.theyAccepted, you: false })),
      ];

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

  async function join() {
    setBusy(true);
    await fetch('/api/friend/accept', { method: 'POST' });
    await loadMatches(); await loadChat();
    setBusy(false);
    // Jump to the chat block so the user sees their accepted / waiting state.
    setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
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
    await fetch('/api/friend/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAct) });
    setNewAct({ title: '', category: 'hang', happens_at: '', kind: newAct.kind, area: newAct.area }); await loadActs(); await loadPulse(); setBusy(false);
  }
  async function rsvp(id: string) {
    const r = await fetch(`/api/friend/activities/${id}/rsvp`, { method: 'POST' });
    if (r.ok) { const d = await r.json(); setActs((a) => a.map((x) => x.id === id ? { ...x, iRsvped: d.joined, rsvpCount: d.count } : x)); }
  }
  async function deleteAct(id: string) {
    if (!confirm('Delete this post?')) return;
    const r = await fetch(`/api/friend/activities/${id}`, { method: 'DELETE' });
    if (r.ok) setActs((a) => a.filter((x) => x.id !== id));
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(170deg, ${CREAM} 0%, #f3e7cf 60%, #f7ddc0 100%)`, color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif', position: 'relative', overflow: 'hidden' }}>
      <TransitBackdrop />
      <style>{`
        /* old-school-FB shell: left rail + main column */
        .fbShell { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-top: 1.25rem; }
        @media (max-width: 879px) {
          /* stack: feed first, then people/zones rail; top-nav handles nav */
          .fbSide { order: 2; }
          .fbMain { order: 1; }
          .fbSideNav { display: none; }
        }
        @media (min-width: 880px) {
          .fbShell { grid-template-columns: 248px minmax(0,1fr); align-items: start; }
          .fbSide { position: sticky; top: 1rem; }
          .fbTopNav { display: none; }
        }
        /* on mobile the nav rides along the top as a horizontal toggle */
        .fbTopNav { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.3rem; margin-top: 1rem; scrollbar-width: none; }
        .fbTopNav::-webkit-scrollbar { display: none; }
        .fmGrid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 880px) {
          .fmGrid { grid-template-columns: minmax(0,1fr) 320px; align-items: start; }
          .fmRail { grid-column: 2; grid-row: 1; position: sticky; top: 1rem; }
          .fmMain { grid-column: 1; grid-row: 1; }
        }
        .fmMap { position: relative; min-height: min(72vh, 600px); margin: 1.25rem 0 0; }
        .fmMapLine { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
        .fmStop { position: absolute; transform: translateX(-50%); width: min(300px, 84vw); text-align: left; display: flex; flex-direction: column; background: #fffdf7; border: 3px solid ${INK}; border-radius: 18px; box-shadow: 6px 6px 0 ${INK}; padding: 1.4rem 1.3rem 1.2rem; cursor: pointer; color: ${INK}; font: inherit; min-height: 190px; z-index: 1; transition: transform .12s ease, box-shadow .12s ease; }
        .fmStop:hover { transform: translate(calc(-50% - 2px), -3px); box-shadow: 9px 9px 0 ${INK}; }
        .fmStopDot { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 20px; height: 20px; border-radius: 50%; background: ${CREAM}; border: 5px solid ${LINE}; box-shadow: 0 0 0 3px #fffdf7; }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <a href="/hub" style={{ background: LINE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6, border: `2px solid ${INK}`, textDecoration: 'none' }}>FRIEND LINE</a>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: LINE_DEEP }}>notcupid · greater boston</span>
          </div>
          <a href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>← transfer to hub</a>
        </div>

        {/* the route line under the header */}
        <div style={{ height: 6, background: LINE, borderRadius: 999, margin: '0 0 1.5rem', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '8%', top: -5, width: 16, height: 16, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}` }} />
          <span style={{ position: 'absolute', left: '50%', top: -5, width: 16, height: 16, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}` }} />
          <span style={{ position: 'absolute', left: '88%', top: -5, width: 16, height: 16, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}` }} />
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.6rem,9vw,4rem)', lineHeight: 0.88, color: LINE, WebkitTextStroke: `2px ${INK}`, textShadow: `4px 4px 0 rgba(36,29,18,0.18)`, margin: 0 }}>
          find your <span style={{ color: '#3f7d57', WebkitTextStroke: `2px ${INK}` }}>next friend.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: LINE_DEEP, margin: '0.5rem 0 0' }}>
          hey {firstName.toLowerCase()} — next stop, your people.
        </p>

        {/* mobile: the nav rides up top as a horizontal toggle */}
        <div className="fbTopNav">
          {NAV.map((n) => {
            const active = view === n.key;
            return (
              <button key={n.key} onClick={() => setView(n.key)}
                style={{ flexShrink: 0, position: 'relative', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.03em', padding: '0.4rem 0.85rem', borderRadius: 10, border: `3px solid ${INK}`, cursor: 'pointer', background: active ? LINE : '#fffdf7', color: active ? '#fff' : INK, boxShadow: active ? `3px 3px 0 ${INK}` : 'none' }}>
                {n.icon} {n.label}
                {n.key === 'crew' && crewBadge && <span style={{ position: 'absolute', top: -5, right: -5, width: 12, height: 12, borderRadius: '50%', background: '#da291c', border: `2px solid ${INK}` }} />}
              </button>
            );
          })}
        </div>

        <div className="fbShell">
          <aside className="fbSide">
            <FriendSidebar view={view} setView={setView} activeGroups={activeGroups} people={people} zones={pulse?.areas || []} crewBadge={crewBadge}
              onZone={(a) => { setAreaFilter(a); setView('scene'); }} />
          </aside>
          <main className="fbMain">

        {view === 'home' && (
          <HomeFeed firstName={firstName} activeGroups={activeGroups} popular={popular} hasCrew={matches.length > 0}
            onCrew={() => setView('crew')} onScene={() => setView('scene')} onRsvp={rsvp} onDelete={deleteAct} onOpen={setView} />
        )}

        {view === 'map' && (
          /* ───── THE MAP — three stops spread along the line, each its own page ───── */
          <div className="fmMap">
            <svg className="fmMapLine" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {/* a zig-zag route weaving through the three stops… */}
              <polyline points="-6,46 16,15 50,48 84,15 106,46" fill="none" stroke={LINE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
              {/* …plus a crossing interchange line so they inter-cross */}
              <line x1="12" y1="49" x2="88" y2="18" stroke={LINE} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.4} strokeDasharray="3 4" />
            </svg>
            {([
              { key: 'scene', icon: '🚇', name: 'the scene', tag: "what's the move around town", stat: `${acts.length || 0} on the board`, badge: false, pos: { left: '16%', top: '15%' } },
              { key: 'crew', icon: '🎒', name: 'my crew', tag: 'your people + the group chat', stat: matches.length ? `${matches.length} matched` : 'finding your people', badge: matches.some((m) => m.theyAccepted && !m.iAccepted), pos: { left: '50%', top: '48%' } },
              { key: 'pulse', icon: '🌆', name: 'city pulse', tag: 'which neighborhoods are buzzing', stat: pulse ? `${activeGroups} ${activeGroups === 1 ? 'crew' : 'crews'} live · ${pulse.totalMembers} on the line` : 'loading…', badge: activeGroups > 0, pos: { left: '84%', top: '15%' } },
            ] as const).map((s) => (
              <button key={s.key} className="fmStop" style={{ left: s.pos.left, top: s.pos.top }} onClick={() => setView(s.key)}>
                <span className="fmStopDot" />
                {s.badge && <span style={{ position: 'absolute', top: 14, right: 14, width: 15, height: 15, borderRadius: '50%', background: '#da291c', border: `2px solid ${INK}` }} />}
                <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.95rem', letterSpacing: '0.03em', marginTop: '0.45rem' }}>{s.name}</div>
                <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '0.9rem', margin: '0.25rem 0 0.9rem' }}>{s.tag}</div>
                <span style={{ ...chip, marginTop: 'auto', alignSelf: 'flex-start', background: '#ffd23d' }}>{s.stat} →</span>
              </button>
            ))}
          </div>
        )}

        {view === 'crew' && (
        <div>
          {pendingToJoin && (
            <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>say you&apos;re in to lock in your crew.</div>
              <button style={poppyBtn} onClick={join} disabled={busy}>{busy ? '…' : "I'M IN →"}</button>
            </div>
          )}

          {/* CREW — a deck you swipe through (frees the room below for the chat) */}
          <h2 style={sectionLabel}><StationDot />🎒 your crew</h2>
          {ghosted ? (
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: LINE_DEEP, marginBottom: '0.3rem' }}>⏸ your matching is paused</div>
              {hardLocked ? (
                <>
                  <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem', color: '#6b4a2f', lineHeight: 1.5, margin: '0 0 0.8rem' }}>
                    this has happened a few times now, so we&apos;ve paused your account on both lines. if you think that&apos;s a mistake, email us and we&apos;ll take a look.
                  </p>
                  <a href="mailto:match@notcupid.com" style={{ display: 'inline-block', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', background: INK, border: `2.5px solid ${INK}`, borderRadius: 10, padding: '0.55rem 1rem', boxShadow: `3px 3px 0 ${LINE_DEEP}`, textDecoration: 'none' }}>
                    email match@notcupid.com →
                  </a>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem', color: '#6b4a2f', lineHeight: 1.5, margin: '0 0 0.8rem' }}>
                    a few of your matches went quiet, so we paused you on both lines to keep things fair. no harm done — your crew &amp; profile stay put. pick back up whenever you&apos;re ready.
                  </p>
                  <ReactivateButton accent={LINE} />
                </>
              )}
            </div>
          ) : matches.length === 0 ? (
            <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>the algo is still finding your people — check back soon.</div>
          ) : (
            <>
            <div className="crewDeck">
              {matches.map((m) => (
                <div key={m.otherId} style={{ ...card, padding: 0, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', borderBottom: `3px solid ${INK}` }} />
                      : <div style={{ width: '100%', aspectRatio: '1', borderBottom: `3px solid ${INK}`, background: '#ffe6c7' }} />}
                    <span style={{ position: 'absolute', top: 8, left: 8, background: '#ffce4d', border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', transform: 'rotate(-6deg)', boxShadow: `2px 2px 0 ${INK}` }}>{m.score}%</span>
                  </div>
                  <div style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem' }}>{m.name} <span style={{ color: '#6b4a2f', fontSize: '0.85rem' }}>· {m.age}</span></div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: m.connected ? '#3f7d57' : LINE_DEEP, marginBottom: '0.4rem' }}>● {m.connected ? 'in your crew' : m.iAccepted ? 'waiting on them' : 'new match'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(m.sharedActivities || []).slice(0, 3).map((a: string) => <span key={a} style={chip}>{a}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8896a', marginTop: '-0.2rem' }}>← deck through your crew →</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={buyMoreMatches} disabled={payBusy} style={{ ...poppyBtn }}>
                {payBusy ? '…' : '🎟️ another round of matches · $0.99'}
              </button>
              <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '0.82rem' }}>your crews &amp; their chats are free — this just routes you a fresh batch of 5.</span>
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
                  ? <img src={me.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, border: `3px solid ${INK}` }} />
                  : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, border: `3px solid ${INK}`, background: '#fbe6cf' }} />}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', lineHeight: 1, marginTop: '0.5rem' }}>{me.name}</div>
                {me.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP }}>{me.archetype}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', margin: '0.5rem 0' }}>
                  {[...me.hobbies, ...me.music, ...me.food].slice(0, 5).map((t) => <span key={t} style={chip}>{t}</span>)}
                </div>
                <a href="/friends/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>edit card →</a>
              </div>
            ) : (
              <a href="/friends/profile" style={{ ...card, display: 'block', padding: '1.1rem', textDecoration: 'none', color: INK, textAlign: 'center' }}>
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
                      <div style={{ background: LINE, color: '#fff', padding: '0.6rem 0.85rem 0.7rem', borderBottom: `3px solid ${INK}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}>
                          💬 your crew · {crewRoster.length}
                          <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: chatLive ? '#3f7d57' : 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0.18rem 0.55rem' }}>
                            {chatLive ? '● live' : '○ forming'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginTop: '0.55rem', paddingBottom: '0.1rem' }} className="crewWho">
                          {crewRoster.map((u) => (
                            <span key={u.id} title={u.here ? `${u.name} · in the chat` : `${u.name} · invited`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, background: '#fffdf7', color: INK, border: `2px solid ${INK}`, borderRadius: 999, padding: '0.18rem 0.55rem 0.18rem 0.22rem' }}>
                              {u.photo_url
                                ? <img src={u.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${INK}` }} />
                                : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fbe6cf', border: `1.5px solid ${INK}`, display: 'inline-block' }} />}
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', whiteSpace: 'nowrap', fontWeight: u.you ? 700 : 400 }}>{u.you ? 'you' : (u.name?.split(' ')[0] || '—')}</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.here ? '#3f7d57' : '#c9a06a', flexShrink: 0 }} />
                            </span>
                          ))}
                        </div>
                      </div>
                      {chatLive ? (<>
                        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', minHeight: 240, maxHeight: 460, overflowY: 'auto' }}>
                          {chat.messages.length === 0 && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f', fontSize: '0.9rem' }}>say hi to the crew 👋</div>}
                          {chat.messages.map((mm: any) => {
                            const sender = chat.members.find((u: any) => u.id === mm.sender_id);
                            return (
                              <div key={mm.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                {sender?.photo_url ? <img src={sender.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7' }} />}
                                <div><span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.5rem', color: '#6b4a2f' }}>{sender?.name?.split(' ')[0] || '—'}</span>
                                  <div style={{ background: '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 12, padding: '0.45rem 0.75rem', fontSize: '0.9rem', maxWidth: 520 }}>{mm.body}</div></div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem 1.1rem', borderTop: `3px dashed rgba(36,29,18,0.25)` }}>
                          <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="say something to the crew…" style={{ flex: 1, border: `2px solid ${INK}`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.9rem' }} />
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
            <div style={{ ...card, padding: '1.1rem 1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>reading the city&apos;s pulse…</div>
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
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8896a', marginLeft: 'auto' }}>tap to explore</span>
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
                <div style={{ ...card, padding: '1rem 1.1rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>
                  nothing posted in {areaFilter} yet — <button onClick={() => { setNewAct({ ...newAct, area: areaFilter }); setView('scene'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, textDecoration: 'underline', font: 'inherit', fontStyle: 'italic' }}>start something →</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {shown.map((a) => (
                    <div key={a.id} style={{ ...card, padding: '0.8rem 1rem', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                      {a.authorPhoto ? <img src={a.authorPhoto} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{a.title}</div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span style={chip}>{a.category}</span>
                          {a.happens_at && <span style={chip}>🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}</span>}
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', color: '#6b4a2f', alignSelf: 'center' }}>by {a.authorName?.split(' ')[0] || '—'}</span>
                        </div>
                      </div>
                      <button onClick={() => rsvp(a.id)} style={{ ...chip, cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.7rem', background: a.iRsvped ? '#ffd23d' : '#fff', flexShrink: 0 }}>
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
              ? <img src={me.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7', flexShrink: 0 }} />}
            <input value={newAct.title} onChange={(e) => setNewAct({ ...newAct, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && !busy && newAct.title.trim() && createAct()}
              placeholder={newAct.kind === 'post' ? `what's on your mind, ${firstName.toLowerCase()}?` : "wanna plan a hang? what's the move?"}
              style={{ flex: 1, minWidth: 0, border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.6rem 1rem', fontSize: '0.95rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.7rem' }}>
            <div style={{ display: 'flex', border: `2.5px solid ${INK}`, borderRadius: 10, overflow: 'hidden' }}>
              {([['post', '💬 saying'], ['event', '📅 plan']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setNewAct({ ...newAct, kind: k })}
                  style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.05em', padding: '0.4rem 0.75rem', border: 'none', cursor: 'pointer', background: newAct.kind === k ? LINE : '#fffdf7', color: newAct.kind === k ? '#fff' : INK }}>{label}</button>
              ))}
            </div>
            <select value={newAct.category} onChange={(e) => setNewAct({ ...newAct, category: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }}>
              <option value="">📍 my area</option>
              {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {newAct.kind === 'event' && (
              <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }} />
            )}
            <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...poppyBtn, marginLeft: 'auto', fontSize: '1.05rem', padding: '0.45rem 1.1rem', opacity: busy || !newAct.title.trim() ? 0.5 : 1 }}>{newAct.kind === 'post' ? 'post →' : 'plan it →'}</button>
          </div>
        </div>

        <div ref={feedRef} />

        {/* filters: kind segmented control + active-area chip */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <div style={{ display: 'flex', border: `2.5px solid ${INK}`, borderRadius: 10, overflow: 'hidden' }}>
            {([['all', 'all'], ['event', '📅 plans'], ['post', '💬 talk']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setKindFilter(k)} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.05em', padding: '0.4rem 0.8rem', border: 'none', cursor: 'pointer', background: kindFilter === k ? LINE : '#fffdf7', color: kindFilter === k ? '#fff' : INK }}>{label}</button>
            ))}
          </div>
          {areaFilter && (
            <button onClick={() => setAreaFilter('')} style={{ ...chip, cursor: 'pointer', background: '#ffd23d', display: 'inline-flex', gap: '0.4rem' }}>
              📍 {areaFilter} <span style={{ fontWeight: 800, color: LINE_DEEP }}>×</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={() => setFilterCat('')} style={{ ...chip, cursor: 'pointer', background: filterCat === '' ? '#ffd23d' : '#fff' }}>all</button>
          {CATS.map((c) => <button key={c} onClick={() => setFilterCat(c)} style={{ ...chip, cursor: 'pointer', background: filterCat === c ? '#ffd23d' : '#fff' }}>{c}</button>)}
        </div>

        {(() => { const shown = acts.filter((a) => (kindFilter === 'all' || (a.kind || 'event') === kindFilter) && (!areaFilter || a.area === areaFilter)); return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {shown.length === 0 && <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>{kindFilter === 'event' ? 'no hangs planned yet — plan one above!' : 'nothing here yet — be the one to start something.'}</div>}
          {shown.map((a) => <ActivityPost key={a.id} a={a} onRsvp={rsvp} onDelete={deleteAct} />)}
        </div>
        ); })()}
        </div>
        )}
          </main>
        </div>

        <div style={{ maxWidth: 470, margin: '2.75rem auto 0', background: 'rgba(255,253,247,0.94)', border: `2px solid ${INK}`, borderRadius: 16, boxShadow: `4px 4px 0 ${INK}`, padding: '1rem 1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            <button onClick={sendFeedback} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, textDecoration: 'underline', textUnderlineOffset: 4 }}>💬 send feedback</button>
            <a href="/friends/how-it-works" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, textDecoration: 'underline', textUnderlineOffset: 4 }}>✨ what&apos;s new</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.85rem' }}>
            {[['instagram', 'https://instagram.com/notcupidapp'], ['tiktok', 'https://tiktok.com/@notcupid11'], ['x', 'https://x.com/notcupidapp']].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'lowercase', color: LINE_DEEP, textDecoration: 'none' }}>↗ {label}</a>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.85rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b4a2f' }}>
            © {new Date().getFullYear()} notcupid · a lemon labs property
          </div>
        </div>
      </div>
    </div>
  );
}
