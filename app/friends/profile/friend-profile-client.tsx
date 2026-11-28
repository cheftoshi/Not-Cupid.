'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../friend-hub.module.css';
import p from './profile.module.css';
import RefreshProfileButton from '@/components/refresh-profile-button';
import { compressImage } from '@/lib/compress-image';

const INK = 'var(--h-border)', LINE = '#064c48', LINE_DEEP = 'var(--h-accent)', CREAM = 'var(--h-surface)';
const chip: React.CSSProperties = { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.75rem', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.25rem 0.6rem' };
const label: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.3rem', letterSpacing: '0.04em', margin: '1.5rem 0 0.6rem' };

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
            {t}<button aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LINE_DEEP, fontWeight: 800 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input aria-label={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder} style={{ flex: 1, border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.45rem 0.7rem', fontSize: '0.85rem' }} />
        <button onClick={add} style={{ ...chip, cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  );
}

export default function FriendProfileClient({ initial, refreshCount }: { initial: Init; refreshCount?: number }) {
  const [photo, setPhoto] = useState(initial.photo_url);
  const [gallery, setGallery] = useState(initial.gallery);
  const [bio, setBio] = useState(initial.bio);
  const [occupation, setOccupation] = useState(initial.occupation);
  const [music, setMusic] = useState(initial.music);
  const [food, setFood] = useState(initial.food);
  const [hobbies, setHobbies] = useState(initial.hobbies);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]; if (!picked) return;
    setBusy(true); setMsg('');
    try {
      const file = await compressImage(picked);
      if (file.size > 4 * 1024 * 1024) { setMsg('that photo is too large even after shrinking — try another'); return; }
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) setPhoto(d.url); else setMsg(d.error || 'upload failed');
    } catch { setMsg('upload failed — check your connection and try again'); }
    finally { setBusy(false); e.target.value = ''; }
  }
  async function uploadGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]; if (!picked) return;
    setBusy(true); setMsg('');
    try {
      const file = await compressImage(picked);
      if (file.size > 4 * 1024 * 1024) { setMsg('that photo is too large even after shrinking — try another'); return; }
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/profile/gallery', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.gallery) setGallery(d.gallery); else setMsg(d.error || 'upload failed');
    } catch { setMsg('upload failed — check your connection and try again'); }
    finally { setBusy(false); e.target.value = ''; }
  }
  async function removeGallery(url: string) {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/profile/gallery', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setGallery(d.gallery || gallery.filter((g) => g !== url));
      else setMsg(d.error || 'could not remove that photo');
    } catch { setMsg('could not remove that photo — check your connection'); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, occupation, music, food, hobbies }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error || 'couldn\'t save'); return; }
      setMsg('✓ saved — taking you to your crew…');
      router.push('/friends'); router.refresh();
    } catch { setMsg('couldn\'t save — check your connection and try again'); }
    finally { setBusy(false); }
  }

  return (
    <div className={`${s.profileEditor} ${p.profile}`}>
      <div className={p.wrap}>
        <nav className={p.nav} aria-label="Friend profile navigation">
          <a className={p.navLink} href="/hub">Friend Line</a>
          <a className={p.navLink} href="/friends">Back to Friends</a>
        </nav>
        <h1 className={p.title}>Your Friend card</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', color: LINE_DEEP, margin: '0.4rem 0 1.5rem' }}>
          Your Friend card uses your shared photos, bio and interests. Friendship preferences stay separate.
        </p>

        {/* PHOTO */}
        <div className={p.card}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {photo ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: 14, objectFit: 'cover', border: '1px solid var(--h-border)' }} />
              : <div className={p.photoEmpty}>No photo</div>}
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.3rem' }}>Main photo</div>
              <label style={{ ...chip, cursor: 'pointer', display: 'inline-block', marginTop: '0.4rem' }}>
                {photo ? 'Change' : 'Upload'} <input type="file" accept="image/*" onChange={uploadPhoto} aria-label="Main photo" disabled={busy}  />
              </label>
            </div>
          </div>
        </div>

        {/* GALLERY */}
        <div className={p.section}>More photos</div>
        <div className={p.card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {gallery.map((g) => (
              <div key={g} style={{ position: 'relative' }}>
                <img src={g} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--h-border)' }} />
                <button aria-label="Remove gallery photo" onClick={() => removeGallery(g)} disabled={busy} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--h-surface)', border: '1px solid var(--h-border)', cursor: busy ? 'wait' : 'pointer', fontWeight: 800 }}>×</button>
              </div>
            ))}
            {gallery.length < 3 && (
              <label style={{ width: 80, height: 80, borderRadius: 10, border: `2px dashed ${LINE}`, background: 'var(--h-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.4rem' }}>
                +<input type="file" accept="image/*" onChange={uploadGallery} aria-label="Add gallery photo" disabled={busy}  />
              </label>
            )}
          </div>
        </div>

        {/* BIO + WORK */}
        <div className={p.section}>About you</div>
        <div className={p.card}>
          <textarea aria-label="About you" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
            placeholder="who are you when you're not working? what's your ideal weekend?"
            style={{ width: '100%', border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontFamily: 'var(--font-ui)', marginBottom: '0.6rem' }} />
          <input aria-label="Occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="what do you do?"
            style={{ width: '100%', border: '1px solid var(--h-border)', borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: '0.9rem' }} />
        </div>

        {/* INTERESTS */}
        <div className={p.section}>Your interests</div>
        <div className={p.card}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, marginBottom: '0.4rem' }}>music</div>
          <TagField value={music} onChange={setMusic} placeholder="add a genre / artist…" />
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, margin: '1rem 0 0.4rem' }}>food</div>
          <TagField value={food} onChange={setFood} placeholder="add a cuisine / spot…" />
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: LINE_DEEP, margin: '1rem 0 0.4rem' }}>hobbies &amp; obsessions</div>
          <TagField value={hobbies} onChange={setHobbies} placeholder="add a hobby…" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={save} disabled={busy} className={p.save}>
            {busy ? 'Saving…' : 'Save my card'}
          </button>
          {msg && <span style={{ fontFamily: 'var(--font-ui)', fontStyle: 'normal', color: LINE_DEEP }}>{msg}</span>}
        </div>
        <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.6rem' }}>
          photos save instantly · bio &amp; interests save when you hit the button
        </p>

        {/* START FRESH — wipe & re-take quiz, capped at 3 per account */}
        <div style={{ ...label, color: LINE_DEEP }}>Start over</div>
        <div className={p.card}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--h-text)', margin: '0 0 0.6rem' }}>
            Vibes changed? Re-take the friend quiz to update your activities, who you&apos;re open to, and your age range. Your crews stay put.
          </p>
          <a href="/friends/quiz?retake=1" style={{ display: 'inline-block', background: 'var(--h-surface)', color: LINE_DEEP, fontFamily: "'Space Grotesk', sans-serif", fontSize: '1rem', letterSpacing: '0.06em', padding: '0.55rem 1.2rem', borderRadius: 10, border: '1px solid var(--h-border)', boxShadow: 'none', textDecoration: 'none' }}>
            Retake Friend quiz →
          </a>
        </div>

        <div className={p.card}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--h-text)', margin: '0 0 0.4rem' }}>
            Want a clean slate? This wipes your quiz answers, profile, and current matches on <strong>both</strong> the Friend and Love lines, then you re-take the quiz. Your account stays. Limited to 3 times.
          </p>
          <RefreshProfileButton usedCount={refreshCount} />
        </div>
      </div>
    </div>
  );
}
