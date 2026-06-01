'use client';

import { useEffect, useState, useCallback } from 'react';

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
function TransitBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <svg viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22 }}>
        <g fill="none" strokeWidth="13" strokeLinecap="round">
          <path d="M-40 180 L260 180 L420 340 L420 1100 L600 1280 L1100 1280" stroke={T_RED} />
          <path d="M-40 420 L380 420 L520 560 L1100 560" stroke={T_BLUE} />
          <path d="M120 -40 L120 520 L320 720 L320 1450" stroke={T_GREEN} />
          <path d="M1080 120 L720 120 L560 280 L560 1450" stroke={T_ORANGE} />
        </g>
        {[[260,180,T_RED],[420,340,T_RED],[380,420,T_BLUE],[520,560,T_BLUE],[120,520,T_GREEN],[320,720,T_GREEN],[720,120,T_ORANGE],[560,280,T_ORANGE]].map(([x,y,c],i)=>(
          <circle key={i} cx={x as number} cy={y as number} r="13" fill={CREAM} stroke={c as string} strokeWidth="6" opacity="0.55" />
        ))}
      </svg>
      {SPOTS.map(([name, left, top], i) => (
        <span key={name} style={{
          position: 'absolute', left, top,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: i % 3 === 0 ? '2rem' : '1.4rem',
          letterSpacing: '0.05em', color: i % 2 ? LINE_DEEP : '#3f7d57', opacity: 0.18,
          transform: `rotate(${i % 2 ? -5 : 4}deg)`, whiteSpace: 'nowrap',
        }}>◉ {name}</span>
      ))}
    </div>
  );
}

