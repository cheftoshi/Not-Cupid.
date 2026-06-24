'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import CorpFooter from '@/components/corp-footer';
import RaffleCard from '@/components/raffle-card';
import { compressImage } from '@/lib/compress-image';
import { ARCHETYPES, VIBE_HEADS, vibeLabel } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';
import { signLabel } from '@/lib/astrology';
import styles from './hub.module.css';

type Profile = {
  name: string; photo_url: string | null; archetype: string | null; age: number | null;
  attach_style?: string | null; vibes?: Record<string, number> | null; sun_sign?: string | null;
  music?: string[]; food?: string[]; hobbies?: string[]; sports?: string[];
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

type LoveMatch = {
  matchId: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; score: number | null; bothAccepted: boolean; iAccepted: boolean;
};

const BLUE = '#2563ff';
const BLUE_DEEP = 'var(--h-accent)';
const ORANGE_DEEP = 'var(--h-accent-2)';

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
  firstName, hasArchetype, needsLoveDeep, profile, city, loveMatches = [],
}: {
  firstName: string; onWaitlist: boolean; hasArchetype: boolean; needsLoveDeep?: boolean; profile: Profile;
  city?: string | null; loveMatches?: LoveMatch[];
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

  // interests as color-coded bubble clusters (each its own set + accent)
  const interestCats = [
    { head: 'music', emoji: '🎵', items: profile.music ?? [], bg: 'rgba(37,99,255,0.12)', fg: 'var(--c-music)', bd: 'rgba(37,99,255,0.3)' },
    { head: 'food & drink', emoji: '🍜', items: profile.food ?? [], bg: 'rgba(255,106,31,0.12)', fg: 'var(--c-food)', bd: 'rgba(255,106,31,0.3)' },
    { head: 'hobbies', emoji: '🎨', items: profile.hobbies ?? [], bg: 'rgba(123,60,255,0.14)', fg: 'var(--c-hobby)', bd: 'rgba(123,60,255,0.32)' },
    { head: 'sports & fitness', emoji: '⚽', items: profile.sports ?? [], bg: 'rgba(45,155,111,0.14)', fg: 'var(--c-sport)', bd: 'rgba(45,155,111,0.35)' },
  ].filter((c) => c.items.length > 0);
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
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '1.25rem', color: 'var(--h-text)' }}>
                {profile.name.split(' ')[0]}{profile.age ? <span style={{ fontWeight: 400, color: 'var(--h-text-dim)' }}>, {profile.age}</span> : null}
              </div>
              {meta
                ? <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.85rem', color: BLUE, marginTop: '0.15rem' }}>{profile.archetype}</div>
                : <Link href="/quiz?retake=1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>finish your quiz →</Link>}
              {profile.sun_sign && <div style={{ marginTop: '0.2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.06em', color: '#7a7590' }}>{signLabel(profile.sun_sign)}</div>}
              {city && <div style={{ marginTop: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', color: 'var(--h-text-dim)' }}>📍 {city}</div>}
              {msg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', color: msg.startsWith('✓') ? '#2d7a4f' : '#d2530f', marginTop: '0.4rem' }}>{msg}</div>}
            </div>

            {/* line choice — compact, on the side */}
            <div className={styles.dCard}>
              <span className={styles.dLabel}>your lines</span>
              <Link href={loveHref} style={{ display: 'block', background: '#2563ff', color: '#fff', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none', marginBottom: '0.4rem' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.03em' }}>💘 love line</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', opacity: 0.85, marginTop: '0.1rem' }}>{needsLoveDeep ? 'finish your love profile →' : 'pick your people →'}</div>
              </Link>
              <Link href="/friends" style={{ display: 'block', background: '#ff6a1f', color: '#fff', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', letterSpacing: '0.03em' }}>🧡 friend line</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', opacity: 0.9, marginTop: '0.1rem' }}>{city ? `all of ${city.split(',')[0]} · by neighborhood →` : 'crews · the scene →'}</div>
              </Link>
            </div>

            {/* quick nav */}
            <div className={styles.dCard} style={{ paddingTop: '0.4rem', paddingBottom: '0.4rem' }}>
              <Link href="/dashboard" style={railLink}><span>💘 your matches</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/profile" style={railLink}><span>✎ full profile</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/quiz?retake=1" style={railLink}><span>↻ retake quiz</span><span style={{ opacity: 0.5 }}>→</span></Link>
              <Link href="/pro" style={{ ...railLink, borderBottom: 'none', color: ORANGE_DEEP, fontWeight: 700 }}><span>✦ go pro</span><span style={{ opacity: 0.5 }}>→</span></Link>
            </div>
          </aside>

          {/* ── MAIN: what you're into + your activity ── */}
          <section className={styles.dashMain}>
            <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(1.5rem,4vw,2rem)', color: 'var(--h-text)', margin: '0 0 0.25rem' }}>
              hey {firstName.toLowerCase()}.
            </p>

            {/* SUMMER OF CONNECTION — the raffle pop-up (shows only for eligible cities) */}
            <RaffleCard />

            {/* YOUR CONNECTIONS — love + friend people, together in one place */}
            <div className={styles.dCard}>
              <span className={styles.dLabel}>your connections{(loveMatches.length + (friends?.length || 0)) ? ` · ${loveMatches.length + (friends?.length || 0)}` : ''}</span>

              {/* 💘 LOVE */}
              {hasArchetype && (
                <div style={{ marginBottom: friendOptedIn ? '1.1rem' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: BLUE_DEEP, fontWeight: 700 }}>💘 love{loveMatches.length ? ` · ${loveMatches.length}` : ''}</span>
                    <Link href="/dashboard" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>{loveMatches.length ? 'all →' : 'the roster →'}</Link>
                  </div>
                  {loveMatches.length === 0 ? (
                    <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.88rem', margin: 0 }}>
                      no live conversations — <Link href="/dashboard" style={{ color: BLUE_DEEP }}>pick from your roster →</Link>
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {loveMatches.map((m) => {
                        const status = m.bothAccepted ? 'chatting' : m.iAccepted ? 'waiting on them' : 'your move';
                        return (
                          <Link key={m.matchId} href={`/match/${m.matchId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', background: 'var(--h-surface-2)', border: '1.5px solid rgba(37,99,255,0.2)', borderRadius: 12, padding: '0.55rem 0.8rem', textDecoration: 'none' }}>
                            {m.photo_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={m.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              : <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8edff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: BLUE, fontSize: '0.95rem', flexShrink: 0 }}>{(m.name || '?').charAt(0)}</span>}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: 'var(--h-text)' }}>{(m.name || 'match').split(' ')[0]}{m.age ? `, ${m.age}` : ''}</div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: m.bothAccepted ? '#2d7a4f' : BLUE_DEEP }}>● {status}{m.score ? ` · ${m.score}%` : ''}</div>
                            </div>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: BLUE_DEEP, flexShrink: 0 }}>{m.bothAccepted ? 'open →' : 'say hi →'}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 🧡 FRIENDS */}
              {friendOptedIn ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>🧡 friends{friends && friends.length ? ` · ${friends.length}` : ''}</span>
                    {friends && friends.length > 0 && <Link href="/friends?view=crew" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>group chat →</Link>}
                  </div>
                  {friends === null ? (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)', margin: 0 }}>loading…</p>
                  ) : friends.length === 0 ? (
                    <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.88rem', margin: 0 }}>
                      no friends opened yet — <Link href="/friends/pack" style={{ color: ORANGE_DEEP }}>open your first pack 🎒 →</Link>
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                        {friends.slice(0, 12).map((f) => (
                          <Link key={f.otherId} href="/friends?view=crew" title={f.sharedActivities.length ? `both into ${f.sharedActivities.slice(0, 2).join(', ')}` : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'var(--h-surface-3)', border: '1px solid rgba(255,106,31,0.22)', borderRadius: 999, padding: '0.25rem 0.7rem 0.25rem 0.25rem', textDecoration: 'none' }}>
                            {f.photo_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={f.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                              : <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#ffe6c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontStyle: 'italic', color: ORANGE_DEEP, fontSize: '0.85rem' }}>{(f.name || '?').charAt(0)}</span>}
                            <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '0.9rem', color: 'var(--h-text)' }}>{(f.name || 'friend').split(' ')[0]}</span>
                            {f.connected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3f7d57' }} title="in your crew" />}
                          </Link>
                        ))}
                        {friends.length > 12 && <span style={{ alignSelf: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--h-text-faint)' }}>+{friends.length - 12} more</span>}
                      </div>
                      <Link href="/friends/pack" style={{ display: 'inline-block', marginTop: '0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, textDecoration: 'none' }}>🎒 open another pack →</Link>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ borderTop: hasArchetype ? '1px solid var(--h-border)' : 'none', paddingTop: hasArchetype ? '1rem' : 0 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>🧡 friends</span>
                  <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.88rem', margin: '0.4rem 0 0' }}>
                    make platonic ones too — <Link href="/friends" style={{ color: ORANGE_DEEP }}>join the Friend Line →</Link>
                  </p>
                </div>
              )}
            </div>

            {/* YOUR EVENTS (RSVP'd) */}
            <div className={styles.dCard}>
              <span className={styles.dLabel}>your events</span>
              {feed === null ? (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)', margin: 0 }}>loading…</p>
              ) : myEvents.length === 0 ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem', margin: 0 }}>
                  nothing on your calendar yet — <Link href="/friends?view=scene" style={{ color: ORANGE_DEEP }}>find something on the Scene →</Link>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {myEvents.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: 'var(--h-surface-3)', border: '1.5px solid rgba(255,106,31,0.25)', borderRadius: 12, padding: '0.7rem 0.9rem', textDecoration: 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: 'var(--h-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)' }}>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''}</div>
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
                        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1rem', color: 'var(--h-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: 'var(--h-text-dim)' }}>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''} · {a.responses.yes} going</div>
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

          {/* ── RIGHT ASIDE: what you're into — color-coded bubble sets per category ── */}
          <aside className={styles.dashAside}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 0.2rem' }}>
              <span className={styles.dLabel} style={{ marginBottom: 0 }}>what you’re into</span>
              <Link href="/profile" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>edit →</Link>
            </div>
            {interestCats.length === 0 && vibeTags.length === 0 ? (
              <div className={styles.dCard}>
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '0.9rem', margin: 0 }}>
                  add your music, food, hobbies &amp; sports on your <Link href="/profile" style={{ color: BLUE_DEEP }}>profile</Link> so matches see the real you.
                </p>
              </div>
            ) : (
              <>
                {interestCats.map((c) => (
                  <div key={c.head} className={styles.dCard} style={{ borderColor: c.bd, padding: '0.95rem 1.05rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
                      <span style={{ fontSize: '1rem' }}>{c.emoji}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: c.fg }}>{c.head}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {c.items.map((t, i) => (
                        <span key={`${t}-${i}`} style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 999, padding: '0.34rem 0.8rem', fontSize: '0.82rem', fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {vibeTags.length > 0 && (
                  <div className={styles.dCard} style={{ borderColor: 'rgba(255,45,142,0.28)', padding: '0.95rem 1.05rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
                      <span style={{ fontSize: '1rem' }}>✨</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--c-vibe)' }}>your vibe</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {vibeTags.map((v) => (
                        <span key={v.k} style={{ background: 'rgba(255,45,142,0.08)', color: 'var(--c-vibe)', border: '1px solid rgba(255,45,142,0.28)', borderRadius: 999, padding: '0.3rem 0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em' }}>{v.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

      <CorpFooter />
    </main>
  );
}
