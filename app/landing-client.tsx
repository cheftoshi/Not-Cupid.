'use client'

import { useEffect, useState } from 'react'
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
  // Rotating live-feel stat ticker.
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

  // Subtle cursor-reactive accent on hero — moves a soft lavender bloom.
  const [coords, setCoords] = useState({ x: 50, y: 40 })
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      setCoords({ x, y })
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
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(139,127,212,0.30) 0%, rgba(139,127,212,0.10) 25%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className={styles.landGrain} aria-hidden />

      <header className={styles.landTop}>
        <div className={styles.landBrand}>
          NOTCUPID<span className={styles.landBrandDot}>·</span>
        </div>
        <a href="/login" className={styles.landNavBtn}>log in →</a>
      </header>

      <section className={styles.landHero}>
        <div className={styles.landEyebrow}>
          <span className={styles.landDot} />
          boston · ma
        </div>

        <h1 className={styles.landH1}>
          Boston’s<br/>
          <em>date experiment.</em>
        </h1>

        <p className={styles.landLede}>
          one match. no swipes. no photos first.<br/>
          built on personality, not lighting.
        </p>

        <div className={styles.landCtaRow}>
          <a href="/quiz" className={styles.landBtnPri}>take the quiz →</a>
          <a href="/login" className={styles.landBtnGhost}>i have an account</a>
        </div>

        <div className={styles.landTicker} aria-live="polite">
          <span key={`${tickIdx}-k`} className={styles.landTickK}>{t.k}</span>
          <span key={`${tickIdx}-v`} className={styles.landTickV}>{t.v}</span>
        </div>
      </section>

      <footer className={styles.landFoot}>
        <span>made with cynicism in boston</span>
        <span>·</span>
        <span>the algo decides</span>
      </footer>
    </main>
  )
}
