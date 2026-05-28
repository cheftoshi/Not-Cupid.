'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

type Stats = {
  poolCount: number
  matchesThisWeek: number
  lastMatchAt: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'a moment ago'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function LandingClient({ stats }: { stats: Stats }) {
  const tickers: Array<{ k: string; v: string }> = []
  if (stats.poolCount > 0) tickers.push({ k: 'in the boston pool', v: stats.poolCount.toLocaleString() })
  if (stats.matchesThisWeek > 0) tickers.push({ k: 'mutual matches · last 7 days', v: stats.matchesThisWeek.toString() })
  if (stats.lastMatchAt) tickers.push({ k: 'last mutual match', v: relativeTime(stats.lastMatchAt) })
  if (tickers.length === 0) tickers.push({ k: 'cooking up the algo', v: '∞' })

  const [tickIdx, setTickIdx] = useState(0)
  useEffect(() => {
    if (tickers.length <= 1) return
    const id = setInterval(() => setTickIdx((i) => (i + 1) % tickers.length), 3800)
    return () => clearInterval(id)
  }, [tickers.length])

  const [coords, setCoords] = useState({ x: 50, y: 40 })
  useEffect(() => {
    function onMove(e: MouseEvent) {
      setCoords({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const t = tickers[tickIdx]

  return (
    <main className={styles.land}>
      <div
        className={styles.landGlow}
        style={{
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(139,127,212,0.24) 0%, rgba(216,179,64,0.10) 30%, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className={styles.landGrain} aria-hidden />

      <header className={styles.landTop}>
        <div className={styles.landBrand}>NOTCUPID<span className={styles.landBrandDot}>·</span></div>
        <a href="/login" className={styles.landNavBtn}>log in →</a>
      </header>

      <section className={styles.landHero}>
        <div className={styles.landEyebrow}>
          <span className={styles.landDot} />
          boston · ma · two algos
        </div>

        <h1 className={styles.landH1}>
          Boston’s<br/>
          <em>social experiment.</em>
        </h1>

        <p className={styles.landLede}>
          one algo for dates. one for friends.<br/>
          neither swipes.
        </p>

        <div className={styles.landProducts}>
          <Link href="/quiz" className={`${styles.landProd} ${styles.landProdLove}`}>
            <div className={styles.landProdEye}><span className={styles.landProdDotLive} /> live</div>
            <div className={styles.landProdName}>love <em>maxxin.</em></div>
            <div className={styles.landProdDesc}>one date match. boston only. personality first.</div>
            <div className={styles.landProdCta}>sign up →</div>
          </Link>
          <Link href="/friend-maxxin" className={`${styles.landProd} ${styles.landProdFriend}`}>
            <div className={styles.landProdEye}><span className={styles.landProdDotSoon} /> soon</div>
            <div className={styles.landProdName}>friend <em>maxxin.</em></div>
            <div className={styles.landProdDesc}>3–4 platonic matches. shared chat. activities.</div>
            <div className={styles.landProdCta}>read the pitch →</div>
          </Link>
        </div>

        <div className={styles.landTicker} aria-live="polite">
          <span key={`${tickIdx}-k`} className={styles.landTickK}>{t.k}</span>
          <span key={`${tickIdx}-v`} className={styles.landTickV}>{t.v}</span>
        </div>
      </section>

      <footer className={styles.landFoot}>
        <div className={styles.landFootTop}>
          <span>two algos · one city</span>
          <span>·</span>
          <span>built in boston</span>
        </div>
        <div className={styles.landFootCorp}>
          © {new Date().getFullYear()} notcupid · a lemon labs property
        </div>
      </footer>
    </main>
  )
}
