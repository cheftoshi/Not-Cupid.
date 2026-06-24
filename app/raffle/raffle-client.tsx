'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { subscribeToPush } from '@/lib/push-client';

type Event = { series: string; city: string; dateLabel: string; budget: number; tagline: string; drawLabel: string };

const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';

export default function RaffleClient({ firstName, eligible, hasProfile, event }: {
  firstName: string; eligible: boolean; hasProfile: boolean; event: Event;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) { setErr('that video is over 80MB — keep it short (15–30s).'); return; }
    setUploading(true); setErr('');
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const r = await fetch('/api/raffle/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'upload not available — you can still enter without it.'); return; }
      const put = await fetch(d.signedUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'video/mp4' } });
      if (!put.ok) { setErr('upload failed — you can still enter without a video.'); return; }
      setVideoUrl(d.publicUrl);
    } catch { setErr('upload failed — you can still enter without a video.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function enter() {
    setBusy(true); setErr('');
    try {
      if (notify) await subscribeToPush().catch(() => {});
      const r = await fetch('/api/raffle/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_url: videoUrl, notify }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'could not enter'); return; }
      setDone(true);
    } catch { setErr('could not enter — try again'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <Link href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← hub</Link>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: ORANGE_DEEP, margin: '1.5rem 0 0.6rem', fontWeight: 700 }}>🎟️ {event.series} · {event.city}</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.2rem,8vw,3.2rem)', lineHeight: 1.02, margin: '0 0 0.6rem' }}>{event.tagline}</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 1.75rem' }}>
          we draw two compatible Bostonians, and if you both say yes, dinner’s on us — up to <b>${event.budget}</b>, <b>{event.dateLabel}</b>.
        </p>

        {done ? (
          <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.12), var(--h-surface))', border: `2px solid ${ORANGE}`, borderRadius: 18, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.6rem', margin: '0.3rem 0' }}>you’re in, {firstName.toLowerCase()}.</h2>
            <p style={{ color: 'var(--h-text-dim)', fontSize: '0.92rem', margin: '0 0 1rem' }}>we draw the pairs <b>{event.drawLabel}</b> and we’ll ping you if you’re picked. good luck ✦</p>
            <Link href="/hub" style={{ display: 'inline-block', background: ORANGE, color: '#fff', borderRadius: 999, padding: '0.6rem 1.5rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', textDecoration: 'none' }}>back to hub →</Link>
          </div>
        ) : !eligible ? (
          <div style={card}>
            <h2 style={cardH}>this one’s {event.city}-only.</h2>
            <p style={cardP}>change your city to {event.city} on the <Link href="/dashboard" style={{ color: ORANGE_DEEP }}>Love line</Link> to enter — more cities coming.</p>
          </div>
        ) : !hasProfile ? (
          <div style={card}>
            <h2 style={cardH}>finish your profile first.</h2>
            <p style={cardP}>we match you on who you actually are — add a photo and finish the quiz, then come back.</p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem' }}>
              <Link href="/profile" style={btnGhost}>add a photo →</Link>
              <Link href="/quiz?retake=1" style={btnGhost}>take the quiz →</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* contest video */}
            <div style={card}>
              <div style={cardLabel}>① your intro video <span style={{ color: 'var(--h-text-faint)' }}>· optional but it helps</span></div>
              <p style={cardP}>a 15–30s “hi, I’m {firstName}” clip — it rides along as your contest intro.</p>
              {videoUrl ? (
                <div style={{ marginTop: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: '#2d7a4f', letterSpacing: '0.06em' }}>✓ video added · <button onClick={() => setVideoUrl(null)} style={{ background: 'none', border: 'none', color: ORANGE_DEEP, cursor: 'pointer', textDecoration: 'underline' }}>replace</button></div>
              ) : (
                <label style={{ ...btnGhost, display: 'inline-block', marginTop: '0.7rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'uploading…' : '🎬 upload a video'}
                  <input ref={fileRef} type="file" accept="video/*" capture="user" onChange={onVideo} disabled={uploading} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* notifications */}
            <div style={card}>
              <div style={cardLabel}>② notifications</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 18, height: 18, accentColor: ORANGE }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--h-text)' }}>🔔 ping me the moment I’m drawn</span>
              </label>
            </div>

            <button onClick={enter} disabled={busy || uploading} style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 16, padding: '1.05rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.03em', cursor: busy ? 'wait' : 'pointer', boxShadow: '0 16px 44px -18px rgba(255,106,31,0.7)' }}>
              {busy ? '…' : '🎟️ enter the raffle'}
            </button>
          </div>
        )}
        {err && <p style={{ color: ORANGE_DEEP, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>{err}</p>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 16, padding: '1.1rem 1.2rem' };
const cardH: React.CSSProperties = { fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.35rem', margin: '0 0 0.35rem', color: 'var(--h-text)' };
const cardP: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem', color: 'var(--h-text-dim)', lineHeight: 1.5, margin: 0 };
const cardLabel: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 };
const btnGhost: React.CSSProperties = { background: 'var(--h-surface-2)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.55rem 1.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };
