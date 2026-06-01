'use client';

import { useState } from 'react';

const INK = '#241d12', LINE = '#e8842b', LINE_DEEP = '#c96a18', CREAM = '#f7f1e3';
const card: React.CSSProperties = { background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 16, boxShadow: `5px 5px 0 ${INK}`, padding: '1.25rem' };
const chip: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', background: '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.25rem 0.6rem' };
const label: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.04em', margin: '1.5rem 0 0.6rem' };

type Init = { name: string; photo_url: string | null; gallery: string[]; bio: string; occupation: string; music: string[]; food: string[]; hobbies: string[] };

// Comma-list editor for interest tags.
function TagField({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  function add() { const t = draft.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(''); }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {value.map((t) => (
          <span key={t} style={{ ...chip, display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            {t}<button onClick={() => onChange(value.filter((x) => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, fontWeight: 800 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder} style={{ flex: 1, border: `2px solid ${INK}`, borderRadius: 10, padding: '0.45rem 0.7rem', fontSize: '0.85rem' }} />
        <button onClick={add} style={{ ...chip, cursor: 'pointer' }}>add</button>
      </div>
    </div>
  );
}

export default function FriendProfileClient({ initial }: { initial: Init }) {
  const [photo, setPhoto] = useState(initial.photo_url);
  const [gallery, setGallery] = useState(initial.gallery);
  const [bio, setBio] = useState(initial.bio);
  const [occupation, setOccupation] = useState(initial.occupation);
  const [music, setMusic] = useState(initial.music);
  const [food, setFood] = useState(initial.food);
  const [hobbies, setHobbies] = useState(initial.hobbies);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setMsg('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
    const d = await r.json();
    if (r.ok && d.url) setPhoto(d.url); else setMsg(d.error || 'upload failed');
    setBusy(false);
  }
  async function uploadGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setMsg('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/profile/gallery', { method: 'POST', body: fd });
    const d = await r.json();
    if (r.ok && d.gallery) setGallery(d.gallery); else setMsg(d.error || 'upload failed');
    setBusy(false);
  }
  async function removeGallery(url: string) {
    const r = await fetch('/api/profile/gallery', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const d = await r.json(); if (r.ok) setGallery(d.gallery || gallery.filter((g) => g !== url));
  }
  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, occupation, music, food, hobbies }),
    });
    setMsg(r.ok ? '✓ saved' : 'couldn\'t save'); setBusy(false);
    setTimeout(() => setMsg(''), 2500);
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(170deg, ${CREAM} 0%, #f3e7cf 60%, #f7ddc0 100%)`, color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <a href="/hub" style={{ background: LINE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6, border: `2px solid ${INK}`, textDecoration: 'none' }}>FRIEND LINE</a>
          <a href="/friends" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>← back to hub</a>
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,8vw,3.4rem)', lineHeight: 0.88, color: LINE, WebkitTextStroke: `2px ${INK}`, textShadow: `4px 4px 0 rgba(36,29,18,0.18)`, margin: 0 }}>
          your friend card.
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: LINE_DEEP, margin: '0.4rem 0 1.5rem' }}>
          this is what your crews see — make it you. (separate from your dating profile.)
        </p>

        {/* PHOTO */}
        <div style={card}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {photo ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: 14, objectFit: 'cover', border: `3px solid ${INK}` }} />
              : <div style={{ width: 96, height: 96, borderRadius: 14, border: `3px dashed ${LINE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>📸</div>}
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem' }}>main photo</div>
              <label style={{ ...chip, cursor: 'pointer', display: 'inline-block', marginTop: '0.4rem' }}>
                {photo ? 'change' : 'upload'} <input type="file" accept="image/*" onChange={uploadPhoto} disabled={busy} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>

        {/* GALLERY */}
        <div style={label}>more photos</div>
        <div style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {gallery.map((g) => (
              <div key={g} style={{ position: 'relative' }}>
                <img src={g} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: `2px solid ${INK}` }} />
                <button onClick={() => removeGallery(g)} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#fff', border: `2px solid ${INK}`, cursor: 'pointer', fontWeight: 800 }}>×</button>
              </div>
            ))}
            {gallery.length < 3 && (
              <label style={{ width: 80, height: 80, borderRadius: 10, border: `2px dashed ${LINE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.4rem' }}>
                +<input type="file" accept="image/*" onChange={uploadGallery} disabled={busy} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {/* BIO + WORK */}
        <div style={label}>about you</div>
        <div style={card}>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
            placeholder="who are you when you're not working? what's your ideal weekend?"
            style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontFamily: 'Georgia,serif', marginBottom: '0.6rem' }} />
          <input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="what do you do?"
            style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: '0.9rem' }} />
        </div>

        {/* INTERESTS */}
        <div style={label}>what you&apos;re into</div>
        <div style={card}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, marginBottom: '0.4rem' }}>music</div>
          <TagField value={music} onChange={setMusic} placeholder="add a genre / artist…" />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, margin: '1rem 0 0.4rem' }}>food</div>
          <TagField value={food} onChange={setFood} placeholder="add a cuisine / spot…" />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, margin: '1rem 0 0.4rem' }}>hobbies &amp; obsessions</div>
          <TagField value={hobbies} onChange={setHobbies} placeholder="add a hobby…" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={save} disabled={busy} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.05em', color: '#fff', background: LINE, border: `3px solid ${INK}`, borderRadius: 12, padding: '0.6rem 1.75rem', boxShadow: `4px 4px 0 ${INK}`, cursor: 'pointer' }}>
            {busy ? 'saving…' : 'save my card →'}
          </button>
          {msg && <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: LINE_DEEP }}>{msg}</span>}
        </div>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8896a', marginTop: '0.6rem' }}>
          photos save instantly · bio &amp; interests save when you hit the button
        </p>
      </div>
    </div>
  );
}