export default function FriendHubClient({ firstName }: { firstName: string; accessTier?: string; daysLeft?: number }) {
  const [payBusy, setPayBusy] = useState(false);
  async function unlockChat() {
    setPayBusy(true);
    try {
      const r = await fetch('/api/friend/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      alert(d.error || 'Could not start checkout'); setPayBusy(false);
    } catch { setPayBusy(false); }
  }
  async function sendFeedback() {
    const fb = window.prompt('what would make friend maxxin better? (bugs, ideas, anything)');
    if (!fb || !fb.trim()) return;
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: fb }) });
    alert('got it — thank you! 🙏');
  }
  const [matches, setMatches] = useState<any[]>([]);
  const [chat, setChat] = useState<any>({ circleId: null, members: [], messages: [] });
  const [pulse, setPulse] = useState<any>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<'all' | 'post' | 'event'>('all');
  const [msg, setMsg] = useState('');
  const [newAct, setNewAct] = useState<{ title: string; category: string; happens_at: string; kind: 'post' | 'event' }>({ title: '', category: 'hang', happens_at: '', kind: 'post' });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'community' | 'crew'>('community');

  const loadMatches = useCallback(async () => {
    const r = await fetch('/api/friend/roster'); if (r.ok) setMatches((await r.json()).matches || []);
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

  async function join() { setBusy(true); await fetch('/api/friend/accept', { method: 'POST' }); await loadMatches(); await loadChat(); setBusy(false); }
  async function optOut(otherId: string, name: string) {
    if (!confirm(`Opt out of your match with ${name}? This removes you both.`)) return;
    await fetch('/api/friend/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otherId }) });
    await loadMatches(); await loadChat();
  }
  async function send() {
    const body = msg.trim(); if (!body) return; setMsg('');
    await fetch('/api/friend/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    await loadChat();
  }
  async function createAct() {
    if (!newAct.title.trim()) return; setBusy(true);
    await fetch('/api/friend/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAct) });
    setNewAct({ title: '', category: 'hang', happens_at: '', kind: newAct.kind }); await loadActs(); await loadPulse(); setBusy(false);
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
      `}</style>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', position: 'relative', zIndex: 1 }}>
        {/* Transit header bar — the Friend Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: LINE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6, border: `2px solid ${INK}` }}>FRIEND LINE</span>
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

        {/* SEGMENT SWITCHER — two stops on the line */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0 0.5rem' }}>
          {([['community', '🚇 the scene'], ['crew', '🎒 my crew']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.04em', padding: '0.6rem', borderRadius: 12, border: `3px solid ${INK}`, cursor: 'pointer',
                background: tab === t ? LINE : '#fffdf7', color: tab === t ? '#fff' : INK,
                boxShadow: tab === t ? `4px 4px 0 ${INK}` : 'none',
                position: 'relative' }}>
              {label}
              {t === 'crew' && matches.some((m) => m.theyAccepted && !m.iAccepted) && (
                <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: '#da291c', border: `2px solid ${INK}` }} />
              )}
            </button>
          ))}
        </div>

        {tab === 'crew' && (<>
        {/* Make your profile worth matching with */}
        <a href="/profile" style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.9rem 1.1rem', margin: '1.25rem 0', textDecoration: 'none', color: INK, background: '#fffdf7' }}>
          <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>📸 add your photos &amp; interests so crews know it&apos;s you.</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: LINE_DEEP }}>set up profile →</span>
        </a>

        {pendingToJoin && (
          <div style={{ ...card, padding: '1rem 1.25rem', margin: '1.25rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>say you&apos;re in to lock in your crew.</div>
            <button style={poppyBtn} onClick={join} disabled={busy}>{busy ? '…' : "I'M IN →"}</button>
          </div>
        )}

        {/* CREW */}
        <h2 style={sectionLabel}><StationDot />🎒 your crew</h2>
        {matches.length === 0 ? (
          <div style={{ ...card, padding: '1.25rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>the algo is still finding your people — check back soon.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem' }}>
            {matches.map((m) => (
              <div key={m.otherId} style={{ ...card, padding: '0.9rem', position: 'relative' }}>
                <button onClick={() => optOut(m.otherId, m.name)} aria-label="opt out"
                  style={{ position: 'absolute', top: -12, right: -12, width: 28, height: 28, borderRadius: '50%', background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}`, cursor: 'pointer', fontWeight: 800 }}>✕</button>
                {m.photo_url
                  ? <img src={m.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 14, border: `3px solid ${INK}` }} />
                  : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 14, border: `3px solid ${INK}`, background: '#ffe6c7' }} />}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', marginTop: '0.5rem' }}>{m.name} <span style={{ color: '#6b4a2f', fontSize: '0.9rem' }}>· {m.age}</span></div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.4rem' }}>{m.score}% match{m.connected ? ' · in your crew' : m.iAccepted ? ' · waiting on them' : ''}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {(m.sharedActivities || []).slice(0, 3).map((a: string) => <span key={a} style={chip}>{a}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GROUP CHAT — locked: either I need to unlock ($0.99) or we're waiting on crewmates */}
        {chat.circleId && chat.locked && (
          <>
            <h2 style={sectionLabel}><StationDot />💬 the group chat</h2>
            <div style={{ ...card, padding: '1.75rem', textAlign: 'center' }}>
              {!chat.iHaveAccess ? (
                <>
                  <div style={{ fontSize: '2rem' }}>🎟️</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', margin: '0.4rem 0' }}>unlock this crew&apos;s chat</div>
                  <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, margin: '0 0 1.25rem' }}>your first crew is free — this is an extra one. one-time <b>$0.99</b> and you&apos;re in this {chat.members.length}-person chat for good.</p>
                  <button style={{ ...poppyBtn }} onClick={unlockChat} disabled={payBusy}>{payBusy ? '…' : 'unlock this chat · $0.99'}</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2rem' }}>🚥</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', margin: '0.4rem 0' }}>almost there</div>
                  <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP, margin: 0 }}>you&apos;re in — waiting on <b>{chat.waitingOn}</b> crewmate{chat.waitingOn === 1 ? '' : 's'} to unlock before the chat goes live for everyone.</p>
                </>
              )}
            </div>
          </>
        )}
        {chat.circleId && !chat.locked && (
          <>
            <h2 style={sectionLabel}><StationDot />💬 the group chat</h2>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ background: LINE, color: '#fff', padding: '0.8rem 1.1rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', borderBottom: `3px solid ${INK}` }}>your crew · {chat.members.length} people</div>
              <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: 360, overflowY: 'auto' }}>
                {chat.messages.length === 0 && <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>say hi to the crew 👋</div>}
                {chat.messages.map((mm: any) => {
                  const sender = chat.members.find((u: any) => u.id === mm.sender_id);
                  return (
                    <div key={mm.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      {sender?.photo_url ? <img src={sender.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7' }} />}
                      <div><span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.5rem', color: '#6b4a2f' }}>{sender?.name?.split(' ')[0] || '—'}</span>
                        <div style={{ background: '#ffe6c7', border: `2px solid ${INK}`, borderRadius: 12, padding: '0.4rem 0.7rem', fontSize: '0.88rem', maxWidth: 460 }}>{mm.body}</div></div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem 1.1rem', borderTop: `3px dashed rgba(26,20,16,0.25)` }}>
                <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="say something to the crew…" style={{ flex: 1, border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.5rem 1rem', fontSize: '0.88rem' }} />
                <button onClick={send} style={{ ...poppyBtn, fontSize: '1.1rem', padding: '0 1rem' }}>→</button>
              </div>
            </div>
          </>
        )}

        </>)}

        {tab === 'community' && (
        <div className="fmGrid">

        {/* SIDE RAIL — city pulse map */}
        <div className="fmRail">
          <h2 style={sectionLabel}><StationDot />🌆 city pulse</h2>
          <div style={{ ...card, padding: '1.1rem 1.25rem' }}>
            {!pulse ? <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>loading…</span> : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                  <span style={chip}>👥 {pulse.totalMembers}</span>
                  <span style={chip}>🫂 {pulse.activeGroups}</span>
                  <button onClick={() => setKindFilter('event')} style={{ ...chip, cursor: 'pointer' }}>📣 {pulse.liveActivities}</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {pulse.areas.slice(0, 10).map((a: any) => {
                    const max = pulse.areas[0]?.members || 1;
                    return (
                      <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 96, fontFamily: "'DM Mono',monospace", fontSize: '0.56rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.area}</span>
                        <div style={{ flex: 1, background: '#ffe6c7', borderRadius: 6, height: 14, border: `1.5px solid ${INK}` }}>
                          <div style={{ width: `${Math.round((a.members / max) * 100)}%`, height: '100%', background: LINE, borderRadius: 6, minWidth: 3 }} />
                        </div>
                        <span style={{ width: 18, textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: '0.56rem', color: '#6b4a2f' }}>{a.members}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MAIN — the feed */}
        <div className="fmMain">
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
            {newAct.kind === 'event' && (
              <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }} />
            )}
            <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...poppyBtn, marginLeft: 'auto' }}>{newAct.kind === 'post' ? 'post →' : 'plan it →'}</button>
          </div>
        </div>

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

        {(() => { const shown = acts.filter((a) => kindFilter === 'all' || (a.kind || 'event') === kindFilter); return (
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
        </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '2.5rem' }}>
          <button onClick={sendFeedback} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'underline', textUnderlineOffset: 4 }}>💬 send feedback</button>
          <a href="/friends/how-it-works" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'underline', textUnderlineOffset: 4 }}>✨ what&apos;s new</a>
        </div>
      </div>
    </div>
  );
}
