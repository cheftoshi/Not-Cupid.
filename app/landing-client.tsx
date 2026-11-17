import Link from 'next/link'
import PublicHeader from '@/components/public-header'
import ConnectionSketch from '@/components/connection-sketch'
import styles from './page.module.css'

// Static introduction: no fabricated activity, client polling, or animation loop.
export default function LandingClient() {
  return <main className={styles.land}>
    <PublicHeader />
    <section className={styles.landHero}>
      <div className={styles.heroCopy}>

        <h1 className={styles.landH1}>A place to find<br/><em>your people.</em></h1>
        <p className={styles.landLede}>Dating and friendship,<br/>with more in common.</p>
        <Link prefetch={false} href="/quiz" className={styles.landAuthPrimary}>Start connecting <span aria-hidden>↗</span></Link>
        <div className={styles.lineLabels}><span>♡ Dating</span><span>☺ Friendship</span></div>
      </div>
      <div className={styles.heroArt}><ConnectionSketch /></div>
    </section>
    <section className={styles.landBottom} aria-label="You choose how to connect">

      <p>Find people, start conversations, and make plans.{' '}<br/>You choose who to meet.</p>
      <Link prefetch={false} href="/how-it-works">See how it works ↗</Link>
    </section>
  </main>
}
