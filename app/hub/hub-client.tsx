'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/wordmark';
import { compressImage } from '@/lib/compress-image';
import { ARCHETYPES, VIBE_HEADS, vibeLabel } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';
import styles from './hub.module.css';

type Profile = {
  name: string; photo_url: string | null; archetype: string | null; age: number | null;
  attach_style?: string | null; vibes?: Record<string, number> | null;
  music?: string[]; food?: string[]; hobbies?: string[];
};

type Activity = {
  id: string; title: string; kind: string; area: string | null; category: string | null;
  happens_at: string | null; iRsvped: boolean; eligible: boolean;
  myResponse: 'yes' | 'maybe' | 'no' | null;
  responses: { yes: number; maybe: number; no: number };
};

type Friend = {
  otherId: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; metro: string | null; sharedActivities: string[];
  connected: boolean; opened: boolean;
};

const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';
const ORANGE_DEEP = '#d2530f';

function whenLabel(iso: string | null): string {
  if (!iso) return 'anytime';
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  if (ms < 0) return 'happening now';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${day} · ${time}`;
}

export default function HubClient({
  firstName, hasArchetype, needsLoveDeep, profile, city, matchRadius,
}: {
  firstName: string; onWaitlist: boolean; hasArchetype: boolean; needsLoveDeep?: boolean; profile: Profile;
  city?: string | null; matchRadius?: number;
}) {
  const [coords, setCoords] = useState({ x: 50, y: 40 });
  const [photo, setPhoto] = useState<string | null>(profile.photo_url);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [feed, setFeed] = useState<Activity[] | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendOptedIn, setFriendOptedIn] = useState(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      setCoords({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    fetch('/api/friend/activities')
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d) => setFeed(Array.isArray(d.activities) ? d.activities : []))
      .catch(() => setFeed([]));
    // Your friends — the people from your packs you've connected with. They
    // persist across packs (opening a new pack only adds; it never drops anyone).
    fetch('/api/friend/roster')
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((d) => {
        setFriendOptedIn(!!d.optedIn);
        setFriends(Array.isArray(d.matches) ? d.matches.filter((m: Friend) => m.opened) : []);
      })
      .catch(() => setFriends([]));
  }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploading(true); setMsg('');
    try {
      const file = await compressImage(picked);
      if (file.size > 4 * 1024 * 1024) { setMsg('too large — try another'); return; }
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok && d.url) { setPhoto(d.url); setMsg('✓ updated'); setTimeout(() => setMsg(''), 2000); }
      else setMsg(d.error || 'failed');
    } catch { setMsg('failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const loveHref = !hasArchetype ? '/quiz' : needsLoveDeep ? '/quiz?line=love' : '/profile';
  const meta = ARCHETYPES.find((a) => a.name === profile.archetype);

  // interests + vibe tags (NOT the personality bars)
  const interestGroups = [
    { head: 'music', items: profile.music ?? [] },
    { head: 'food & drink', items: profile.food ?? [] },
    { head: 'into', items: profile.hobbies ?? [] },
  ].filter((g) => g.items.length > 0);
  const vibeTags = (Object.keys(VIBE_HEADS) as VibeKey[])
    .map((k) => ({ k, label: vibeLabel(k, (profile.vibes ?? {})[k]) }))
    .filter((v) => !!v.label);

  // derive the activity sections from the friend feed
  const now = Date.now();
  const upcoming = (a: Activity) => a.kind === 'event' && (!a.happens_at || new Date(a.happens_at).getTime() >= now - 6 * 3600_000);
  const myEvents = (feed ?? []).filter((a) => a.kind === 'event' && (a.myResponse === 'yes' || a.myResponse === 'maybe') && upcoming(a));
  const likedPosts = (feed ?? []).filter((a) => a.kind === 'post' && a.myResponse === 'yes').slice(0, 4);
  const forYourVibe = (feed ?? []).filter((a) => a.kind === 'event' && a.eligible && !a.iRsvped && upcoming(a)).slice(0, 5);

  const railLink: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none', padding: '0.55rem 0', borderBottom: '1px solid rgba(37,99,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  return (
    <main className={styles.hub}>
      <div className={styles.glow} style={{ background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.20) 0%, rgba(255,106,31,0.08) 35%, transparent 60%)` }} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <header className={styles.top}>
        <Wordmark size={1.25} href="/hub" />
        <a href="/api/auth/logout" onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }} className={styles.logout}>log out</a>
      </header>

      <div className={styles.dashWrap}>
        <div className={styles.dashGrid}>
          {/* ── LEFT RAIL: identity + line choice + nav ── */}
          <aside className={styles.dashRail}>
            <div className={styles.dCard} style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 0.7rem' }}>
                <div style={{ width: 84, height: 84, borderRadius: 18, overflow: 'hidden', background: '#e8edff', border: '2px solid rgba(37,99,255,0.25)' }}>
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: BLUE, fontSize: '0.62rem' }}>no photo</div>}
                </div>
                <label style={{ position: 'absolute', bottom: -6, right: -6, background: '#0b0b0b', color: '#fff', borderRadius: 999, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.8rem' }} title="change photo">
                  {uploading ? '…' : '＋'}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '1.25rem', color: '#0a0a0a' }}>
                {profile.name.split(' ')[0]}{profile.age ? <span style={{ fontWeight: 400, color: '#6b6975' }}>, {profile.age}</span> : null}
              </div>
              {meta
                ? <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.85rem', color: BLUE, marginTop: '0.15rem' }}>{profile.archetype}</div>
                : <Link href="/quiz?retake=1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>finish your quiz →</Link>}
              {city && (
                <div style={{ marginTop: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', color: '#6b6975' }}>
                  📍 {city}{matchRadius ? <span style={{ opacity: 0.7 }}> · {matchRadius}mi</span> : null}
                </div>
              )}
              {msg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', color: msg.startsWith('✓') ? '#2d7a4f' : '#d2530f', marginTop: '0.4rem' }}>{msg}</div>}
            </div>

            {/* line choice — compact, on the side */}
            <div className={styles.dCard}>
              <span className={styles.dLabel}>your lines</span>
              <Link href={loveHref} style={{ display: 'block', background: '#2563ff', color: '#fff', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none', marginBottom: '0.5rem' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.03em' }}>💘 love line</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', opacity: 0.85, marginTop: '0.1rem' }}>{needsLoveDeep ? 'finish your love profile →' : 'pick your people →'}</div>
              </Link>
              <Link href="/friends" style={{ display: 'block', background: '#ff6a1f', color: '#fff', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.03em' }}>🧡 friend line</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', opacity: 0.9, marginTop: '0.1rem' }}>crews · the scene →</div>
              </Link>
            </div>

            {/* quick nav */}
            <div className={styles.dCard} style={{ paddingTop: '0.4rem', paddingBottom: '0.4rem' }}>
              <Link href="/dashboard" style={railLink}><span>💘 your matches</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/profile" style={railLink}><span>✎ full profile</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/quiz?retake=1" style={railLink}><span>↻ retake quiz</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/pro" style={{ ...railLink, borderBottom: 'none', color: ORANGE_DEEP, fontWeight: 700 }}><span>✦ go all-access</span><span style={{ opacity: 0.5 }}>→</span></Link>
            </div>
          </aside>

          {/* ── MAIN: what you're into + your activity ── */}
          <section className={styles.dashMain}>
            <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(1.5rem,4vw,2rem)', color: '#0a0a0a', margin: '0 0 0.25rem' }}>
              hey {firstName.toLowerCase()}.
            </p>

            {/* WHAT YOU'RE INTO (interests + vibe — not personality bars) */}
            <div className={styles.dCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className={styles.dLabel}>what you’re into</span>
                <Link href="/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>edit →</Link>
              </div>
              {interestGroups.length === 0 && vibeTags.length === 0 ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.9rem', margin: 0 }}>
                  add your music, food &amp; hobbies on your <Link href="/profile" style={{ color: BLUE_DEEP }}>profile</Link> so matches see the real you.
                </p>
              ) : (
                <>
                  {interestGroups.map((g) => (
                    <div key={g.head} style={{ marginBottom: '0.6rem' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a96a8', marginBottom: '0.35rem' }}>{g.head}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {g.items.map((t, i) => <span key={`${t}-${i}`} style={{ background: '#e8edff', color: '#0e0c1a', border: '1px solid rgba(14,12,26,0.12)', borderRadius: 999, padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                  {vibeTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                      {vibeTags.map((v) => (
                        <span key={v.k} style={{ background: 'rgba(37,99,255,0.1)', color: BLUE_DEEP, border: '1px solid rgba(37,99,255,0.3)', borderRadius: 999, padding: '0.3rem 0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em' }}>{v.label}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* YOUR FRIENDS — persist across packs (opening a new pack only adds) */}
            {friendOptedIn && friends !== null && (
              <div className={styles.dCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className={styles.dLabel}>your friends{friends.length ? ` · ${friends.length}` : ''}</span>
                  {friends.length > 0 && <Link href="/friends?view=crew" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>group chat →</Link>}
                </div>
                {friends.length === 0 ? (
                  <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.9rem', margin: 0 }}>
                    no friends opened yet — <Link href="/friends/pack" style={{ color: ORANGE_DEEP }}>open your first pack 🎒 →</Link>
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                      {friends.slice(0, 12).map((f) => (
                        <Link key={f.otherId} href="/friends?view=crew" title={f.sharedActivities.length ? `both into ${f.sharedActivities.slice(0, 2).join(', ')}` : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#faf7f3', border: '1px solid rgba(255,106,31,0.22)', borderRadius: 999, padding: '0.25rem 0.7rem 0.25rem 0.25rem', textDecoration: 'none' }}>
                          {f.photo_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={f.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            : <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#ffe6c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: ORANGE_DEEP, fontSize: '0.85rem' }}>{(f.name || '?').charAt(0)}</span>}
                          <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '0.9rem', color: '#0a0a0a' }}>{(f.name || 'friend').split(' ')[0]}</span>
                          {f.connected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3f7d57' }} title="in your crew" />}
                        </Link>
                      ))}
                      {friends.length > 12 && <span style={{ alignSelf: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: '#9a96a8' }}>+{friends.length - 12} more</span>}
                    </div>
                    <Link href="/friends/pack" style={{ display: 'inline-block', marginTop: '0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>🎒 open another pack →</Link>
                  </>
                )}
              </div>
            )}

            {/* YOUR EVENTS (RSVP'd) */}
            <div className={styles.dCard}>
              <span className={styles.dLabel}>your events</span>
              {feed === null ? (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a96a8', margin: 0 }}>loading…</p>
              ) : myEvents.length === 0 ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '0.9rem', margin: 0 }}>
                  nothing on your calendar yet — <Link href="/friends?view=scene" style={{ color: ORANGE_DEEP }}>find something on the Scene →</Link>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {myEvents.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: '#faf7f3', border: '1.5px solid rgba(255,106,31,0.25)', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#6b6975' }}>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''}</div>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: a.myResponse === 'yes' ? '#2d7a4f' : ORANGE_DEEP, flexShrink: 0 }}>{a.myResponse === 'yes' ? "you're in" : 'maybe'}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* FOR YOUR VIBE (discover upcoming events) */}
            {feed !== null && forYourVibe.length > 0 && (
              <div className={styles.dCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className={styles.dLabel}>for your vibe</span>
                  <Link href="/friends?view=scene" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>all events →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {forYourVibe.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: '#fff', border: '1px solid rgba(11,11,11,0.1)', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#6b6975' }}>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''} · {a.responses.yes} going</div>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: BLUE_DEEP, flexShrink: 0 }}>rsvp →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* LIKED ON THE SCENE */}
            {feed !== null && likedPosts.length > 0 && (
              <div className={styles.dCard}>
                <span className={styles.dLabel}>you liked</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {likedPosts.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" style={{ background: 'rgba(255,106,31,0.1)', color: ORANGE_DEEP, border: '1px solid rgba(255,106,31,0.3)', borderRadius: 999, padding: '0.4rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none' }}>♥ {a.title}</Link>
                  ))}
                </div>
              </div>
            )}

            {/* empty-scene nudge (no friend activity at all) */}
            {feed !== null && myEvents.length === 0 && forYourVibe.length === 0 && likedPosts.length === 0 && (
              <div className={styles.dCard} style={{ background: 'linear-gradient(135deg,#fff1e8,#fff)', borderColor: 'rgba(255,106,31,0.3)' }}>
                <span className={styles.dLabel} style={{ color: ORANGE_DEEP }}>the scene</span>
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#4a4754', fontSize: '0.92rem', margin: '0 0 0.8rem' }}>
                  events, plans and crews light up here once you’re on the Friend Line. it’s the low-pressure way in.
                </p>
                <Link href="/friends" style={{ display: 'inline-block', background: '#ff6a1f', color: '#fff', borderRadius: 999, padding: '0.55rem 1.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>explore the scene →</Link>
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.footCorp}>© {new Date().getFullYear()} notcupid · a lemon labs property</div>
      </footer>
    </main>
  );
}
