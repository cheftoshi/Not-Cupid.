'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './hub.module.css';

export default function HubClient({
  firstName,
  onWaitlist,
  hasArchetype,
}: { firstName: string; onWaitlist: boolean; hasArchetype: boolean }) {
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

  const loveHref = hasArchetype ? '/profile' : '/quiz';

  return (
    <main className={styles.hub}>
      <div
        className={styles.glow}
        style={{
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(139,127,212,0.22) 0%, rgba(216,179,64,0.10) 35%, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className={styles.grain} aria-hidden />

      <header className={styles.top}>
        <div className={styles.brand}>NOTCUPID<span className={styles.brandDot}>·</span></div>
        <a href="/api/auth/logout" onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }} className={styles.logout}>log out</a>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>hi <em>{firstName.toLowerCase()}</em></p>
        <h1 className={styles.h1}>where to today?</h1>
        <p className={styles.lede}>two algorithms. one boston. pick a vibe.</p>
      </section>

      <section className={styles.grid}>
        {/* LOVE MAXXIN */}
        <Link href={loveHref} className={`${styles.card} ${styles.cardLove}`}>
          <div className={styles.cardEyebrow}><span className={styles.dotLive} />live</div>
          <h2 className={styles.cardH2}>love <em>maxxin.</em></h2>
          <p className={styles.cardDesc}>
            one date match. boston only. built on personality, not lighting.
            no swipes, no photos first.
          </p>
          <div className={styles.cardSpec}>
            <div><span className={styles.specK}>quiz</span><span className={styles.specV}>30 questions</span></div>
            <div><span className={styles.specK}>pool</span><span className={styles.specV}>boston · 75mi</span></div>
            <div><span className={styles.specK}>match</span><span className={styles.specV}>within 25mi</span></div>
            <div><span className={styles.specK}>style</span><span className={styles.specV}>one at a time</span></div>
          </div>
          <div className={styles.cardCta}>open love maxxin →</div>
        </Link>

        {/* FRIEND MAXXIN */}
        <div className={`${styles.card} ${styles.cardFriend}`}>
          <div className={styles.cardEyebrow}><span className={styles.dotSoon} />soon</div>
          <h2 className={styles.cardH2}>friend <em>maxxin.</em></h2>
          <p className={styles.cardDesc}>
            three to four platonic matches. shared interests, planned activities.
            a real circle, not a swipe deck.
          </p>
          <div className={styles.cardSpec}>
            <div><span className={styles.specK}>matches</span><span className={styles.specV}>3–4 max</span></div>
            <div><span className={styles.specK}>pool</span><span className={styles.specV}>shared chat</span></div>
            <div><span className={styles.specK}>style</span><span className={styles.specV}>activity-led</span></div>
          </div>
          {joined ? (
            <div className={styles.cardCtaJoined}>✓ you're on the waitlist</div>
          ) : (
            <button onClick={joinWaitlist} disabled={busy} className={styles.cardCtaFriend}>
              {busy ? 'joining…' : 'join the waitlist →'}
            </button>
          )}
          <Link href="/friend-maxxin" className={styles.cardSub}>read more about friend maxxin →</Link>
        </div>
      </section>

      <footer className={styles.foot}>
        <div className={styles.footTop}>
          <span>made with cynicism in boston</span><span>·</span><span>two algos. one city.</span>
        </div>
        <div className={styles.footCorp}>
          © {new Date().getFullYear()} notcupid · a lemon labs property
        </div>
      </footer>
    </main>
  );
}
