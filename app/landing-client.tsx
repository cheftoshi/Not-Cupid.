'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Wordmark from '@/components/wordmark'
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
  if (stats.poolCount > 0) tickers.push({ k: 'in the pool · eastern mass + ri + nh', v: stats.poolCount.toLocaleString() })
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
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(37,99,255,0.22) 0%, rgba(255,106,31,0.10) 32%, transparent 62%)`,
        }}
        aria-hidden
      />
      <div className={styles.landGrain} aria-hidden />

      <header className={styles.landTop}>
        <Wordmark size={1.4} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link href="/friend-line" className={styles.landNavBtn}>friend line</Link>
          <Link href="/faq" className={styles.landNavBtn}>faq →</Link>
        </div>
      </header>

      <section className={styles.landHero}>
        <div className={styles.landEyebrow}>
          <span className={styles.landDot} />
          a connection experiment
        </div>

        <h1 className={styles.landH1}>
          Meet people.<br/>
          <em>Not profiles.</em>
        </h1>

        <p className={styles.landLede}>
          curated connections — for love and for friendship.<br/>
          real people, real conversations.
        </p>

        <div className={styles.landAuthRow}>
          <Link href="/quiz" className={styles.landAuthPrimary}>sign up →</Link>
          <Link href="/login" className={styles.landAuthGhost}>log in</Link>
        </div>

        <Link href="/how-it-works" className={styles.landLearn}>learn how it works ↓</Link>
      </section>
    </main>
  )
}
