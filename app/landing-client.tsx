import Link from 'next/link'
import Wordmark from '@/components/wordmark'
import ConnectionSketch from '@/components/connection-sketch'
import styles from './page.module.css'

// Static introduction: no fabricated activity, client polling, or animation loop.
export default function LandingClient() {
  return <main className={styles.land}>
    <header className={styles.landTop}>
      <Wordmark size={1.7} />
      <nav aria-label="Main navigation" className={styles.landNav}>
        <Link href="/friend-line">Friendship</Link><Link href="/how-it-works">How it works</Link><Link href="/login">Log in ↗</Link>
      </nav>
    </header>
    <section className={styles.landHero}>
      <div className={styles.heroCopy}>
        <p className={styles.landEyebrow}>Your connection destination.</p>
        <h1 className={styles.landH1}>A place to find<br/><em>your people.</em></h1>
        <p className={styles.landLede}>Dating and friendship,<br/>with more in common.</p>
        <Link href="/quiz" className={styles.landAuthPrimary}>Start connecting <span aria-hidden>↗</span></Link>
        <div className={styles.lineLabels}><span>♡ Dating</span><span>☺ Friendship</span></div>
      </div>
      <div className={styles.heroArt}><ConnectionSketch /><span className={styles.sticker}>your people,<br/>your pace.</span></div>
    </section>
    <section className={styles.landBottom} aria-label="You choose how to connect">
      <h2>A little hello.<br/>A lot of possibility.</h2>
      <p>Find people, start conversations, and make plans.<br/>You choose who to meet.</p>
      <Link href="/how-it-works">See how it works ↗</Link>
    </section>
  </main>
}
