'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/wordmark';
import styles from './hub.module.css';

export default function HubClient({
  firstName,
  onWaitlist,
  hasArchetype,
  needsLoveDeep,
}: { firstName: string; onWaitlist: boolean; hasArchetype: boolean; needsLoveDeep?: boolean }) {
  const [joined, setJoined] = useState(onWaitlist);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({ x: 50, y: 40 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      setCoords({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function joinWaitlist() {
    if (busy || joined) return;
    setBusy(true);
    try {
      const res = await fetch('/api/friend-waitlist', { method: 'POST' });
      if (res.ok) setJoined(true);
    } finally {
      setBusy(false);
    }
  }

  // No core quiz yet → /quiz. Core done but love-deep not → the deeper love
  // quiz. Fully set up → straight to the love profile.
  const loveHref = !hasArchetype ? '/quiz' : needsLoveDeep ? '/quiz?line=love' : '/profile';

  return (
    <main className={styles.hub}>
      <div
        className={styles.glow}
        style={{
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.22) 0%, rgba(255,106,31,0.10) 35%, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className={styles.grain} aria-hidden />

      <header className={styles.top}>
        <Wordmark size={1.25} href="/hub" />
        <a href="/api/auth/logout" onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }} className={styles.logout}>log out</a>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>🚉 now boarding · <em className={styles.eyebrowName}>{firstName.toLowerCase()}</em></p>
        <h1 className={styles.h1}>which line are you boarding today?</h1>
        <p className={styles.lede}>two lines. one boston. pick your platform.</p>
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

      <footer className={styles.foot}>
        <div className={styles.footTop}>
          <span>made with cynicism in boston</span><span>·</span><span>two lines. one city.</span>
        </div>
        <div className={styles.footCorp}>
          © {new Date().getFullYear()} notcupid · a lemon labs property
        </div>
      </footer>
    </main>
  );
}
