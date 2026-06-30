'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import RaffleCard from '@/components/raffle-card';
import { compressImage } from '@/lib/compress-image';
import { VIBE_HEADS, vibeLabel } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';
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
  const forYourVibe = (feed ?? []).filter((a) => a.kind === 'event' && a.eligible && !a.iRsvped && upcoming(a)).slice(0, 5);

  const openedFriends = friends ?? [];
  const chattingLove = loveMatches.filter((m) => m.bothAccepted);
  const yourMoveLove = loveMatches.filter((m) => !m.iAccepted);
  const waitingLove = loveMatches.filter((m) => m.iAccepted && !m.bothAccepted);
  const interestCount = interestCats.reduce((sum, c) => sum + c.items.length, 0);
  const profileChecks = [
    !!photo,
    hasArchetype,
    !needsLoveDeep,
    interestCount >= 3,
    vibeTags.length >= 3,
  ];
  const profilePercent = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);

  return (
    <main className={styles.hub}>
      <div className={styles.glow} style={{ background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.20) 0%, rgba(255,106,31,0.08) 35%, transparent 60%)` }} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className={styles.dashWrap}>
        <section className={styles.hubTop}>
          <Link href="/profile" className={styles.profileMini}>
            <div className={styles.profileMiniTop}>
              <div className={styles.profileMiniAvatar}>
                {photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photo} alt="" />
                  : <span>{profile.name?.charAt(0) || '?'}</span>}
                <label className={styles.profileMiniEdit} title="change photo" onClick={(e) => e.preventDefault()}>
                  {uploading ? '…' : '＋'}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
              <div className={styles.profileMiniBody}>
                <span>your notcupid baseline</span>
                <strong>{profile.name.split(' ')[0]}{profile.age ? `, ${profile.age}` : ''}</strong>
                <em>{profile.archetype || 'core profile'}{city ? ` · ${city.split(',')[0]}` : ''}</em>
              </div>
            </div>

            <div className={styles.profileMiniMeter}>
              <span>{profilePercent}% profile strength</span>
              <i><b style={{ width: `${profilePercent}%` }} /></i>
              {msg && <em>{msg}</em>}
            </div>

            <div className={styles.profileMiniTags}>
              {[...(profile.music ?? []), ...(profile.food ?? []), ...(profile.hobbies ?? []), ...(profile.sports ?? [])].slice(0, 8).map((t, i) => (
                <span key={`${t}-${i}`}>{t}</span>
              ))}
              {vibeTags.slice(0, 3).map((v) => <span key={v.k}>{v.label}</span>)}
              {interestCount === 0 && vibeTags.length === 0 && <span>add interests</span>}
            </div>

            {interestCats.length > 0 && (
              <div className={styles.profileInterestGroups}>
                {interestCats.slice(0, 3).map((c) => (
                  <div key={c.head}>
                    <b style={{ color: c.fg }}>{c.emoji} {c.head}</b>
                    <span>{c.items.slice(0, 3).join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.profileMiniCta}>edit baseline profile →</div>
          </Link>

          <div className={styles.todayCard}>
            <div className={styles.todayHead}>
              <div>
                <span className={styles.homeKicker}>notcupid · a connection experiment</span>
                <h1 className={styles.homeTitle}>what’s alive today.</h1>
                <p className={styles.todayCopy}>530+ people are already in the experiment. Today is about turning that pool into real movement.</p>
              </div>
            </div>
            <div className={styles.todayGrid}>
              <RaffleCard />
              <div className={styles.todayBrand}>
                <span>meet people. not profiles.</span>
                <strong>Love, friendship, plans, and the follow-through.</strong>
                <Link href="/how-it-works">how it works →</Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.connectionBoard}>
          <div className={`${styles.linePanel} ${styles.lovePanel}`}>
            <div className={styles.linePanelHead}>
              <div>
                <span className={styles.dLabel}>love line</span>
                <h2>dates, chemistry, the real follow-through.</h2>
              </div>
              <Link href="/dashboard" className={styles.linePanelCount}>
                <strong>{loveMatches.length}</strong>
                <span>{chattingLove.length ? 'chatting' : yourMoveLove.length ? 'your move' : waitingLove.length ? 'waiting' : 'roster'}</span>
              </Link>
            </div>

            {!hasArchetype ? (
              <Link href="/quiz" className={styles.lineNext}>
                <span>start here</span>
                <strong>finish your core quiz</strong>
                <em>take the quiz →</em>
              </Link>
            ) : needsLoveDeep ? (
              <Link href="/quiz?line=love" className={styles.lineNext}>
                <span>love setup</span>
                <strong>finish your Love profile</strong>
                <em>finish setup →</em>
              </Link>
            ) : yourMoveLove[0] ? (
              <Link href={`/match/${yourMoveLove[0].matchId}`} className={styles.lineNext}>
                <span>your move</span>
                <strong>Say hi to {(yourMoveLove[0].name || 'your match').split(' ')[0]}</strong>
                <em>open match →</em>
              </Link>
            ) : chattingLove[0] ? (
              <Link href={`/match/${chattingLove[0].matchId}`} className={styles.lineNext}>
                <span>keep it warm</span>
                <strong>Reply to {(chattingLove[0].name || 'your match').split(' ')[0]}</strong>
                <em>open chat →</em>
              </Link>
            ) : (
              <Link href="/dashboard" className={styles.lineNext}>
                <span>roster ready</span>
                <strong>Pick someone worth starting with.</strong>
                <em>see roster →</em>
              </Link>
            )}

            {loveMatches.length === 0 ? (
              <p className={styles.emptyCopy}>No live love conversations right now. Your roster is where the next one starts.</p>
            ) : (
              <div className={styles.personList}>
                {loveMatches.map((m) => {
                  const status = m.bothAccepted ? 'chatting' : m.iAccepted ? 'waiting on them' : 'your move';
                  return (
                    <Link key={m.matchId} href={`/match/${m.matchId}`} className={styles.personRow}>
                      {m.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.photo_url} alt="" />
                        : <span>{(m.name || '?').charAt(0)}</span>}
                      <div>
                        <strong>{(m.name || 'match').split(' ')[0]}{m.age ? `, ${m.age}` : ''}</strong>
                        <em className={m.bothAccepted ? styles.statusGreen : styles.statusBlue}>● {status}{m.score ? ` · ${m.score}%` : ''}</em>
                      </div>
                      <b>{m.bothAccepted ? 'open →' : 'say hi →'}</b>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${styles.linePanel} ${styles.friendPanel}`}>
            <div className={styles.linePanelHead}>
              <div>
                <span className={styles.dLabel}>friend line</span>
                <h2>people, crews, and plans around you.</h2>
              </div>
              <Link href="/friends" className={styles.linePanelCount}>
                <strong>{friends === null ? '…' : openedFriends.length + myEvents.length}</strong>
                <span>{myEvents.length ? 'plans' : friendOptedIn ? 'people' : 'join'}</span>
              </Link>
            </div>

            {!friendOptedIn ? (
              <Link href="/friends" className={styles.lineNext}>
                <span>friend line</span>
                <strong>Make this about friendship too.</strong>
                <em>join friend line →</em>
              </Link>
            ) : myEvents[0] ? (
              <Link href="/friends?view=scene" className={styles.lineNext}>
                <span>you have plans</span>
                <strong>{myEvents[0].title}</strong>
                <em>{whenLabel(myEvents[0].happens_at)} →</em>
              </Link>
            ) : forYourVibe[0] ? (
              <Link href="/friends?view=scene" className={styles.lineNext}>
                <span>low-pressure way in</span>
                <strong>{forYourVibe[0].title}</strong>
                <em>rsvp →</em>
              </Link>
            ) : friends !== null && openedFriends.length === 0 ? (
              <Link href="/friends/pack" className={styles.lineNext}>
                <span>first pack</span>
                <strong>Open your first friend pack.</strong>
                <em>open pack →</em>
              </Link>
            ) : (
              <Link href="/friends?view=scene" className={styles.lineNext}>
                <span>today</span>
                <strong>Start something small.</strong>
                <em>post a plan →</em>
              </Link>
            )}

            <div className={styles.friendGrid}>
              <div>
                <div className={`${styles.miniHead} ${styles.miniHeadFriend}`}><span>people{friends && friends.length ? ` · ${friends.length}` : ''}</span>{friends && friends.length > 0 && <Link href="/friends?view=crew">chat →</Link>}</div>
                {!friendOptedIn ? (
                  <p className={styles.emptyCopy}>Friend Line is where platonic matches, crews and plans live.</p>
                ) : friends === null ? (
                  <p className={styles.loadingCopy}>loading…</p>
                ) : friends.length === 0 ? (
                  <p className={styles.emptyCopy}>No friends opened yet. <Link href="/friends/pack" style={{ color: ORANGE_DEEP }}>Open a pack →</Link></p>
                ) : (
                  <div className={styles.friendChips}>
                    {friends.slice(0, 10).map((f) => (
                      <Link key={f.otherId} href="/friends?view=crew" title={f.sharedActivities.length ? `both into ${f.sharedActivities.slice(0, 2).join(', ')}` : undefined}>
                        {f.photo_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={f.photo_url} alt="" />
                          : <i>{(f.name || '?').charAt(0)}</i>}
                        <span>{(f.name || 'friend').split(' ')[0]}</span>
                        {f.connected && <b title="in your crew" />}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className={`${styles.miniHead} ${styles.miniHeadFriend}`}><span>plans{myEvents.length ? ` · ${myEvents.length}` : ''}</span><Link href="/friends?view=scene">scene →</Link></div>
                {feed === null ? (
                  <p className={styles.loadingCopy}>loading…</p>
                ) : myEvents.length > 0 ? (
                  <div className={styles.eventList}>
                    {myEvents.slice(0, 3).map((a) => (
                      <Link key={a.id} href="/friends?view=scene" className={styles.eventRow}>
                        <div>
                          <strong>{a.title}</strong>
                          <em>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''}</em>
                        </div>
                        <span className={a.myResponse === 'yes' ? styles.statusGreen : styles.statusOrange}>{a.myResponse === 'yes' ? "you're in" : 'maybe'}</span>
                      </Link>
                    ))}
                  </div>
                ) : forYourVibe.length > 0 ? (
                  <div className={styles.eventList}>
                    {forYourVibe.slice(0, 3).map((a) => (
                      <Link key={a.id} href="/friends?view=scene" className={styles.eventRow}>
                        <div>
                          <strong>{a.title}</strong>
                          <em>{whenLabel(a.happens_at)} · {a.responses.yes} going</em>
                        </div>
                        <span className={styles.statusOrange}>rsvp →</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyCopy}>No plans yet. <Link href="/friends?view=scene" style={{ color: ORANGE_DEEP }}>Start one →</Link></p>
                )}
              </div>
            </div>
          </div>
        </section>

      </div>

    </main>
  );
}
