'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/wordmark';
import { compressImage } from '@/lib/compress-image';
import { ARCHETYPES, VIBE_HEADS, vibeLabel, ATTACH_LABEL } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';
import styles from './hub.module.css';

type Profile = {
  name: string;
  photo_url: string | null;
  archetype: string | null;
  age: number | null;
  score_honesty?: number;
  score_emotionality?: number;
  score_extraversion?: number;
  score_agreeableness?: number;
  score_conscientiousness?: number;
  score_openness?: number;
  attach_style?: string | null;
  vibes?: Record<string, number> | null;
  music?: string[];
  food?: string[];
  hobbies?: string[];
};

const HEXACO_MAX = 8;
const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';

export default function HubClient({
  firstName,
  onWaitlist,
  hasArchetype,
  needsLoveDeep,
  profile,
}: {
  firstName: string;
  onWaitlist: boolean;
  hasArchetype: boolean;
  needsLoveDeep?: boolean;
  profile: Profile;
}) {
  const [coords, setCoords] = useState({ x: 50, y: 40 });
  const [photo, setPhoto] = useState<string | null>(profile.photo_url);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      setCoords({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploading(true);
    setMsg('');
    try {
      const file = await compressImage(picked);
      if (file.size > 4 * 1024 * 1024) { setMsg('that photo is too large — try another'); return; }
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok && d.url) { setPhoto(d.url); setMsg('✓ photo updated'); setTimeout(() => setMsg(''), 2500); }
      else setMsg(d.error || 'upload failed');
    } catch {
      setMsg('upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // No core quiz yet → /quiz. Core done but love-deep not → the deeper love
  // quiz. Fully set up → straight to the love profile.
  const loveHref = !hasArchetype ? '/quiz' : needsLoveDeep ? '/quiz?line=love' : '/profile';
  const needsQuiz = !hasArchetype || typeof profile.score_honesty !== 'number';

  const meta = ARCHETYPES.find((a) => a.name === profile.archetype);
  const hexaco = ([
    ['Honesty', profile.score_honesty],
    ['Emotionality', profile.score_emotionality],
    ['Extraversion', profile.score_extraversion],
    ['Agreeableness', profile.score_agreeableness],
    ['Conscientiousness', profile.score_conscientiousness],
    ['Openness', profile.score_openness],
  ] as Array<[string, any]>).filter(([, s]) => typeof s === 'number');

  const vibeTags = (Object.keys(VIBE_HEADS) as VibeKey[])
    .map((k) => ({ k, label: vibeLabel(k, (profile.vibes ?? {})[k]) }))
    .filter((v) => !!v.label);
  const attachLabel = profile.attach_style ? ATTACH_LABEL[profile.attach_style as keyof typeof ATTACH_LABEL] : null;
  const interests = [...(profile.music ?? []), ...(profile.food ?? []), ...(profile.hobbies ?? [])].slice(0, 12);

  return (
    <main className={styles.hub}>
      <div
        className={styles.glow}
        style={{ background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.22) 0%, rgba(255,106,31,0.10) 35%, transparent 60%)` }}
        aria-hidden
      />
      <div className={styles.grain} aria-hidden />

      <header className={styles.top}>
        <Wordmark size={1.25} href="/hub" />
        <a
          href="/api/auth/logout"
          onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }}
          className={styles.logout}
        >log out</a>
      </header>

      {/* ── YOUR HOME BASE ── */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 920, margin: '0 auto', padding: '0 1.25rem', width: '100%' }}>
        <p className={styles.eyebrow}>🚉 welcome back · <em className={styles.eyebrowName}>{firstName.toLowerCase()}</em></p>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.5rem 0 1.5rem' }}>
          {/* photo + upload */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 96, height: 96, borderRadius: 20, overflow: 'hidden', background: '#e8edff', border: '2px solid rgba(37,99,255,0.25)' }}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: BLUE, fontSize: '0.7rem', textAlign: 'center', padding: '0.5rem' }}>no photo yet</div>
              )}
            </div>
            <label style={{ position: 'absolute', bottom: -6, right: -6, background: '#0b0b0b', color: '#fff', borderRadius: 999, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 12px -4px rgba(0,0,0,0.5)' }} title="change photo">
              {uploading ? '…' : '＋'}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>

          {/* name + archetype */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(1.5rem, 5vw, 2.1rem)', color: '#0a0a0a', lineHeight: 1.05 }}>
              {profile.name.split(' ')[0]}{profile.age ? <span style={{ fontWeight: 400, color: '#6b6975' }}>, {profile.age}</span> : null}
            </div>
            {meta ? (
              <div style={{ marginTop: '0.35rem' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6b6975' }}>you are the</span>{' '}
                <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.05rem', color: BLUE }}>{profile.archetype}</span>
                {meta.tag && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', color: BLUE_DEEP, marginTop: '0.15rem' }}>{meta.tag}</div>}
              </div>
            ) : (
              <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.92rem', marginTop: '0.35rem' }}>finish the quiz to unlock your match profile.</div>
            )}
            {msg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', color: msg.startsWith('✓') ? '#2d7a4f' : '#d2530f', marginTop: '0.4rem' }}>{msg}</div>}
          </div>
        </div>

        {/* aesthetics snapshot — or a quiz nudge */}
        {needsQuiz ? (
          <div style={{ background: 'linear-gradient(135deg,#e8edff,#fff)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1rem', color: '#0a0a0a' }}>take the quiz to unlock your aesthetic + matching.</span>
            <Link href="/quiz?retake=1" style={{ background: '#0b0b0b', color: '#fff', borderRadius: 999, padding: '0.6rem 1.3rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>take the quiz →</Link>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid rgba(37,99,255,0.18)', borderRadius: 18, boxShadow: '0 14px 40px -28px rgba(27,70,201,0.5)', padding: '1.25rem 1.4rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.9rem' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6b6975' }}>your aesthetic</span>
              <Link href="/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none', borderBottom: `1px dashed ${BLUE}`, paddingBottom: 2 }}>edit full profile →</Link>
            </div>

            {/* HEXACO bars */}
            {hexaco.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: vibeTags.length || attachLabel ? '1rem' : 0 }}>
                {hexaco.map(([label, score]) => {
                  const pct = Math.min(100, Math.round((score / HEXACO_MAX) * 100));
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b6975', width: 120, flexShrink: 0 }}>{label}</span>
                      <span style={{ flex: 1, height: 4, background: 'rgba(37,99,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: BLUE, borderRadius: 999 }} />
                      </span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: BLUE_DEEP, width: 26, textAlign: 'right' }}>{pct}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* attachment + vibe tags */}
            {(attachLabel || vibeTags.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: interests.length ? '1rem' : 0 }}>
                {attachLabel && (
                  <span style={{ background: 'rgba(255,106,31,0.12)', color: '#d2530f', border: '1px solid rgba(255,106,31,0.35)', borderRadius: 999, padding: '0.35rem 0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em' }}>
                    <span style={{ opacity: 0.6, marginRight: '0.4rem', fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>attachment</span>{attachLabel}
                  </span>
                )}
                {vibeTags.map((v) => (
                  <span key={v.k} style={{ background: 'rgba(37,99,255,0.13)', color: BLUE_DEEP, border: '1px solid rgba(37,99,255,0.35)', borderRadius: 999, padding: '0.35rem 0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.04em' }}>
                    <span style={{ opacity: 0.55, marginRight: '0.4rem', fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{VIBE_HEADS[v.k]}</span>{v.label}
                  </span>
                ))}
              </div>
            )}

            {/* interest chips */}
            {interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {interests.map((t, i) => (
                  <span key={`${t}-${i}`} style={{ background: '#e8edff', color: '#0e0c1a', border: '1px solid rgba(14,12,26,0.12)', borderRadius: 999, padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── WHERE TO TODAY? (line chooser) ── */}
      <section className={styles.intro} style={{ paddingTop: 0 }}>
        <h1 className={styles.h1}>where to today?</h1>
        <p className={styles.lede}>two lines, one you. pick your platform.</p>
      </section>

      <section className={styles.grid}>
        {/* LOVE LINE */}
        <div className={`${styles.card} ${styles.cardLove}`}>
          <div className={styles.cardEyebrow}><span className={styles.dotLive} />live</div>
          <h2 className={styles.cardH2}>love <em>line.</em></h2>
          <p className={styles.cardDesc}>
            pick from your most compatible, near you. built on
            personality, not lighting. no swipes, no photos first.
          </p>
          <div className={styles.cardSpec}>
            <div><span className={styles.specK}>quiz</span><span className={styles.specV}>personality-led</span></div>
            <div><span className={styles.specK}>pool</span><span className={styles.specV}>new england + nyc</span></div>
            <div><span className={styles.specK}>match</span><span className={styles.specV}>5–75mi, you tune it</span></div>
            <div><span className={styles.specK}>style</span><span className={styles.specV}>you choose</span></div>
          </div>
          <Link href={loveHref} className={styles.cardCta} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>{needsLoveDeep ? 'finish your love profile →' : 'board the love line →'}</Link>
          <Link href="/how-it-works" className={styles.cardSub}>how the love line works →</Link>
        </div>

        {/* FRIEND LINE */}
        <div className={`${styles.card} ${styles.cardFriend}`}>
          <div className={styles.cardEyebrow}><span className={styles.dotLive} />live</div>
          <h2 className={styles.cardH2}>friend <em>line.</em></h2>
          <p className={styles.cardDesc}>
            up to 5 platonic matches. shared interests, a group chat, a city
            full of plans. a real crew, not a swipe deck.
          </p>
          <div className={styles.cardSpec}>
            <div><span className={styles.specK}>matches</span><span className={styles.specV}>5 max</span></div>
            <div><span className={styles.specK}>pool</span><span className={styles.specV}>group chat</span></div>
            <div><span className={styles.specK}>style</span><span className={styles.specV}>activity-led</span></div>
          </div>
          <Link href="/friends" className={styles.cardCtaFriend} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            find your crew →
          </Link>
          <Link href="/friends/how-it-works" className={styles.cardSub}>how the friend line works →</Link>
        </div>
      </section>

      {/* quick links */}
      <section style={{ position: 'relative', zIndex: 5, maxWidth: 920, margin: '1.5rem auto 0', padding: '0 1.25rem', width: '100%', display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>💘 your matches →</Link>
        <Link href="/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>✎ full profile →</Link>
        <Link href="/quiz?retake=1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a96a8', textDecoration: 'none' }}>↻ retake quiz</Link>
      </section>

      <footer className={styles.foot}>
        <div className={styles.footTop}>
          <span>made with cynicism in boston</span>
        </div>
        <div className={styles.footCorp}>
          © {new Date().getFullYear()} notcupid · a lemon labs property
        </div>
      </footer>
    </main>
  );
}
