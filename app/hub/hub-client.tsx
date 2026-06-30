'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import RaffleCard from '@/components/raffle-card';
import { ConnectionSigil } from '@/components/connection-ui';
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
  const nextActions: Array<{
    key: string;
    tone: 'love' | 'friend' | 'profile';
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    href: string;
  }> = [];
  if (!hasArchetype) {
    nextActions.push({
      key: 'core-quiz',
      tone: 'profile',
      eyebrow: 'start here',
      title: 'finish your core quiz',
      body: 'The app needs your baseline before it can route you to people worth meeting.',
      cta: 'take the quiz',
      href: '/quiz',
    });
  } else if (needsLoveDeep) {
    nextActions.push({
      key: 'love-deep',
      tone: 'love',
      eyebrow: 'love line',
      title: 'finish your Love profile',
      body: 'Attachment, values and intent make the romantic matches feel less random.',
      cta: 'finish love setup',
      href: '/quiz?line=love',
    });
  }
  if (yourMoveLove[0]) {
    nextActions.push({
      key: 'love-move',
      tone: 'love',
      eyebrow: 'your move',
      title: `Say hi to ${(yourMoveLove[0].name || 'your match').split(' ')[0]}`,
      body: 'A small opener keeps the connection warm and gives them something real to answer.',
      cta: 'open match',
      href: `/match/${yourMoveLove[0].matchId}`,
    });
  }
  if (myEvents[0]) {
    nextActions.push({
      key: 'event',
      tone: 'friend',
      eyebrow: 'you have plans',
      title: myEvents[0].title,
      body: `${whenLabel(myEvents[0].happens_at)}${myEvents[0].area ? ` · ${myEvents[0].area}` : ''}`,
      cta: 'view on the Scene',
      href: '/friends?view=scene',
    });
  }
  if (forYourVibe[0]) {
    nextActions.push({
      key: 'vibe-event',
      tone: 'friend',
      eyebrow: 'low-pressure way in',
      title: forYourVibe[0].title,
      body: `${forYourVibe[0].responses.yes} going · ${whenLabel(forYourVibe[0].happens_at)}`,
      cta: 'rsvp',
      href: '/friends?view=scene',
    });
  }
  if (friendOptedIn && friends !== null && openedFriends.length === 0) {
    nextActions.push({
      key: 'open-pack',
      tone: 'friend',
      eyebrow: 'friend line',
      title: 'open your first friend pack',
      body: 'A curated batch gives you people to choose from without browsing strangers forever.',
      cta: 'open pack',
      href: '/friends/pack',
    });
  }
  if (!friendOptedIn) {
    nextActions.push({
      key: 'join-friend',
      tone: 'friend',
      eyebrow: 'friend line',
      title: 'make this about friendship too',
      body: 'Friend Line is the lower-pressure path into plans, crews and people around you.',
      cta: 'join friend line',
      href: '/friends',
    });
  }
  if (profilePercent < 80) {
    nextActions.push({
      key: 'profile',
      tone: 'profile',
      eyebrow: 'profile strength',
      title: 'make your profile easier to say yes to',
      body: 'Photos, interests and vibe tags give people a real starting point.',
      cta: 'tune profile',
      href: '/profile',
    });
  }
  if (nextActions.length === 0) {
    nextActions.push({
      key: 'start-something',
      tone: 'friend',
      eyebrow: 'today',
      title: 'start something small',
      body: 'Coffee, a walk, a show, a game. The best social apps help one person make the plan.',
      cta: 'post a plan',
      href: '/friends?view=scene',
    });
  }
  const heroAction = nextActions[0];

  return (
    <main className={styles.hub}>
      <div className={styles.glow} style={{ background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.20) 0%, rgba(255,106,31,0.08) 35%, transparent 60%)` }} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className={styles.dashWrap}>
        <section className={styles.homeHero}>
          <div className={styles.homeHeroCopy}>
            <div className={styles.homeSignal}>
              <ConnectionSigil tone="mixed" />
              <span className={styles.homeKicker}>today on notcupid</span>
            </div>
            <h1 className={styles.homeTitle}>hey {firstName.toLowerCase()}, who are we moving closer to?</h1>
            <p className={styles.homeLede}>
              A living connection field for love, friendship, plans and the small next step that turns strangers into people.
            </p>
          </div>
          <Link href={heroAction.href} className={`${styles.heroAction} ${styles[`heroAction${heroAction.tone}`]}`}>
            <span>{heroAction.eyebrow}</span>
            <strong>{heroAction.title}</strong>
            <em>{heroAction.cta} →</em>
          </Link>
        </section>

        <div className={styles.dashGrid}>
          <aside className={styles.dashRail}>
            <div className={`${styles.dCard} ${styles.identityCard}`}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatarFrame}>
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo} alt="" className={styles.avatarImg} />
                    : <div className={styles.avatarEmpty}>no photo</div>}
                </div>
                <label className={styles.avatarEdit} title="change photo">
                  {uploading ? '…' : '＋'}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
              <div className={styles.identityName}>
                {profile.name.split(' ')[0]}{profile.age ? <span style={{ fontWeight: 400, color: 'var(--h-text-dim)' }}>, {profile.age}</span> : null}
              </div>
              {meta
                ? <div className={styles.identityType}>{profile.archetype}</div>
                : <Link href="/quiz?retake=1" className={styles.identityLink}>finish your quiz →</Link>}
              {profile.sun_sign && <div className={styles.identityMeta}>{signLabel(profile.sun_sign)}</div>}
              {city && <div className={styles.identityMeta}>📍 {city}</div>}
              <div className={styles.profileMeter}>
                <div><span>profile strength</span><b>{profilePercent}%</b></div>
                <i><span style={{ width: `${profilePercent}%` }} /></i>
              </div>
              {msg && <div className={msg.startsWith('✓') ? styles.identityOk : styles.identityErr}>{msg}</div>}
            </div>

            <div className={styles.dCard}>
              <span className={styles.dLabel}>your lines</span>
              <Link href={loveHref} className={`${styles.lineCard} ${styles.lineLove}`}>
                <strong>💘 love line</strong>
                <span>{needsLoveDeep ? 'finish your love profile →' : loveMatches.length ? `${loveMatches.length} active →` : 'pick your people →'}</span>
              </Link>
              <Link href="/friends" className={`${styles.lineCard} ${styles.lineFriend}`}>
                <strong>🧡 friend line</strong>
                <span>{friendOptedIn ? (city ? `${city.split(',')[0]} plans →` : 'crews · the scene →') : 'join for friends →'}</span>
              </Link>
            </div>

            <div className={`${styles.dCard} ${styles.quickNav}`}>
              <Link href="/dashboard"><span>💘 love matches</span><b>→</b></Link>
              <Link href="/friends"><span>🧡 friend line</span><b>→</b></Link>
              <Link href="/profile"><span>✎ profile</span><b>→</b></Link>
              <Link href="/pro"><span>✦ all-access</span><b>→</b></Link>
            </div>
          </aside>

          <section className={styles.dashMain}>
            <div className={`${styles.dCard} ${styles.nextCard}`}>
              <div className={styles.sectionHead}>
                <span className={styles.dLabel}>next best actions</span>
                <Link href="/friends?view=scene">see the scene →</Link>
              </div>
              <div className={styles.actionGrid}>
                {nextActions.slice(0, 3).map((a) => (
                  <Link key={a.key} href={a.href} className={`${styles.actionCard} ${styles[`action${a.tone}`]}`}>
                    <span>{a.eyebrow}</span>
                    <strong>{a.title}</strong>
                    <p>{a.body}</p>
                    <em>{a.cta} →</em>
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.statStrip}>
              <Link href="/dashboard" className={styles.statTile}>
                <span>love</span>
                <strong>{loveMatches.length}</strong>
                <em>{chattingLove.length ? `${chattingLove.length} chatting` : yourMoveLove.length ? `${yourMoveLove.length} your move` : waitingLove.length ? `${waitingLove.length} waiting` : 'roster ready'}</em>
              </Link>
              <Link href="/friends?view=crew" className={styles.statTile}>
                <span>friends</span>
                <strong>{friends === null ? '…' : openedFriends.length}</strong>
                <em>{friendOptedIn ? 'opened connections' : 'not joined yet'}</em>
              </Link>
              <Link href="/friends?view=scene" className={styles.statTile}>
                <span>plans</span>
                <strong>{feed === null ? '…' : myEvents.length}</strong>
                <em>{myEvents.length ? 'on your calendar' : 'find one today'}</em>
              </Link>
            </div>

            <div className={styles.dCard}>
              <div className={styles.sectionHead}>
                <span className={styles.dLabel}>your people{(loveMatches.length + openedFriends.length) ? ` · ${loveMatches.length + openedFriends.length}` : ''}</span>
                <Link href="/dashboard">manage love →</Link>
              </div>
              {hasArchetype && (
                <div className={styles.peopleBlock}>
                  <div className={styles.miniHead}><span>💘 love{loveMatches.length ? ` · ${loveMatches.length}` : ''}</span><Link href="/dashboard">{loveMatches.length ? 'all →' : 'the roster →'}</Link></div>
                  {loveMatches.length === 0 ? (
                    <p className={styles.emptyCopy}>
                      no live conversations — <Link href="/dashboard" style={{ color: BLUE_DEEP }}>pick from your roster →</Link>
                    </p>
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
              )}

              {friendOptedIn ? (
                <div className={styles.peopleBlock}>
                  <div className={`${styles.miniHead} ${styles.miniHeadFriend}`}><span>🧡 friends{friends && friends.length ? ` · ${friends.length}` : ''}</span>{friends && friends.length > 0 && <Link href="/friends?view=crew">group chat →</Link>}</div>
                  {friends === null ? (
                    <p className={styles.loadingCopy}>loading…</p>
                  ) : friends.length === 0 ? (
                    <p className={styles.emptyCopy}>
                      no friends opened yet — <Link href="/friends/pack" style={{ color: ORANGE_DEEP }}>open your first pack 🎒 →</Link>
                    </p>
                  ) : (
                    <>
                      <div className={styles.friendChips}>
                        {friends.slice(0, 12).map((f) => (
                          <Link key={f.otherId} href="/friends?view=crew" title={f.sharedActivities.length ? `both into ${f.sharedActivities.slice(0, 2).join(', ')}` : undefined}
                          >
                            {f.photo_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={f.photo_url} alt="" />
                              : <i>{(f.name || '?').charAt(0)}</i>}
                            <span>{(f.name || 'friend').split(' ')[0]}</span>
                            {f.connected && <b title="in your crew" />}
                          </Link>
                        ))}
                        {friends.length > 12 && <span className={styles.moreChip}>+{friends.length - 12} more</span>}
                      </div>
                      <Link href="/friends/pack" className={styles.inlineCta}>🎒 open another pack →</Link>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.peopleBlock}>
                  <div className={`${styles.miniHead} ${styles.miniHeadFriend}`}><span>🧡 friends</span></div>
                  <p className={styles.emptyCopy}>
                    make platonic ones too — <Link href="/friends" style={{ color: ORANGE_DEEP }}>join the Friend Line →</Link>
                  </p>
                </div>
              )}
            </div>

            <div className={styles.dCard}>
              <div className={styles.sectionHead}>
                <span className={styles.dLabel}>your plans</span>
                <Link href="/friends?view=scene">browse plans →</Link>
              </div>
              {feed === null ? (
                <p className={styles.loadingCopy}>loading…</p>
              ) : myEvents.length === 0 ? (
                <p className={styles.emptyCopy}>
                  nothing on your calendar yet — <Link href="/friends?view=scene" style={{ color: ORANGE_DEEP }}>find something on the Scene →</Link>
                </p>
              ) : (
                <div className={styles.eventList}>
                  {myEvents.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" className={styles.eventRow}>
                      <div>
                        <strong>{a.title}</strong>
                        <em>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''}</em>
                      </div>
                      <span className={a.myResponse === 'yes' ? styles.statusGreen : styles.statusOrange}>{a.myResponse === 'yes' ? "you're in" : 'maybe'}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {feed !== null && forYourVibe.length > 0 && (
              <div className={styles.dCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.dLabel}>for your vibe</span>
                  <Link href="/friends?view=scene">all events →</Link>
                </div>
                <div className={styles.eventList}>
                  {forYourVibe.map((a) => (
                    <Link key={a.id} href="/friends?view=scene" className={styles.eventRow}>
                      <div>
                        <strong>{a.title}</strong>
                        <em>{whenLabel(a.happens_at)}{a.area ? ` · ${a.area}` : ''} · {a.responses.yes} going</em>
                      </div>
                      <span className={styles.statusBlue}>rsvp →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {feed !== null && likedPosts.length > 0 && (
              <div className={styles.dCard}>
                <span className={styles.dLabel}>you liked</span>
                <div className={styles.likedList}>
                  {likedPosts.map((a) => (
                    <Link key={a.id} href="/friends?view=scene">♥ {a.title}</Link>
                  ))}
                </div>
              </div>
            )}

            {feed !== null && myEvents.length === 0 && forYourVibe.length === 0 && likedPosts.length === 0 && (
              <div className={`${styles.dCard} ${styles.sceneNudge}`}>
                <span className={styles.dLabel} style={{ color: ORANGE_DEEP }}>the scene</span>
                <p>
                  events, plans and crews light up here once you’re on the Friend Line. it’s the low-pressure way in.
                </p>
                <Link href="/friends">explore the scene →</Link>
              </div>
            )}
          </section>

          <aside className={styles.dashAside}>
            <RaffleCard />
            <div className={styles.asideHead}>
              <span className={styles.dLabel} style={{ marginBottom: 0 }}>what you’re into</span>
              <Link href="/profile">edit →</Link>
            </div>
            {interestCats.length === 0 && vibeTags.length === 0 ? (
              <div className={styles.dCard}>
                <p className={styles.emptyCopy}>
                  add your music, food, hobbies &amp; sports on your <Link href="/profile" style={{ color: BLUE_DEEP }}>profile</Link> so matches see the real you.
                </p>
              </div>
            ) : (
              <>
                {interestCats.map((c) => (
                  <div key={c.head} className={styles.dCard} style={{ borderColor: c.bd }}>
                    <div className={styles.interestHead}>
                      <span>{c.emoji}</span>
                      <b style={{ color: c.fg }}>{c.head}</b>
                    </div>
                    <div className={styles.tagCloud}>
                      {c.items.map((t, i) => (
                        <span key={`${t}-${i}`} style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {vibeTags.length > 0 && (
                  <div className={styles.dCard} style={{ borderColor: 'rgba(255,45,142,0.28)' }}>
                    <div className={styles.interestHead}>
                      <span>✨</span>
                      <b style={{ color: 'var(--c-vibe)' }}>your vibe</b>
                    </div>
                    <div className={styles.tagCloud}>
                      {vibeTags.map((v) => (
                        <span key={v.k} style={{ background: 'rgba(255,45,142,0.08)', color: 'var(--c-vibe)', borderColor: 'rgba(255,45,142,0.28)' }}>{v.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

    </main>
  );
}
