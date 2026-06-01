'use client';

import { useEffect, useState, useCallback } from 'react';

const INK = '#1a1410';
const CATS = ['food', 'drinks', 'active', 'outdoors', 'culture', 'nightlife', 'games', 'chill', 'hang'];

const card: React.CSSProperties = { background: '#fff', border: `3px solid ${INK}`, borderRadius: 20, boxShadow: '5px 5px 0 rgba(26,20,16,0.85)' };
const chip: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', background: '#ffe6c7', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.2rem 0.55rem' };
const sectionLabel: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.04em', margin: '2rem 0 0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'center' };
const poppyBtn: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', color: '#fff', background: 'linear-gradient(135deg,#ff7a1f,#ff3d77)', border: `3px solid ${INK}`, borderRadius: 14, padding: '0.55rem 1.4rem', boxShadow: `4px 4px 0 ${INK}`, cursor: 'pointer' };

export default function FriendHubClient({ firstName, accessTier, daysLeft }: { firstName: string; accessTier: 'full' | 'trial' | 'expired'; daysLeft: number }) {
  const isFounding = accessTier === 'full';
  const isExpired = accessTier === 'expired';
  const [foundingBusy, setFoundingBusy] = useState(false);
  async function goFounding() {
    setFoundingBusy(true);
    try {
      const r = await fetch('/api/friend/checkout', { method: 'POST' });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      alert(d.error || 'Could not start checkout'); setFoundingBusy(false);
    } catch { setFoundingBusy(false); }
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
  const [msg, setMsg] = useState('');
  const [newAct, setNewAct] = useState<{ title: string; category: string; happens_at: string }>({ title: '', category: 'hang', happens_at: '' });
  const [busy, setBusy] = useState(false);

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
    setNewAct({ title: '', category: 'hang', happens_at: '' }); await loadActs(); await loadPulse(); setBusy(false);
  }
  async function rsvp(id: string) {
    const r = await fetch(`/api/friend/activities/${id}/rsvp`, { method: 'POST' });
    if (r.ok) { const d = await r.json(); setActs((a) => a.map((x) => x.id === id ? { ...x, iRsvped: d.joined, rsvpCount: d.count } : x)); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 12% 18%,rgba(255,180,90,0.3),transparent 30%),radial-gradient(circle at 88% 8%,rgba(255,120,160,0.25),transparent 28%),linear-gradient(160deg,#fff3df,#ffe6c7 55%,#ffd9e0)', color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.12em', color: '#d2530f' }}>FRIEND<span style={{ color: INK }}>MAXXIN</span></div>
          <a href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'none' }}>← hub</a>
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,8vw,3.5rem)', lineHeight: 0.9, color: '#ff7a1f', WebkitTextStroke: `2px ${INK}`, textShadow: `4px 4px 0 rgba(26,20,16,0.18)`, margin: 0 }}>
          hey {firstName.toLowerCase()}, <span style={{ color: '#ff3d77', WebkitTextStroke: `2px ${INK}` }}>your crew awaits.</span>
        </h1>

        {!isFounding && (
          <div style={{ ...card, padding: '1rem 1.25rem', margin: '1.25rem 0', background: isExpired ? '#fff0f2' : '#fffaf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', flex: 1, minWidth: 220 }}>
              {isExpired
                ? 'your 7-day free look is up — go founding to get back to your crew + the chat.'
                : <><b>{daysLeft} day{daysLeft === 1 ? '' : 's'}</b> of free access left. founding members unlock the group chat (and keep everything) — one time, $2.99.</>}
            </div>
            <button style={poppyBtn} onClick={goFounding} disabled={foundingBusy}>{foundingBusy ? '…' : '✦ go founding · $2.99'}</button>
          </div>
        )}

        {pendingToJoin && (
          <div style={{ ...card, padding: '1rem 1.25rem', margin: '1.25rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>say you&apos;re in to lock in your crew{isFounding ? ' + open the group chat' : ''}.</div>
            <button style={poppyBtn} onClick={join} disabled={busy}>{busy ? '…' : "I'M IN →"}</button>
          </div>
        )}

        {/* CREW */}
        <h2 style={sectionLabel}>🎒 your crew</h2>
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

        {/* GROUP CHAT (founding-only) */}
        {chat.circleId && !isFounding && (
          <>
            <h2 style={sectionLabel}>💬 the group chat</h2>
            <div style={{ ...card, padding: '1.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>🔒</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', margin: '0.4rem 0' }}>the chat is founding-only</div>
              <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f', margin: '0 0 1rem' }}>your crew&apos;s here — unlock the group chat to actually talk. one-time $2.99, founding member forever.</p>
              <button style={poppyBtn} onClick={goFounding} disabled={foundingBusy}>{foundingBusy ? '…' : '✦ unlock the chat · $2.99'}</button>
            </div>
          </>
        )}
        {chat.circleId && isFounding && (
          <>
            <h2 style={sectionLabel}>💬 the group chat</h2>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#ff7a1f,#ff3d77)', color: '#fff', padding: '0.8rem 1.1rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.05em', borderBottom: `3px solid ${INK}` }}>your crew · {chat.members.length} people</div>
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

        {/* CITY PULSE */}
        <h2 style={sectionLabel}>🌆 city pulse</h2>
        <div style={{ ...card, padding: '1.1rem 1.25rem' }}>
          {!pulse ? <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>loading…</span> : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <span style={chip}>👥 {pulse.totalMembers} in the network</span>
                <span style={chip}>🫂 {pulse.activeGroups} active groups</span>
                <span style={chip}>📣 {pulse.liveActivities} things to do</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pulse.areas.slice(0, 10).map((a: any) => {
                  const max = pulse.areas[0]?.members || 1;
                  return (
                    <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ width: 150, fontFamily: "'DM Mono',monospace", fontSize: '0.62rem' }}>{a.area}</span>
                      <div style={{ flex: 1, background: '#ffe6c7', borderRadius: 6, height: 16, border: `1.5px solid ${INK}` }}>
                        <div style={{ width: `${Math.round((a.members / max) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#ff7a1f,#ff3d77)', borderRadius: 6, minWidth: 3 }} />
                      </div>
                      <span style={{ width: 70, textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: '#6b4a2f' }}>{a.members} ppl</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ACTIVITY BOARD */}
        <h2 style={sectionLabel}>📣 what&apos;s the move?</h2>
        <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <input value={newAct.title} onChange={(e) => setNewAct({ ...newAct, title: e.target.value })}
            placeholder="wanna…? (e.g. catch the new A24 movie fri night)"
            style={{ width: '100%', border: `2.5px solid ${INK}`, borderRadius: 12, padding: '0.6rem 0.8rem', fontSize: '0.95rem', marginBottom: '0.6rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={newAct.category} onChange={(e) => setNewAct({ ...newAct, category: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="datetime-local" value={newAct.happens_at} onChange={(e) => setNewAct({ ...newAct, happens_at: e.target.value })} style={{ border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: "'DM Mono',monospace", fontSize: '0.65rem' }} />
            <button onClick={createAct} disabled={busy || !newAct.title.trim()} style={{ ...poppyBtn, marginLeft: 'auto' }}>post it →</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <button onClick={() => setFilterCat('')} style={{ ...chip, cursor: 'pointer', background: filterCat === '' ? '#ffd23d' : '#fff' }}>all</button>
          {CATS.map((c) => <button key={c} onClick={() => setFilterCat(c)} style={{ ...chip, cursor: 'pointer', background: filterCat === c ? '#ffd23d' : '#fff' }}>{c}</button>)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {acts.length === 0 && <div style={{ ...card, padding: '1rem', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: '#6b4a2f' }}>nothing posted yet — be the one to start something.</div>}
          {acts.map((a) => (
            <div key={a.id} style={{ ...card, padding: '0.9rem 1.1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
              {a.authorPhoto ? <img src={a.authorPhoto} alt="" style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffe6c7', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{a.title}</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.35rem 0' }}>
                  <span style={chip}>{a.category}</span>
                  {a.area && <span style={chip}>📍 {a.area}</span>}
                  {a.happens_at && <span style={chip}>🕒 {new Date(a.happens_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}</span>}
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', color: '#6b4a2f', alignSelf: 'center' }}>by {a.authorName?.split(' ')[0] || '—'}</span>
                </div>
              </div>
              <button onClick={() => rsvp(a.id)} style={{ ...poppyBtn, fontSize: '0.95rem', padding: '0.4rem 0.9rem', background: a.iRsvped ? '#ffd23d' : 'linear-gradient(135deg,#ff7a1f,#ff3d77)', color: a.iRsvped ? INK : '#fff' }}>
                {a.iRsvped ? `in · ${a.rsvpCount}` : `i'm in${a.rsvpCount ? ` · ${a.rsvpCount}` : ''}`}
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '2.5rem' }}>
          <button onClick={sendFeedback} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'underline', textUnderlineOffset: 4 }}>💬 send feedback</button>
          <a href="/friends/how-it-works" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'underline', textUnderlineOffset: 4 }}>✨ what&apos;s new</a>
        </div>
      </div>
    </div>
  );
}
