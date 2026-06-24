'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { subscribeToPush } from '@/lib/push-client';

type Event = { series: string; city: string; dateLabel: string; budget: number; tagline: string; drawLabel: string };
type Profile = { photo: boolean; quiz: boolean; bio: boolean; gender: string; seeking: string; age: number | null; ageMin: number; ageMax: number; interests: number; archetype: string | null };

const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';
const BLUE = '#2563ff';
const GREEN = '#2d7a4f';
const GENDERS = [['m', 'a man'], ['f', 'a woman'], ['nb', 'non-binary']];
const SEEKING = [['f', 'women'], ['m', 'men'], ['both', 'anyone']];

// The /raffle page IS the raffle — every state lives here (register → entered →
// drawn/accept-or-reject → it's-a-date). The hub just links in.
export default function RaffleClient({ firstName, eligible, profile, event }: {
  firstName: string; eligible: boolean; profile: Profile; event: Event;
}) {
  const [gender, setGender] = useState(profile.gender);
  const [seeking, setSeeking] = useState(profile.seeking);
  const [ageMin, setAgeMin] = useState(profile.ageMin);
  const [ageMax, setAgeMax] = useState(profile.ageMax);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notify, setNotify] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // live raffle state (entered / drawn / accepted / it's-a-date)
  const [st, setSt] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    fetch('/api/raffle/status').then((r) => (r.ok ? r.json() : null)).then((d) => { setSt(d); setLoaded(true); }).catch(() => setLoaded(true));
    if (typeof Notification !== 'undefined') setPushOn(Notification.permission === 'granted');
  }, []);

  const ev = { ...event, ...(st?.event || {}) } as any;
  const other = st?.other?.name ? st.other.name.split(' ')[0] : 'your match';

  // "Established cred" from the real profile — entry isn't one click.
  const cred = [
    { ok: profile.photo, label: 'a profile photo', fix: '/profile' },
    { ok: profile.quiz, label: 'the personality quiz', fix: '/quiz?retake=1' },
    { ok: profile.bio, label: 'a bio (a few words about you)', fix: '/profile' },
    { ok: profile.interests >= 3, label: '3+ interests (music, food, hobbies, sports)', fix: '/profile' },
    { ok: profile.age != null && profile.age >= 21, label: profile.age != null && profile.age < 21 ? 'be 21+ — this dinner is 21 and over' : 'your age (21+ for this dinner)', fix: profile.age == null ? '/profile' : undefined },
  ];
  const credOk = cred.every((c) => c.ok);
  const basicsOk = !!gender && !!seeking && ageMin >= 18 && ageMax >= ageMin;
  const canEnter = credOk && basicsOk && !!videoUrl && agreed;

  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) { setErr('that video is over 80MB — keep it short (15–30s).'); return; }
    setUploading(true); setErr('');
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const r = await fetch('/api/raffle/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'upload not available — try again shortly.'); return; }
      const put = await fetch(d.signedUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'video/mp4' } });
      if (!put.ok) { setErr('upload failed — try again.'); return; }
      setVideoUrl(d.publicUrl);
    } catch { setErr('upload failed — try again.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function enter() {
    if (!canEnter) { setErr('finish your cred + match basics first.'); return; }
    setBusy(true); setErr('');
    try {
      if (notify) await subscribeToPush().catch(() => {});
      const r = await fetch('/api/raffle/enter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, notify, gender, seeking, ageMin, ageMax, agreed }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'could not enter'); return; }
      setDone(true);
    } catch { setErr('could not enter — try again'); }
    finally { setBusy(false); }
  }

  async function respond(accept: boolean) {
    setBusy(true); setErr('');
    const r = await fetch('/api/raffle/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) });
    if (r.ok) window.location.reload(); else { setBusy(false); setErr('try again'); }
  }
  async function enablePush() { const ok = await subscribeToPush(); setPushOn(ok); if (!ok) setErr('couldn’t enable — on iPhone, install the app first'); }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <Link href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← hub</Link>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: ORANGE_DEEP, margin: '1.5rem 0 0.6rem', fontWeight: 700 }}>🎟️ {ev.series} · {ev.city}</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.2rem,8vw,3.2rem)', lineHeight: 1.02, margin: '0 0 0.6rem' }}>{ev.tagline}</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 1.75rem' }}>
          a fully-covered dinner — up to <b>${ev.budget}*</b> — drawn from everyone who enters. <b>{ev.dateLabel}</b>.
        </p>

        {!eligible ? (
          <div style={card}>
            <h2 style={cardH}>this one’s for Bostonians.</h2>
            <p style={cardP}>you need to live in {ev.city} or a next-door neighborhood (Cambridge, Somerville, Brookline, and the rest of the inner city) to enter — so you can actually make the dinner. set your city on the <Link href="/dashboard" style={{ color: ORANGE_DEEP }}>Love line</Link> if that’s you — more cities coming.</p>
          </div>
        ) : !loaded ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--h-text-faint)', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.1em' }}>loading your entry…</div>
        ) : st?.draw?.bothAccepted ? (
          // ── it's a date ──
          <div style={{ ...card, border: `2px solid ${GREEN}`, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>✦</div>
            <h2 style={cardH}>it’s a date with {other}.</h2>
            <p style={cardP}>your <b>${ev.budget} dinner</b> is locked in · <b>{ev.dateLabel}</b>. {st.draw.restaurant}</p>
            <p style={{ fontSize: '0.76rem', color: 'var(--h-text-faint)', lineHeight: 1.5, margin: '0.85rem 0 0' }}>
              💛 a little cushion: meet in public, tell a friend where you’ll be, and arrange your own ride home. trust your gut.
            </p>
            <Link href="/hub" style={backLink}>back to hub →</Link>
          </div>
        ) : (st?.draw && st.draw.status === 'pending' && !st.draw.myAccepted) ? (
          // ── you've been drawn → accept / reject ──
          <div style={{ ...card, border: `2px solid ${BLUE}`, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <h2 style={cardH}>you’ve been picked — meet {other}.</h2>
            <p style={cardP}>you two scored <b>{st.draw.score}%</b>. accept to lock in your <b>${ev.budget} date</b> on <b>{ev.dateLabel}</b>.{st.draw.theyAccepted ? ` ${other} already said yes 👀` : ''}</p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button onClick={() => respond(true)} disabled={busy} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 999, padding: '0.7rem 1.9rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '0.04em', cursor: busy ? 'wait' : 'pointer' }}>{busy ? '…' : 'accept →'}</button>
              <button onClick={() => respond(false)} disabled={busy} style={{ background: 'none', color: 'var(--h-text-dim)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.7rem 1.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>reject</button>
            </div>
          </div>
        ) : (st?.draw?.myAccepted && !st.draw.bothAccepted) ? (
          // ── you accepted, waiting on them ──
          <div style={{ ...card, border: `2px solid ${BLUE}`, textAlign: 'center' }}>
            <h2 style={cardH}>you’re in — waiting on {other}.</h2>
            <p style={cardP}>you said yes to your <b>${ev.budget} date</b>. as soon as {other} accepts, it’s locked for {ev.dateLabel}.</p>
            <Link href="/hub" style={backLink}>back to hub →</Link>
          </div>
        ) : (done || st?.entered) ? (
          // ── entered, not yet drawn ──
          <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${ORANGE}`, borderRadius: 18, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.6rem', margin: '0.3rem 0' }}>you’re in{done ? `, ${firstName.toLowerCase()}` : ''}.</h2>
            <p style={{ color: 'var(--h-text-dim)', fontSize: '0.92rem', margin: '0 0 1rem' }}>we draw <b>{ev.drawLabel}</b> and ping you the second you’re picked. good luck ✦</p>
            {!pushOn && <button onClick={enablePush} style={{ display: 'block', margin: '0 auto 0.9rem', background: 'var(--h-surface-2)', border: '1px solid rgba(255,106,31,0.4)', color: ORANGE_DEEP, borderRadius: 999, padding: '0.5rem 1.1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>🔔 turn on raffle notifications</button>}
            <Link href="/hub" style={{ display: 'inline-block', background: ORANGE, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', textDecoration: 'none' }}>back to hub →</Link>
          </div>
        ) : ev.closed ? (
          // ── entries closed ──
          <div style={card}>
            <h2 style={cardH}>entries are closed.</h2>
            <p style={cardP}>this round filled up — watch the hub for the next {ev.series} drop.</p>
          </div>
        ) : (
          // ── register ──
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* ① cred check — pulled from the profile */}
            <div style={card}>
              <div style={cardLabel}>① your cred</div>
              <p style={cardP}>we match on who you actually are, so your profile has to be real first.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.7rem' }}>
                {cred.map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: c.ok ? 'var(--h-text)' : 'var(--h-text-dim)' }}>
                    <span style={{ color: c.ok ? GREEN : ORANGE_DEEP, fontWeight: 700 }}>{c.ok ? '✓' : '○'}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    {!c.ok && c.fix && <Link href={c.fix} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>fix →</Link>}
                  </div>
                ))}
              </div>
            </div>

            {/* ② match basics — the questions */}
            <div style={card}>
              <div style={cardLabel}>② your match basics</div>
              <p style={cardP}>so we draw you someone you’d actually want across the table.</p>
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div>
                  <div style={qLabel}>I’m…</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {GENDERS.map(([v, l]) => <button key={v} onClick={() => setGender(v)} style={chip(gender === v)}>{l}</button>)}
                  </div>
                </div>
                <div>
                  <div style={qLabel}>match me with…</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {SEEKING.map(([v, l]) => <button key={v} onClick={() => setSeeking(v)} style={chip(seeking === v)}>{l}</button>)}
                  </div>
                </div>
                <div>
                  <div style={qLabel}>ages I’m open to</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="number" min={18} max={99} value={ageMin} onChange={(e) => setAgeMin(+e.target.value)} style={numIn} />
                    <span style={{ color: 'var(--h-text-faint)' }}>to</span>
                    <input type="number" min={18} max={99} value={ageMax} onChange={(e) => setAgeMax(+e.target.value)} style={numIn} />
                  </div>
                </div>
              </div>
            </div>

            {/* ③ contest video */}
            <div style={card}>
              <div style={cardLabel}>③ your intro video <span style={{ color: ORANGE_DEEP }}>· required</span></div>
              <p style={cardP}>a 15–30s “hi, I’m {firstName}” clip — your contest intro. every entrant needs one.</p>
              {videoUrl ? (
                <div style={{ marginTop: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: GREEN, letterSpacing: '0.06em' }}>✓ video added · <button onClick={() => setVideoUrl(null)} style={{ background: 'none', border: 'none', color: ORANGE_DEEP, cursor: 'pointer', textDecoration: 'underline' }}>replace</button></div>
              ) : (
                <label style={{ ...btnGhost, display: 'inline-block', marginTop: '0.7rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'uploading…' : '🎬 upload a video'}
                  <input ref={fileRef} type="file" accept="video/*" capture="user" onChange={onVideo} disabled={uploading} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* ④ notifications */}
            <div style={card}>
              <div style={cardLabel}>④ notifications</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 18, height: 18, accentColor: ORANGE }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--h-text)' }}>🔔 ping me the moment I’m drawn</span>
              </label>
            </div>

            {/* ⑤ agree to the rules — required */}
            <div style={card}>
              <div style={cardLabel}>⑤ the fine print <span style={{ color: ORANGE_DEEP }}>· required</span></div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginTop: '0.6rem' }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 18, height: 18, accentColor: ORANGE, marginTop: '0.15rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--h-text)', lineHeight: 1.5 }}>
                  I’m <b>21 or older</b> (this dinner is 21+), a {ev.city}-area resident, and I agree to the{' '}
                  <Link href="/raffle/rules" target="_blank" style={{ color: ORANGE_DEEP, fontWeight: 700 }}>Official Rules</Link>, including the photo/video likeness release and the release of liability. I understand this is a free-to-enter sweepstakes and that I’ll be meeting someone in person entirely at my own risk.
                </span>
              </label>
            </div>

            <button onClick={enter} disabled={busy || uploading || !canEnter} style={{ background: canEnter ? ORANGE : 'var(--h-surface-2)', color: canEnter ? '#fff' : 'var(--h-text-faint)', border: canEnter ? 'none' : '1px solid var(--h-border)', borderRadius: 16, padding: '1.05rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.03em', cursor: busy || !canEnter ? 'not-allowed' : 'pointer', boxShadow: canEnter ? '0 16px 44px -18px rgba(255,106,31,0.7)' : 'none' }}>
              {busy ? '…' : canEnter ? '🎟️ enter the raffle' : 'finish the steps above'}
            </button>
            {!canEnter && <p style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>{!credOk ? 'establish your cred above' : !basicsOk ? 'pick your match basics' : !videoUrl ? 'upload your intro video' : 'agree to the official rules'}</p>}
            <p style={{ textAlign: 'center', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--h-text-faint)', margin: '0.4rem 0 0' }}>
              <b>*</b> No purchase necessary. Open to {ev.city}-area residents 21+. Winner selected by chance; odds depend on entries. Prize ARV up to ${ev.budget}. Void where prohibited. <Link href="/raffle/rules" style={{ color: ORANGE_DEEP }}>Official Rules</Link>.
            </p>
          </div>
        )}
        {err && <p style={{ color: ORANGE_DEEP, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>{err}</p>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 16, padding: '1.1rem 1.2rem' };
const cardH: React.CSSProperties = { fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.35rem', margin: '0 0 0.35rem', color: 'var(--h-text)' };
const cardP: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', fontSize: '0.88rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 };
const cardLabel: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 };
const qLabel: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)', marginBottom: '0.35rem' };
const btnGhost: React.CSSProperties = { background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.55rem 1.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
const numIn: React.CSSProperties = { width: 60, background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 8, padding: '0.4rem 0.5rem', color: 'var(--h-text)', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' };
const backLink: React.CSSProperties = { display: 'inline-block', marginTop: '1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
function chip(on: boolean): React.CSSProperties {
  return { background: on ? ORANGE : 'var(--h-surface-2)', color: on ? '#fff' : 'var(--h-text-dim)', border: `1px solid ${on ? ORANGE : 'var(--h-border)'}`, borderRadius: 999, padding: '0.4rem 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em', cursor: 'pointer' };
}
