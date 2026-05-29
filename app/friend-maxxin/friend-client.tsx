'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './friend.module.css';

export default function FriendMaxxinClient({ authed, onWaitlist }: { authed: boolean; onWaitlist: boolean }) {
  const [joined, setJoined] = useState(onWaitlist);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({ x: 50, y: 35 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      setCoords({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function joinWaitlist() {
    if (busy || joined) return;
    if (!authed) {
      window.location.href = '/login?next=' + encodeURIComponent('/friend-maxxin');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/friend-waitlist', { method: 'POST' });
      if (res.ok) setJoined(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div
        className={styles.glow}
        style={{ background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(255,106,31,0.30) 0%, rgba(255,106,31,0.10) 30%, transparent 55%)` }}
        aria-hidden
      />
      <div className={styles.grain} aria-hidden />

      <header className={styles.top}>
        <Link href="/" className={styles.brand}>NOTCUPID<span className={styles.brandDot}>·</span></Link>
        {authed ? (
          <Link href="/hub" className={styles.back}>← back to hub</Link>
        ) : (
          <Link href="/login" className={styles.back}>log in →</Link>
        )}
      </header>

      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <span className={styles.dot} /> friend maxxin · coming soon
        </div>

        <h1 className={styles.h1}>
          a different<br/>
          <em>kind of match.</em>
        </h1>

        <p className={styles.lede}>
          we built notcupid because the dating apps got stale.<br/>
          turns out friendship in your 20s and 30s is harder than dating.<br/>
          <strong>so we're fixing that too.</strong>
        </p>

        <div className={styles.specs}>
          <div className={styles.spec}>
            <div className={styles.specN}>3–4</div>
            <div className={styles.specL}>platonic matches</div>
            <div className={styles.specD}>a real circle. not a swipe deck.</div>
          </div>
          <div className={styles.spec}>
            <div className={styles.specN}>1</div>
            <div className={styles.specL}>shared chat room</div>
            <div className={styles.specD}>your matches all in one thread. plan the night.</div>
          </div>
          <div className={styles.spec}>
            <div className={styles.specN}>∞</div>
            <div className={styles.specL}>activity prompts</div>
            <div className={styles.specD}>actual things to do in boston. trivia. shows. runs.</div>
          </div>
        </div>

        <div className={styles.ctaRow}>
          {joined ? (
            <div className={styles.joined}>
              ✓ you're on the waitlist. we'll email you when it goes live.
            </div>
          ) : (
            <button onClick={joinWaitlist} disabled={busy} className={styles.cta}>
              {busy ? 'joining…' : authed ? 'join the waitlist →' : 'log in to join the waitlist →'}
            </button>
          )}
        </div>
      </section>

      <footer className={styles.foot}>
        <div className={styles.footTop}>
          <span>two algos · one city</span>
          <span>·</span>
          <span>built in boston</span>
        </div>
        <div className={styles.footCorp}>
          © {new Date().getFullYear()} notcupid · a lemon labs property
        </div>
      </footer>
    </main>
  );
}
