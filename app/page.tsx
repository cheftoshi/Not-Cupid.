import Nav from '@/components/Nav'
import styles from './page.module.css'

export default function Home() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={`${styles.eyebrow} eyebrow`}>Boston's smartest dating experiment</p>
          <h1 className={styles.h1}>
            Love is a <em>hypothesis.</em><br />Let's test it.
          </h1>
          <p className={styles.sub}>
            We're not Cupid. Cupid was <strong>reckless.</strong> We use actual behavioral science
            — wrapped in a quiz so good you'll forget it's a quiz.
          </p>
          <div className={styles.ctaGroup}>
            <a href="/quiz" className="btn-primary">Take the quiz →</a>
            <a href="#how" className="btn-ghost">How it works ↓</a>
          </div>
        </div>
        <div className={styles.scrollHint}>
          <span className={styles.scrollLabel}>Scroll</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* TICKER */}
      <div className={styles.ticker}>
        <div className={styles.tickerInner}>
          {[...Array(2)].map((_, r) => (
            <span key={r} className={styles.tickerTrack}>
              {['Not a swipe app','No bios, no photos first','Real behavioral science','Boston only, for now','One match at a time','The algorithm is watching','50 mile radius. Max.'].map(t => (
                <span key={t} className={styles.tickerItem}>
                  <span className={styles.tickerDot}>✦</span>{t}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className={styles.section} id="how">
        <div className={styles.sectionInner}>
          <p className="eyebrow" style={{marginBottom:'1rem'}}>01 — How it works</p>
          <h2 className={styles.h2}>Three steps.<br /><em>Zero swiping.</em></h2>
          <p className={styles.sectionSub}>
            This isn't a dating app. It's a matching experiment. Here's exactly what happens.
          </p>

          <div className={styles.howGrid}>
            {[
              { num: '01', title: 'Take the quiz', body: '24 questions. Funny on the surface, scientifically designed underneath. You\'ll think you\'re just having fun — and you are — but the algorithm is clocking everything.', tag: '~7 minutes' },
              { num: '02', title: 'The algorithm matches you', body: 'Six dimensions of your personality get scored and matched against someone compatible within 50 miles of Boston. No photos. No bios. Just data.', tag: 'Within 24 hours' },
              { num: '03', title: 'You get a text', body: 'One match. One Boston spot. A time to show up. Both of you get the same text. What happens next is up to you — but statistically, you should go.', tag: '617 / 857 number' },
              { num: '+', title: 'Unlock your profile', body: 'After the quiz, get a teaser of your personality profile. For $0.99 unlock the full breakdown — all 6 scores and exactly why you matched who you matched.', tag: 'Optional · $0.99' },
            ].map(c => (
              <div key={c.num} className={styles.howCard}>
                <div className={styles.stepNum}>{c.num}</div>
                <h3 className={styles.howTitle}>{c.title}</h3>
                <p className={styles.howBody}>{c.body}</p>
                <span className={styles.howTag}>{c.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUIZ PREVIEW */}
      <section className={styles.section} style={{paddingTop:0}}>
        <div className={styles.sectionInner}>
          <p className="eyebrow" style={{marginBottom:'1rem'}}>02 — See for yourself</p>
          <h2 className={styles.h2}>The quiz doesn't<br /><em>feel like science.</em></h2>
          <p className={styles.sectionSub}>That's intentional. Every answer secretly scores one of six personality dimensions.</p>

          <div className={styles.quizPreview}>
            <div className={styles.quizHeader}>
              <div className={`${styles.dot} ${styles.dotR}`} />
              <div className={`${styles.dot} ${styles.dotY}`} />
              <div className={`${styles.dot} ${styles.dotG}`} />
              <span className={styles.quizUrl}>notcupid.com/quiz · question 4 of 24</span>
            </div>
            <div className={styles.quizBody}>
              <p className={styles.qLabel}>Openness · Question 4</p>
              <p className={styles.qText}>A stranger sits next to you on the T. They're reading a book you love. What do you do?</p>
              <div className={styles.qOpts}>
                {['Say something. Life is short and they have good taste.','Mention it only if they make eye contact first.','Put my headphones in and silently bond from a distance.','Wrong. I don\'t take the T.'].map((o, i) => (
                  <div key={i} className={styles.qOpt}>
                    <span className={styles.qKey}>{String.fromCharCode(65+i)}</span>
                    <span>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MANIFESTO + STATS */}
      <section className={styles.manifestoSection}>
        <div className={styles.sectionInner}>
          <blockquote className={styles.quote}>
            "Dating apps turned people into products. NotCupid turns your personality into a proof of concept."
            <cite>— The Algorithm (probably)</cite>
          </blockquote>

          <div className={styles.statsGrid}>
            {[
              { num: '24', label: 'Questions asked' },
              { num: '6', label: 'Dimensions scored' },
              { num: '0', label: 'Swiping involved' },
              { num: '50mi', label: 'Boston radius' },
            ].map(s => (
              <div key={s.label} className={styles.statBox}>
                <div className={styles.statNum}>{s.num}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <p className="eyebrow" style={{marginBottom:'1rem'}}>03 — Your move</p>
          <h2 className={styles.h2}>Ready to find out<br />what the <em>data says?</em></h2>
          <p className={styles.ctaSub}>Takes 7 minutes. Free to take. $0.99 to unlock your full personality profile.</p>
          <a href="/quiz" className="btn-primary" style={{fontSize:'1rem',padding:'1.1rem 2.8rem'}}>
            Start the quiz →
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>Not<span>Cupid</span></div>
        <div className={styles.footerCopy}>Boston only · notcupid.com · 2025</div>
      </footer>
    </>
  )
}
