import Nav from '@/components/Nav'
import styles from './page.module.css'

export default function Home() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBgNum}>01</div>
        <div className={styles.heroTag}>Boston's smartest dating experiment</div>
        <div className={styles.heroTitleWrap}>
          <div className={styles.heroH1Big}>NO SWIPES.</div>
          <div className={styles.heroH1Italic}>one match.</div>
        </div>
        <div className={styles.heroBottom}>
          <div className={styles.heroSub}>
            <span className={styles.heroSubMain}>the algo doesn't swipe. it decides.</span>
            <span className={styles.heroSubNote}>24 questions. six dimensions. one compatible person in Boston. no photos first.</span>
          </div>
          <div className={styles.heroBtns}>
            <a href="/quiz" className={styles.btnPri}>Take the quiz →</a>
            <a href="#how" className={styles.btnGhost}>How it works</a>
          </div>
          <div style={{ marginTop: '0.875rem', fontSize: '0.8125rem', color: '#6b6975', fontStyle: 'italic', fontFamily: 'Georgia, ui-serif, serif' }}>
            already signed up? <a href="/login" style={{ color: '#0a0a0a', fontStyle: 'normal', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 600 }}>log in →</a>
          </div>
          <div className={styles.heroStatAside}>
            <div className={styles.asideNum}>24</div>
            <div className={styles.asideLabel}>Questions · 7 minutes</div>
            <div className={styles.asideNum} style={{marginTop:'1.25rem'}}>6</div>
            <div className={styles.asideLabel}>Dimensions scored</div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className={styles.ticker}>
        <div className={styles.tickerInner}>
          {[...Array(2)].map((_, r) => (
            <span key={r} className={styles.tickerTrack}>
              {['NOT A SWIPE APP','BOSTON ONLY','ONE MATCH AT A TIME','NO BIOS FIRST','THE ALGORITHM DECIDES','50 MILE RADIUS'].map(t => (
                <span key={t} className={styles.tickerItem}><span className={styles.tickerDot}>✦</span>{t}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className={styles.rules} id="how">
        <div className={styles.rulesLabelCol}>
          <span className={styles.rulesLabelText}>How it works</span>
        </div>
        {[
          ['01','Take the quiz','24 questions. Funny on the surface. The algorithm is clocking everything underneath.'],
          ['02','We match you','Six personality dimensions. One compatible person in Boston. No photos first.'],
          ['03','You get an email','One match. One spot in the city. Both of you get the same message.'],
          ['04','Show up','Or don\'t. But statistically, you probably should. The data doesn\'t lie.'],
        ].map(([num, title, body]) => (
          <div key={num} className={styles.ruleBox}>
            <div className={styles.ruleNum}>{num}</div>
            <div className={styles.ruleTitle}>{title}</div>
            <p className={styles.ruleBody}>{body}</p>
          </div>
        ))}
      </div>

      {/* QUIZ PREVIEW + MANIFESTO */}
      <div className={styles.mid}>
        <div className={styles.quizCol}>
          <div className={styles.quizHeader}>
            <span className={styles.quizHeaderTitle}>Try a question</span>
            <span className={styles.quizHeaderMeta}>Openness · 4 of 24</span>
          </div>
          <div className={styles.quizBody}>
            <div className={styles.quizQ}>A stranger on the T is reading a book you love. You:</div>
            <div className={styles.quizOpts}>
              {['Say something. Life is short.','Mention it if they make eye contact.','Silently bond from a distance.',"Wrong. I don't take the T."].map((o, i) => (
                <div key={i} className={`${styles.quizOpt} ${i === 0 ? styles.quizOptSel : ''}`}>
                  <span className={styles.quizKey}>{String.fromCharCode(65+i)}</span>{o}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.manifestoCol}>
          <blockquote className={styles.manifestoQuote}>
            "Dating apps turned people into products. NotCupid turns your personality into a proof of concept."
            <span>— The Algorithm, probably</span>
          </blockquote>
          <div className={styles.profileBlock}>
            <div className={styles.profileTop}>
              <div className={styles.profileName}>THE CURIOUS <em>REALIST</em></div>
              <div className={styles.profileLock}>🔒 $0.99 to unlock</div>
            </div>
            <div className={styles.dims}>
              {[['Honesty','78%',78],['Openness','91%',91]].map(([n,v,w]) => (
                <div key={n as string} className={styles.dimRow}>
                  <span className={styles.dimName}>{n}</span>
                  <div className={styles.dimBar}><div className={styles.dimFill} style={{width:`${w}%`}} /></div>
                  <span className={styles.dimVal}>{v}</span>
                </div>
              ))}
              {['Emotionality','Extraversion','Agreeableness','Conscientiousness'].map(n => (
                <div key={n} className={styles.dimRow} style={{filter:'blur(3.5px)'}}>
                  <span className={styles.dimName}>{n}</span>
                  <div className={styles.dimBar}><div className={styles.dimFill} style={{width:'60%'}} /></div>
                  <span className={styles.dimVal}>??</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <div>
          <div className={styles.ctaEyebrow}>Your move</div>
          <div className={styles.ctaH2}>READY TO FIND OUT<br/>WHAT THE <em>data says?</em></div>
          <div className={styles.ctaNote}>7 minutes · Free to take · $0.99 to unlock full profile</div>
        </div>
        <div className={styles.ctaRight}>
          <a href="/quiz" className={styles.btnPri}>Start the quiz →</a>
          <a href="#how" className={styles.btnGhost}>See how it works</a>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b6975', fontStyle: 'italic', fontFamily: 'Georgia, ui-serif, serif', textAlign: 'center' }}>
            been here before? <a href="/login" style={{ color: '#0a0a0a', fontStyle: 'normal', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 600 }}>log in →</a>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>NOT<span>CUPID</span></div>
        <div className={styles.footerCopy}>
          Boston only · notcupid.com · 2025
          <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
          <a href="/login" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}>log in</a>
        </div>
      </footer>
    </>
  )
}
