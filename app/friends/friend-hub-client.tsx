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
// City Pulse — clean speech-bubble chips that wrap neatly. Each shows a
// neighborhood with a chat tail + a count badge; busier hoods read bolder.
function PulseBubbles({ areas, line, ink, onPick, active }: { areas: any[]; line: string; ink: string; onPick: (area: string) => void; active: string }) {
  const max = areas[0]?.members || 1;
  const sorted = [...areas].sort((a, b) => b.members - a.members).slice(0, 14);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem 0.5rem', paddingBottom: '0.6rem' }}>
      {sorted.map((a: any) => {
        const hot = a.members / max >= 0.66;
        const sel = active === a.area;
        const bg = sel ? '#ffd23d' : hot ? line : '#fffdf7';
        const fg = sel ? ink : hot ? '#fff' : ink;
        return (
          <button key={a.area} onClick={() => onPick(a.area)} title={`see what's happening in ${a.area}`}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: bg, color: fg, border: `2px solid ${ink}`, borderRadius: 14, padding: '0.3rem 0.55rem 0.3rem 0.65rem', boxShadow: `2px 2px 0 ${ink}`, cursor: 'pointer', font: 'inherit' }}>
            <span style={{ position: 'absolute', left: 10, bottom: -6, width: 9, height: 9, background: bg, borderRight: `2px solid ${ink}`, borderBottom: `2px solid ${ink}`, transform: 'rotate(45deg)' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{a.area}</span>
            <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: sel || !hot ? line : '#fffdf7', color: sel || !hot ? '#fff' : ink, border: `1.5px solid ${ink}`, fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{a.members}</span>
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
  const [view, setView] = useState<'map' | 'scene' | 'crew' | 'pulse'>('map');
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
  // The chat is free now — it's live once the crew (circle) exists. Until then
  // we still show the box with the prospective members so the section is visible.
  const chatLive = !!(chat.circleId && chat.chatLive);
  const crewPeople: any[] = chat.circleId
    ? chat.members
    : [
        ...(me ? [{ id: 'me', name: me.name, photo_url: me.photo_url }] : []),
        ...matches.map((m) => ({ id: m.otherId, name: m.name, photo_url: m.photo_url })),
      ];

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

        {view === 'map' ? (
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
              { key: 'pulse', icon: '🌆', name: 'city pulse', tag: 'which neighborhoods are buzzing', stat: pulse ? `${pulse.totalMembers} on the line` : 'loading…', badge: false, pos: { left: '84%', top: '15%' } },
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
        ) : (
          <>
          {/* sub-nav — hop between stops, or back to the map */}
          <div style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0 0.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <button onClick={() => setView('map')} title="back to the map"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: LINE_DEEP, background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 12, padding: '0 0.85rem', cursor: 'pointer' }}>◉ map</button>
            {([['scene', '🚇 scene'], ['crew', '🎒 crew'], ['pulse', '🌆 pulse']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setView(t)}
                style={{ flex: '1 1 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '0.04em', padding: '0.5rem', borderRadius: 12, border: `3px solid ${INK}`, cursor: 'pointer', position: 'relative',
                  background: view === t ? LINE : '#fffdf7', color: view === t ? '#fff' : INK, boxShadow: view === t ? `4px 4px 0 ${INK}` : 'none' }}>
                {label}
                {t === 'crew' && matches.some((m) => m.theyAccepted && !m.iAccepted) && (
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: '#da291c', border: `2px solid ${INK}` }} />
                )}
              </button>
            ))}
          </div>

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
                    <span style={{ fontSize: '0.8rem' }}>{chatOpen ? '▲ hide' : `▾ ${crewPeople.length}`}</span>
                  </button>
                  <div ref={chatRef} />
                  {chatOpen && (
                    <div style={{ ...card, overflow: 'hidden', marginTop: '0.6rem', padding: 0 }}>
                      <div style={{ background: LINE, color: '#fff', padding: '0.6rem 1rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', borderBottom: `3px solid ${INK}`, display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                        your crew · {crewPeople.length}
                        <span style={{ display: 'flex', marginLeft: 'auto' }}>
                          {crewPeople.slice(0, 6).map((u: any) => u.photo_url
                            ? <img key={u.id} src={u.photo_url} alt="" title={u.name} style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid #fff`, marginLeft: -6, objectFit: 'cover' }} />
                            : <span key={u.id} title={u.name} style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid #fff`, marginLeft: -6, background: '#fbe6cf', display: 'inline-block' }} />)}
                        </span>
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
          <div style={{ ...card, padding: '1.1rem 1.25rem' }}>
            {!pulse ? <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>loading…</span> : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                  <span style={chip}>👥 {pulse.totalMembers}</span>
                  <span style={chip}>🫂 {pulse.activeGroups}</span>
                  <button onClick={() => { setKindFilter('event'); setView('scene'); }} style={{ ...chip, cursor: 'pointer' }}>📣 {pulse.liveActivities}</button>
                </div>
                <PulseBubbles areas={pulse.areas} line={LINE} ink={INK} onPick={(a) => setAreaFilter(areaFilter === a ? '' : a)} active={areaFilter} />
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8896a', textAlign: 'center', marginTop: '0.4rem' }}>tap a bubble to see what&apos;s happening there</p>
              </>
            )}
          </div>

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
        <h2 style={sectionLabel}><StationDot />📣 what&apos;s the move?</h2>
        <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.7rem' }}>
            {([['post', '💬 just saying'], ['event', '📅 plan a thing']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setNewAct({ ...newAct, kind: k })}
                style={{ ...chip, cursor: 'pointer', fontSize: '0.62rem', padding: '0.3rem 0.7rem', background: newAct.kind === k ? '#ffd23d' : '#fff' }}>{label}</button>
            ))}
          </div>
          <input value={newAct.title} onChange={(e) => setNewAct({ ...newAct, title: e.target.value })}
            placeholder={newAct.kind === 'post' ? "what's on your mind? (e.g. anyone know a good thai spot in camberville?)" : "wanna…? (e.g. catch the new A24 movie fri night)"}
            style={{ width: '100%', border: `2.5px solid ${INK}`, borderRadius: 12, padding: '0.6rem 0.8rem', fontSize: '0.95rem', marginBottom: '0.6rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={newAct.category} onChange={(e) => setNewAct({ ...newAct, category: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }}>
              <option value="">📍 my area</option>
              {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {newAct.kind === 'event' && (
              <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }} />
            )}
            <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...poppyBtn, marginLeft: 'auto' }}>{newAct.kind === 'post' ? 'post →' : 'plan it →'}</button>
          </div>
        </div>

        <div ref={feedRef} />
        {/* active area filter (from a city-pulse bubble) */}
        {areaFilter && (
          <button onClick={() => setAreaFilter('')} style={{ ...chip, cursor: 'pointer', background: '#ffd23d', marginBottom: '0.6rem', display: 'inline-flex', gap: '0.4rem' }}>
            📍 showing: {areaFilter} <span style={{ fontWeight: 800, color: LINE_DEEP }}>×</span>
          </button>
        )}

        {/* post / event filter */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {([['all', 'everything'], ['event', '📅 things to do'], ['post', '💬 just talk']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKindFilter(k)} style={{ ...chip, cursor: 'pointer', fontSize: '0.62rem', padding: '0.3rem 0.7rem', background: kindFilter === k ? '#ffd23d' : '#fff' }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <button onClick={() => setFilterCat('')} style={{ ...chip, cursor: 'pointer', background: filterCat === '' ? '#ffd23d' : '#fff' }}>all</button>
          {CATS.map((c) => <button key={c} onClick={() => setFilterCat(c)} style={{ ...chip, cursor: 'pointer', background: filterCat === c ? '#ffd23d' : '#fff' }}>{c}</button>)}
        </div>

        {(() => { const shown = acts.filter((a) => (kindFilter === 'all' || (a.kind || 'event') === kindFilter) && (!areaFilter || a.area === areaFilter)); return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {shown.length === 0 && <div style={{ ...card, padding: '1rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>{kindFilter === 'event' ? 'no hangs planned yet — post one!' : 'nothing here yet — be the one to start something.'}</div>}
          {shown.map((a) => (
            <div key={a.id} style={{ ...card, padding: '0.9rem 1.1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
              {a.authorPhoto ? <img src={a.authorPhoto} alt="" style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{a.title}</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.35rem 0' }}>
                  <span style={chip}>{a.category}</span>
                  {a.area && <span style={chip}>📍 {a.area}</span>}
                  {a.happens_at && <span style={chip}>🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}</span>}
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', color: '#6b4a2f', alignSelf: 'center' }}>by {a.authorName?.split(' ')[0] || '—'}</span>
                  {a.isMine && (
                    <button onClick={() => deleteAct(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c0392b', alignSelf: 'center' }}>delete</button>
                  )}
                </div>
              </div>
              {a.kind === 'post' ? (
                <button onClick={() => rsvp(a.id)} style={{ ...chip, cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.7rem', background: a.iRsvped ? '#ffd23d' : '#fff', alignSelf: 'center' }}>
                  👍 {a.rsvpCount || ''}
                </button>
              ) : (
                <button onClick={() => rsvp(a.id)} style={{ ...poppyBtn, fontSize: '0.95rem', padding: '0.4rem 0.9rem', background: a.iRsvped ? '#ffd23d' : 'linear-gradient(135deg,#ff7a1f,#ff3d77)', color: a.iRsvped ? INK : '#fff' }}>
                  {a.iRsvped ? `in · ${a.rsvpCount}` : `i'm in${a.rsvpCount ? ` · ${a.rsvpCount}` : ''}`}
                </button>
              )}
            </div>
          ))}
        </div>
        ); })()}
        </div>
        )}
        </>
        )}

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
