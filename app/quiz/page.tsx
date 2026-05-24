'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import {
  QUESTIONS, DIMS, DIM_SHORT, validateZip,
  computeScores, pickArchetype, LOADING_STEPS
} from '@/lib/quiz-data'
import styles from './quiz.module.css'

type Screen = 'intro' | 'quiz' | 'loading' | 'result'

interface FormData {
  name: string
  age: string
  gender: string
  seek: string
  zip: string
  phone: string
}

export default function QuizPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('intro')
  const [form, setForm] = useState<FormData>({ name:'', age:'', gender:'', seek:'', zip:'', phone:'' })
  const [zipStatus, setZipStatus] = useState<'idle'|'valid'|'invalid'|'outofrange'>('idle')
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedOpt, setSelectedOpt] = useState<number|null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingPct, setLoadingPct] = useState(0)
  const [archetype, setArchetype] = useState<ReturnType<typeof pickArchetype>|null>(null)
  const [scores, setScores] = useState<Record<string,number>>({})
  const [barsVisible, setBarsVisible] = useState(false)

  const formValid =
    form.name.trim() &&
    parseInt(form.age) >= 18 &&
    form.gender &&
    form.seek &&
    form.phone.trim() &&
    zipStatus === 'valid'

  function handleZip(z: string) {
    setForm(f => ({...f, zip: z}))
    if (z.length < 5) { setZipStatus('idle'); return }
    const result = validateZip(z)
    setZipStatus(result === 'incomplete' ? 'idle' : result as any)
  }

  function startQuiz() {
    if (!formValid) return
    setCurrentQ(0)
    setAnswers([])
    setSelectedOpt(null)
    setScreen('quiz')
  }

  function selectOpt(idx: number) {
    setSelectedOpt(idx)
  }

  const advance = useCallback((ans: number) => {
    const newAnswers = [...answers, ans]
    setAnswers(newAnswers)
    setSelectedOpt(null)
    if (currentQ + 1 >= QUESTIONS.length) {
      const finalScores = computeScores(newAnswers)
      const arch = pickArchetype(finalScores)
      setScores(finalScores)
      setArchetype(arch)
      setScreen('loading')
      setLoadingStep(0)
      setLoadingPct(0)
    } else {
      setCurrentQ(q => q + 1)
    }
  }, [answers, currentQ])

  function nextQ() {
    if (selectedOpt === null) return
    advance(selectedOpt)
  }

  function skipQ() {
    advance(-1)
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (screen !== 'quiz') return
    function onKey(e: KeyboardEvent) {
      const map: Record<string, number> = { a:0, b:1, c:2, d:3 }
      if (map[e.key.toLowerCase()] !== undefined) {
        selectOpt(map[e.key.toLowerCase()])
      }
      if (e.key === 'Enter' && selectedOpt !== null) nextQ()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, selectedOpt, nextQ])

  // Loading sequence
  useEffect(() => {
    if (screen !== 'loading') return
    let step = 0
    const interval = setInterval(() => {
      step++
      setLoadingStep(step)
      setLoadingPct(Math.min(Math.round((step / LOADING_STEPS.length) * 100), 100))
      if (step >= LOADING_STEPS.length) {
        clearInterval(interval)
        setTimeout(() => {
          setScreen('result')
          setTimeout(() => setBarsVisible(true), 400)
        }, 600)
      }
    }, 700)
    return () => clearInterval(interval)
  }, [screen])

  const q = QUESTIONS[currentQ]
  const progress = ((currentQ) / QUESTIONS.length) * 100
  const MAX_SCORE = 16

  return (
    <>
      <Nav />

      {/* INTRO */}
      {screen === 'intro' && (
        <div className={styles.screen}>
          <div className={styles.introWrap}>
            <p className="eyebrow" style={{marginBottom:'1.5rem'}}>Boston's smartest dating experiment</p>
            <h1 className={styles.introH1}>The quiz that actually<br /><em>knows you.</em></h1>
            <p className={styles.introSub}>
              24 questions. Funny on the surface, scientific underneath. We'll match you with one
              person in Boston whose personality is genuinely compatible with yours.
            </p>

            <div className={styles.rules}>
              {[
                ['01', 'No photos yet.', 'Your personality goes first. You\'ll see who you matched after both of you say yes.'],
                ['02', 'One match at a time.', 'The algorithm picks one person. You get a text. That\'s it.'],
                ['03', 'Boston only.', 'We match within 50 miles of 02116. You\'ll actually be able to meet.'],
                ['04', 'Takes 7 minutes.', 'Answer honestly. The algorithm can tell when you\'re performing.'],
              ].map(([num, bold, rest]) => (
                <div key={num} className={styles.rule}>
                  <span className={styles.ruleNum}>{num}</span>
                  <span className={styles.ruleText}><strong>{bold}</strong> {rest}</span>
                </div>
              ))}
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input className={styles.input} placeholder="Your name" value={form.name}
                  onChange={e => setForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Age</label>
                <input className={styles.input} type="number" placeholder="25" min={18} max={99}
                  value={form.age} onChange={e => setForm(f=>({...f,age:e.target.value}))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>I am a</label>
                <select className={styles.input} value={form.gender}
                  onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
                  <option value="">Select</option>
                  <option value="m">Man</option>
                  <option value="f">Woman</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Looking for</label>
                <select className={styles.input} value={form.seek}
                  onChange={e => setForm(f=>({...f,seek:e.target.value}))}>
                  <option value="">Select</option>
                  <option value="f">Women</option>
                  <option value="m">Men</option>
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Zip code</label>
                <div className={styles.zipWrap}>
                  <input className={styles.input} placeholder="02116" maxLength={5}
                    value={form.zip} onChange={e => handleZip(e.target.value)} />
                  {zipStatus === 'valid' && <span className={styles.zipOk}>✓ You're in</span>}
                  {zipStatus === 'outofrange' && <span className={styles.zipBad}>Outside 50mi radius</span>}
                  {zipStatus === 'invalid' && <span className={styles.zipBad}>Not in our area yet</span>}
                </div>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Phone number (for your match text)</label>
                <input className={styles.input} type="tel" placeholder="617-555-0100"
                  value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
              </div>
            </div>

            <button className="btn-primary" onClick={startQuiz} disabled={!formValid}
              style={{fontSize:'1rem',padding:'1rem 2.4rem'}}>
              Begin the experiment →
            </button>
          </div>
        </div>
      )}

      {/* QUIZ */}
      {screen === 'quiz' && q && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qCount}>{currentQ + 1} of {QUESTIONS.length}</div>
            </div>

            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{width:`${progress}%`}} />
            </div>

            <div className={styles.dimBadge}>
              <div className={styles.dimDot} />
              <span>{q.short}</span>
            </div>

            <p className={styles.qText}>{q.q}</p>

            <div className={styles.qOptions}>
              {q.opts.map((opt, i) => (
                <button
                  key={i}
                  className={`${styles.qOpt} ${selectedOpt === i ? styles.qOptSelected : ''}`}
                  onClick={() => selectOpt(i)}
                >
                  <span className={styles.qKey}>{String.fromCharCode(65+i)}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>

            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipQ}>Skip →</button>
              <button className="btn-primary" onClick={nextQ} disabled={selectedOpt === null}>
                {currentQ + 1 === QUESTIONS.length ? 'Finish →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING */}
      {screen === 'loading' && (
        <div className={styles.screen}>
          <div className={styles.loadingWrap}>
            <h2 className={styles.loadingH2}>The algorithm<br />is <em>thinking.</em></h2>
            <p className={styles.loadingSub}>
              Crunching 24 answers across 6 personality dimensions. Cross-referencing the Boston
              dating pool. Being very serious about this.
            </p>
            <div className={styles.loadingBarWrap}>
              <div className={styles.loadingBar} style={{width:`${loadingPct}%`}} />
            </div>
            <p className={styles.loadingStatus}>{LOADING_STEPS[Math.min(loadingStep, LOADING_STEPS.length-1)]}</p>
          </div>
        </div>
      )}

      {/* RESULT */}
      {screen === 'result' && archetype && (
        <div className={styles.screen}>
          <div className={styles.resultWrap}>
            <p className="eyebrow" style={{marginBottom:'1.25rem'}}>Your personality profile</p>
            <h1 className={styles.resultH1}>You're a <em>{archetype.name}.</em></h1>
            <p className={styles.resultTag}>{archetype.tag}</p>
            <p className={styles.resultDesc}>{archetype.desc}</p>

            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <span className={styles.profileTitle}>Your HEXACO profile</span>
                <span className={styles.profileLock}>🔒 Unlock for $0.99</span>
              </div>
              <div className={styles.dimRows}>
                {DIMS.map((dim, i) => {
                  const pct = Math.round(((scores[dim] ?? 0) / MAX_SCORE) * 100)
                  const blurred = i > 1
                  return (
                    <div key={dim} className={`${styles.dimRow} ${blurred ? styles.blurred : ''}`}>
                      <span className={styles.dimName}>{DIM_SHORT[dim]}</span>
                      <div className={styles.dimBarBg}>
                        <div
                          className={styles.dimBarFill}
                          style={{width: barsVisible && !blurred ? `${pct}%` : '0%'}}
                        />
                      </div>
                      <span className={styles.dimScore}>{blurred ? '??' : `${pct}%`}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.matchCard}>
              <div className={styles.matchIcon}>👀</div>
              <div>
                <p className={styles.matchTitle}>The algorithm is watching.</p>
                <p className={styles.matchDesc}>
                  You're in the Boston pool. The moment someone compatible shows up — or if they're
                  already here — you'll get a text. One match. One spot in the city. Show up.
                </p>
              </div>
            </div>

            <div className={styles.unlockCard}>
              <div className={styles.unlockPrice}>$0.99</div>
              <p className={styles.unlockLabel}>
                Unlock your full personality breakdown — all 6 scores, what they mean, and exactly
                why you'll match who you match.
              </p>
              <button className="btn-primary">Unlock my profile →</button>
            </div>

            <button className="btn-ghost" onClick={() => { setScreen('intro'); setAnswers([]); setCurrentQ(0) }}
              style={{marginTop:'1rem'}}>
              Retake the quiz
            </button>
          </div>
        </div>
      )}
    </>
  )
}
