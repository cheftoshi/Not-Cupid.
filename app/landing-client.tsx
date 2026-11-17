import Link from 'next/link'
import PublicHeader from '@/components/public-header'
import styles from './page.module.css'

export default function LandingClient() {
  return <main className={styles.land}>
    <PublicHeader />
    <section className={styles.landHero}>
      <div className={styles.heroCopy}>
        <p className={styles.landEyebrow}>Dating · Friendship · Real-life plans</p>
        <h1 className={styles.landH1}>Matched on<br/>who you <em>are.</em></h1>
        <p className={styles.landLede}>Your personality, interests and preferences help shape who you meet. A little more in common. A better place to start.</p>
        <Link prefetch={false} href="/quiz" className={styles.landAuthPrimary}>Start connecting <span aria-hidden>↗</span></Link>
        <p className={styles.quizNote}>12 personality questions, then your interests and preferences. Go at your own pace. Optional paid extras are available.</p>
        <div className={styles.lineLabels}><span>Free quiz</span><span>No swiping</span><span>You choose</span></div>
      </div>
      <aside className={styles.preview} aria-label="Illustrative product previews">
        <p className={styles.previewLabel}>A look at the experience · examples</p>
        <article className={styles.typeCard}>
          <span className={styles.cardLabel}>A personality type</span>
          <p className={styles.previewTitle}>The Curious Realist</p>
          <p>A starting point for reflection, not a label that defines you.</p>
          <div className={styles.chips}><span>Personality</span><span>Shared interests</span></div>
        </article>
        <article className={styles.connectionCard}>
          <span className={styles.cardLabel}>A connection worth exploring</span>
          <p className={styles.previewTitle}>Start with something in common.</p>
          <p>Explore a profile, choose whether to connect, and start a conversation when the interest is mutual.</p>
          <span className={styles.exampleAction}>Your choice, every time ↗</span>
        </article>
      </aside>
    </section>
    <section className={styles.stepsSection} aria-labelledby="steps-heading">
      <p className={styles.sectionLabel}>From a little self-discovery to a real hello</p>
      <h2 id="steps-heading">Make room for your people.</h2>
      <ol className={styles.steps}>
        <li><span aria-hidden>1</span><div><h3>Tell us about you</h3><p>Start with questions inspired by the six HEXACO personality dimensions. Add what you enjoy and what you’re looking for.</p></div></li>
        <li><span aria-hidden>2</span><div><h3>Explore your connections</h3><p>Find dating introductions or discover friends and local plans. Your choices and mutual preferences guide the experience.</p></div></li>
        <li><span aria-hidden>3</span><div><h3>Choose your next move</h3><p>Say hello, join a member’s plan or start one of your own. Nothing gets sent, joined or booked on your behalf.</p></div></li>
      </ol>
      <Link prefetch={false} href="/how-it-works" className={styles.learnLink}>See how it works ↗</Link>
    </section>
  </main>
}
