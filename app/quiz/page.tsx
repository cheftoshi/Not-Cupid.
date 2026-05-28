'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import CorpFooter from '@/components/corp-footer'
import { suggestEmailCorrection } from '@/lib/email-typos'
import { QUESTIONS, DIMS, DIM_SHORT, VIBE_QUESTIONS, VIBE_HEADS, vibesFromAnswers, vibeLabel, validateZip, computeScores, pickArchetype } from '@/lib/quiz-data'
import type { VibeKey } from '@/lib/quiz-data'
import { parseResponse } from '@/lib/fetch-helpers'
import styles from './quiz.module.css'

type Screen = 'intro' | 'verify' | 'quiz' | 'vibes-intro' | 'vibes' | 'loading' | 'result'

interface FormData {
  name: string; age: string; gender: string; seek: string
  zip: string; email: string; ageMin: string; ageMax: string
}

const LOADING_MSGS = [
  'Cross-referencing chaos levels...',
  'Consulting the Boston oracle...',
  'Penalizing red flag responses...',
  "Checking Dunkin' loyalty scores...",
  'Calibrating emotional damage...',
  'Your match is almost cooked...',
]

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizInner />
    </Suspense>
  )
}

function QuizInner() {
  const searchParams = useSearchParams()
  const isRetake = searchParams.get('retake') === '1'
  const [screen, setScreen] = useState<Screen>('intro')
  const [retakeReady, setRetakeReady] = useState(false)
  const [form, setForm] = useState<FormData>({ name:'', age:'', gender:'', seek:'', zip:'', email:'', ageMin:'22', ageMax:'38' })
  const [zipStatus, setZipStatus] = useState<'idle'|'valid'|'invalid'|'outofrange'>('idle')
  const [otp, setOtp] = useState(['','','','','',''])
  const [otpError, setOtpError] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedOpt, setSelectedOpt] = useState<number|null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [currentVibeQ, setCurrentVibeQ] = useState(0)
  const [vibeAnswers, setVibeAnswers] = useState<number[]>([])
  const [vibeSelected, setVibeSelected] = useState<number|null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingPct, setLoadingPct] = useState(0)
  const [archetype, setArchetype] = useState<ReturnType<typeof pickArchetype>|null>(null)
  const [scores, setScores] = useState<Record<string,number>>({})
  const [barsVisible, setBarsVisible] = useState(false)
  const [shake, setShake] = useState(false)
  const userIdRef = useRef<string>('')

  // Retake flow: if user is authenticated, skip intro + verify and go straight to quiz.
  useEffect(() => {
    if (!isRetake || retakeReady) return
    (async () => {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await parseResponse<any>(res)
        // Hydrate the form so submit has the user's existing details
        if (data?.user) {
          setForm((f) => ({
            ...f,
            name: data.user.name || '',
            age: String(data.user.age || ''),
            gender: data.user.gender || '',
            seek: data.user.seeking || '',
            zip: data.user.zip || '',
            email: data.user.email || '',
            ageMin: String(data.user.age_min || 22),
            ageMax: String(data.user.age_max || 38),
          }))
        }
        setRetakeReady(true)
        setScreen('quiz')
      } else {
        // Not logged in — send them to login with return path
        window.location.href = '/login?next=' + encodeURIComponent('/quiz?retake=1')
      }
    })()
  }, [isRetake, retakeReady])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const formValid = form.name.trim() && parseInt(form.age) >= 18 && form.gender && form.seek &&
    emailValid && parseInt(form.ageMin) >= 18 && parseInt(form.ageMax) > parseInt(form.ageMin) && zipStatus === 'valid'
  const otpComplete = otp.every(d => d !== '')

  function handleZip(z: string) {
    setForm(f => ({...f, zip: z}))
    if (z.length < 5) { setZipStatus('idle'); return }
    const result = validateZip(z)
    setZipStatus(result === 'incomplete' ? 'idle' : result as any)
  }

  async function sendOtp() {
    setOtpSending(true)
    setOtpError('')
    try {
      await fetch('/api/send-otp', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: form.email })
      })
      setScreen('verify')
      setResendTimer(60)
    } catch { setOtpError('Failed to send. Try again.') }
    finally { setOtpSending(false) }
  }

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  function handleOtpInput(val: string, idx: number) {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    setOtpError('')
    if (val && idx < 5) document.getElementById(`otp-${idx+1}`)?.focus()
  }

  function handleOtpKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx-1}`)?.focus()
    }
  }

  async function verifyOtp() {
    setOtpVerifying(true)
    setOtpError('')
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: form.email, code: otp.join('') })
      })
      const data = await parseResponse<any>(res)
      if (data.success) {
        // Brand-new email → continue the signup quiz here.
        // Existing account → honor the server's redirect (either /hub if
        // they finished the quiz before, or /quiz?retake=1 if they didn't).
        // This avoids re-running the quiz and hitting a duplicate-email
        // 409 at /api/submit.
        if (data.needsQuiz) {
          setScreen('quiz')
        } else {
          window.location.href = data.redirect || '/hub'
        }
      } else {
        setOtpError(data.error === 'Code expired' ? 'Code expired. Request a new one.' : 'Wrong code. Try again.')
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setOtp(['','','','','',''])
        document.getElementById('otp-0')?.focus()
      }
    } catch { setOtpError('Something went wrong.') }
    finally { setOtpVerifying(false) }
  }

  const submitToDatabase = useCallback(async (finalScores: Record<string, number>, arch: ReturnType<typeof pickArchetype>, vibeAns: number[]) => {
    try {
      const vibes = vibesFromAnswers(vibeAns)
      const scorePayload = {
        score_honesty: finalScores['Honesty-Humility'] ?? 0,
        score_emotionality: finalScores['Emotionality'] ?? 0,
        score_extraversion: finalScores['Extraversion'] ?? 0,
        score_agreeableness: finalScores['Agreeableness'] ?? 0,
        score_conscientiousness: finalScores['Conscientiousness'] ?? 0,
        score_openness: finalScores['Openness'] ?? 0,
        archetype: arch.name,
        vibes,
      }

      // Retake path: existing logged-in user → UPDATE row, don't re-insert.
      if (isRetake) {
        const res = await fetch('/api/quiz/update', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(scorePayload),
        })
        if (res.ok) {
          window.location.href = '/dashboard'
          return
        }
        // Fall through to result screen on error
      }

      const res = await fetch('/api/submit', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: form.name, age: form.age, gender: form.gender, seeking: form.seek,
          zip: form.zip, email: form.email, age_min: parseInt(form.ageMin), age_max: parseInt(form.ageMax),
          ...scorePayload,
        })
      })
      const data = await parseResponse<any>(res)
if (res.status === 409) {
  const existing = await fetch(`/api/get-user-by-email?email=${encodeURIComponent(form.email)}`)
  const existingData = await parseResponse<any>(existing)
  if (existingData.userId) {
    window.location.href = `/dashboard?id=${existingData.userId}`
  } else {
    setScreen('result')
    setTimeout(() => setBarsVisible(true), 400)
  }
  return
}
      if (data.userId) {
        userIdRef.current = data.userId
        window.location.href = `/dashboard?id=${data.userId}`
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      setScreen('result')
      setTimeout(() => setBarsVisible(true), 400)
    }
  }, [form, isRetake])

  const advance = useCallback((ans: number) => {
    const newAnswers = [...answers, ans]
    setAnswers(newAnswers)
    setSelectedOpt(null)
    if (currentQ + 1 >= QUESTIONS.length) {
      // HEXACO is done — move to the vibes mini-quiz.
      const finalScores = computeScores(newAnswers)
      const arch = pickArchetype(finalScores)
      setScores(finalScores)
      setArchetype(arch)
      setScreen('vibes-intro')
    } else { setCurrentQ(q => q + 1) }
  }, [answers, currentQ])

  function nextQ() { if (selectedOpt !== null) advance(selectedOpt) }
  function skipQ() { advance(-1) }

  const advanceVibe = useCallback((ans: number) => {
    const newAnswers = [...vibeAnswers, ans]
    setVibeAnswers(newAnswers)
    setVibeSelected(null)
    if (currentVibeQ + 1 >= VIBE_QUESTIONS.length) {
      // All done — submit + go to loading.
      setScreen('loading')
      setLoadingStep(0)
      setLoadingPct(0)
      submitToDatabase(scores, archetype!, newAnswers)
    } else { setCurrentVibeQ(q => q + 1) }
  }, [vibeAnswers, currentVibeQ, submitToDatabase, scores, archetype])

  function nextVibe() { if (vibeSelected !== null) advanceVibe(vibeSelected) }
  function skipVibe() { advanceVibe(-1) }

  useEffect(() => {
    if (screen !== 'quiz') return
    function onKey(e: KeyboardEvent) {
      const map: Record<string, number> = {a:0,b:1,c:2,d:3}
      if (map[e.key.toLowerCase()] !== undefined) setSelectedOpt(map[e.key.toLowerCase()])
      if (e.key === 'Enter' && selectedOpt !== null) nextQ()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, selectedOpt, nextQ])

  useEffect(() => {
    if (screen !== 'vibes') return
    function onKey(e: KeyboardEvent) {
      const map: Record<string, number> = {a:0,b:1,c:2,d:3}
      if (map[e.key.toLowerCase()] !== undefined) setVibeSelected(map[e.key.toLowerCase()])
      if (e.key === 'Enter' && vibeSelected !== null) nextVibe()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, vibeSelected, nextVibe])

  useEffect(() => {
    if (screen !== 'loading') return
    let step = 0
    const interval = setInterval(() => {
      step++
      setLoadingStep(step)
      setLoadingPct(Math.min(Math.round((step / LOADING_MSGS.length) * 100), 100))
      if (step >= LOADING_MSGS.length) {
        clearInterval(interval)
        setTimeout(() => {
          if (!userIdRef.current) {
            setScreen('result')
            setTimeout(() => setBarsVisible(true), 400)
          }
        }, 2000)
      }
    }, 800)
    return () => clearInterval(interval)
  }, [screen])

  const q = QUESTIONS[currentQ]
  const progress = (currentQ / QUESTIONS.length) * 100
  const MAX_SCORE = 16

  return (
    <>
      <Nav />

      {screen === 'intro' && (
        <div className={styles.screen}>
          <div className={styles.introWrap}>
            <div className={styles.introHero}>
              <div className={styles.stickerRow}>
                <span className={styles.sticker}>🚫 cupid</span>
                <span className={styles.stickerGold}>✦ science</span>
              </div>
              <h1 className={styles.introH1}>
                ok so<br />hear me<br /><em>out.</em>
              </h1>
              <p className={styles.introLede}>
                what if instead of swiping on vibes you just... let an algorithm built on actual psychology do it?<br />
                <span className={styles.introLedeSub}>yeah. that's the pitch.</span>
              </p>
            </div>

            <div className={styles.rulesBlock}>
              <p className={styles.rulesTitle}>here's the deal →</p>
              {[
                ['no photos first', 'your personality goes before your face. radical concept.'],
                ['one match only', 'we pick one person. you get an email. the rest is on you.'],
                ['boston only', '50 miles of 02116. so you can actually meet up.'],
                ['7 minutes', "answer honestly. the algorithm clocks when you're performing."],
              ].map(([bold, rest]) => (
                <div key={bold} className={styles.rule}>
                  <span className={styles.ruleDot}>→</span>
                  <span className={styles.ruleText}><strong>{bold}</strong> — {rest}</span>
                </div>
              ))}
            </div>

            <div className={styles.formBlock}>
              <p className={styles.formTitle}>let's go</p>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>first name</label>
                  <input className={styles.input} placeholder="your name" value={form.name}
                    onChange={e => setForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>age</label>
                  <input className={styles.input} type="number" placeholder="27" min={18} max={99}
                    value={form.age} onChange={e => setForm(f=>({...f,age:e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>i am a</label>
                  <select className={styles.input} value={form.gender}
                    onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
                    <option value="">—</option>
                    <option value="m">man</option>
                    <option value="f">woman</option>
                    <option value="b">bisexual</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>looking for</label>
                  <select className={styles.input} value={form.seek}
                    onChange={e => setForm(f=>({...f,seek:e.target.value}))}>
                    <option value="">—</option>
                    <option value="f">women</option>
                    <option value="m">men</option>
                    <option value="b">everyone</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>match age range</label>
                  <div className={styles.ageRangeWrap}>
                    <input className={styles.input} type="number" placeholder="22" min={18} max={99}
                      value={form.ageMin} onChange={e => setForm(f=>({...f,ageMin:e.target.value}))} style={{flex:1}} />
                    <span className={styles.ageSep}>—</span>
                    <input className={styles.input} type="number" placeholder="35" min={18} max={99}
                      value={form.ageMax} onChange={e => setForm(f=>({...f,ageMax:e.target.value}))} style={{flex:1}} />
                  </div>
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>zip code</label>
                  <div className={styles.zipWrap}>
                    <input className={styles.input} placeholder="02116" maxLength={5}
                      value={form.zip} onChange={e => handleZip(e.target.value)} />
                    {zipStatus === 'valid' && <span className={styles.zipOk}>✓ you're in</span>}
                    {zipStatus === 'outofrange' && <span className={styles.zipBad}>outside range — <a href="/out-of-range" style={{color:'var(--lav)'}}>join waitlist</a></span>}
                    {zipStatus === 'invalid' && <span className={styles.zipBad}>not in our area</span>}
                  </div>
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>email — this is how we reach you</label>
                  <input className={styles.input} type="email" placeholder="you@email.com"
                    value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
                  {form.email && !emailValid && (
                    <span className={styles.fieldError}>that doesn't look like an email</span>
                  )}
                  {form.email.includes('@') && (() => {
                    const suggestion = suggestEmailCorrection(form.email)
                    if (!suggestion) return null
                    return (
                      <div style={{fontFamily:"'DM Mono', ui-monospace, monospace",fontSize:'.62rem',letterSpacing:'.06em',color:'#5b4fa0',marginTop:'.35rem'}}>
                        did you mean{' '}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, email: suggestion }))}
                          style={{background:'rgba(139,127,212,0.15)',border:'1px solid rgba(139,127,212,0.4)',color:'#5b4fa0',padding:'.15rem .5rem',borderRadius:'4px',fontFamily:'inherit',fontSize:'inherit',cursor:'pointer'}}
                        >
                          {suggestion}
                        </button>
                        {' '}?
                      </div>
                    )
                  })()}
                </div>
              </div>

              <button className="btn-primary" onClick={sendOtp}
                disabled={!formValid || otpSending}
                style={{width:'100%',justifyContent:'center',marginTop:'0.5rem'}}>
                {otpSending ? 'sending code...' : 'verify my email →'}
              </button>
              <p className={styles.formNote}>we'll send a 6-digit code to confirm it's you</p>
            </div>
          </div>
        </div>
      )}

      {screen === 'verify' && (
        <div className={styles.screen}>
          <div className={styles.verifyWrap}>
            <div className={styles.verifyTop}>
              <span className={styles.verifyEmoji}>📬</span>
              <h2 className={styles.verifyH2}>check your inbox.</h2>
              <p className={styles.verifySub}>
                we sent a 6-digit code to<br />
                <strong>{form.email}</strong>
              </p>
              <p className={styles.verifyNote}>check spam if you don't see it in 60 seconds</p>
            </div>

            <div className={`${styles.otpRow} ${shake ? styles.shake : ''}`}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  className={`${styles.otpBox} ${otpError ? styles.otpBoxError : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpInput(e.target.value, i)}
                  onKeyDown={e => handleOtpKey(e, i)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {otpError && <p className={styles.otpError}>{otpError}</p>}

            <button className="btn-primary" onClick={verifyOtp}
              disabled={!otpComplete || otpVerifying}
              style={{width:'100%',justifyContent:'center'}}>
              {otpVerifying ? 'verifying...' : 'confirm code →'}
            </button>

            <div className={styles.resendRow}>
              {resendTimer > 0
                ? <span className={styles.resendTimer}>resend in {resendTimer}s</span>
                : <button className={styles.resendBtn} onClick={() => { sendOtp(); setOtp(['','','','','','']) }}>
                    resend code
                  </button>
              }
              <span className={styles.resendDot}>·</span>
              <button className={styles.resendBtn} onClick={() => setScreen('intro')}>
                wrong email?
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'quiz' && q && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>{q.short}</span>
                <span className={styles.qCount}>{currentQ + 1}/{QUESTIONS.length}</span>
              </div>
            </div>

            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{width:`${progress}%`}} />
            </div>

            <p className={styles.qText}>{q.q}</p>

            <div className={styles.qOptions}>
              {q.opts.map((opt, i) => (
                <button key={i}
                  className={`${styles.qOpt} ${selectedOpt === i ? styles.qOptSelected : ''}`}
                  onClick={() => setSelectedOpt(i)}>
                  <span className={styles.qKey}>{String.fromCharCode(65+i)}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>

            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipQ}>skip this one</button>
              <button className="btn-primary" onClick={nextQ} disabled={selectedOpt === null}>
                {currentQ + 1 === QUESTIONS.length ? 'finish →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'vibes-intro' && (
        <div className={styles.screen}>
          <div className={styles.introWrap}>
            <div className={styles.introHero}>
              <div className={styles.stickerRow}>
                <span className={styles.stickerGold}>✦ part 2</span>
              </div>
              <h1 className={styles.introH1}>
                now <em>the day-to-day.</em>
              </h1>
              <p className={styles.introLede}>
                personality is half the story. how you actually <em>live</em> matters just as much.<br />
                <span className={styles.introLedeSub}>6 quick ones. then we go.</span>
              </p>
            </div>
            <button className="btn-primary" onClick={() => setScreen('vibes')} style={{width:'100%',justifyContent:'center'}}>
              start →
            </button>
          </div>
        </div>
      )}

      {screen === 'vibes' && VIBE_QUESTIONS[currentVibeQ] && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>{VIBE_QUESTIONS[currentVibeQ].short}</span>
                <span className={styles.qCount}>{currentVibeQ + 1}/{VIBE_QUESTIONS.length}</span>
              </div>
            </div>

            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{width:`${(currentVibeQ / VIBE_QUESTIONS.length) * 100}%`}} />
            </div>

            <p className={styles.qText}>{VIBE_QUESTIONS[currentVibeQ].q}</p>

            <div className={styles.qOptions}>
              {VIBE_QUESTIONS[currentVibeQ].opts.map((opt, i) => (
                <button key={i}
                  className={`${styles.qOpt} ${vibeSelected === i ? styles.qOptSelected : ''}`}
                  onClick={() => setVibeSelected(i)}>
                  <span className={styles.qKey}>{String.fromCharCode(65+i)}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>

            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipVibe}>skip this one</button>
              <button className="btn-primary" onClick={nextVibe} disabled={vibeSelected === null}>
                {currentVibeQ + 1 === VIBE_QUESTIONS.length ? 'finish →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <div className={styles.screen}>
          <div className={styles.loadingWrap}>
            <div className={styles.loadingGlyph}>⧖</div>
            <h2 className={styles.loadingH2}>hold on.</h2>
            <p className={styles.loadingSub}>the algorithm is doing its thing. this is not a drill.</p>
            <div className={styles.loadingBarWrap}>
              <div className={styles.loadingBar} style={{width:`${loadingPct}%`}} />
            </div>
            <p className={styles.loadingStatus}>{LOADING_MSGS[Math.min(loadingStep, LOADING_MSGS.length-1)]}</p>
          </div>
        </div>
      )}

      {screen === 'result' && archetype && (
        <div className={styles.screen}>
          <div className={styles.resultWrap}>
            <div className={styles.resultHero}>
              <p className={styles.resultEyebrow}>the algorithm has spoken</p>
              <h1 className={styles.resultH1}>you are<br /><em>{archetype.name}.</em></h1>
              <p className={styles.resultTag}>{archetype.tag}</p>
            </div>

            <div className={styles.resultDescCard}>
              <p className={styles.resultDesc}>{archetype.desc}</p>
            </div>

            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <span className={styles.profileTitle}>your hexaco profile</span>
                <span className={styles.profileLock}>🔒 $0.99 to unlock</span>
              </div>
              <div className={styles.dimRows}>
                {DIMS.map((dim, i) => {
                  const pct = Math.round(((scores[dim] ?? 0) / MAX_SCORE) * 100)
                  const blurred = i > 1
                  return (
                    <div key={dim} className={`${styles.dimRow} ${blurred ? styles.blurred : ''}`}>
                      <span className={styles.dimName}>{DIM_SHORT[dim]}</span>
                      <div className={styles.dimBarBg}>
                        <div className={styles.dimBarFill} style={{width: barsVisible && !blurred ? `${pct}%` : '0%'}} />
                      </div>
                      <span className={styles.dimScore}>{blurred ? '??' : `${pct}%`}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {vibeAnswers.length > 0 && (
              <div className={styles.profileCard}>
                <div className={styles.profileHeader}>
                  <span className={styles.profileTitle}>your vibes</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.4rem'}}>
                  {VIBE_QUESTIONS.map((vq, i) => {
                    const idx = vibeAnswers[i]
                    if (idx === undefined || idx < 0) return null
                    const score = vq.score[idx]
                    const label = vibeLabel(vq.key as VibeKey, score)
                    if (!label) return null
                    return (
                      <span
                        key={vq.key}
                        style={{
                          background:'rgba(139,127,212,0.13)',
                          color:'#5b4fa0',
                          border:'1px solid rgba(139,127,212,0.35)',
                          borderRadius:'999px',
                          padding:'.4rem .9rem',
                          fontFamily:"'DM Mono', ui-monospace, monospace",
                          fontSize:'.72rem',
                          letterSpacing:'.04em',
                        }}
                      >
                        <span style={{opacity:.6,marginRight:'.4rem',fontSize:'.6rem',textTransform:'uppercase',letterSpacing:'.12em'}}>{VIBE_HEADS[vq.key as VibeKey]}</span>
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={styles.matchCard}>
              <div className={styles.matchBadge}>pool status: active 👀</div>
              <p className={styles.matchTitle}>you're in.</p>
              <p className={styles.matchDesc}>
                the algorithm is watching the boston pool. the second someone compatible shows up you'll get an email. one match. one spot in the city. show up.
              </p>
            </div>

            <button className="btn-ghost"
              onClick={() => { setScreen('intro'); setAnswers([]); setCurrentQ(0); setOtp(['','','','','','']) }}
              style={{marginTop:'1rem',width:'100%',justifyContent:'center'}}>
              retake the quiz
            </button>
          </div>
        </div>
      )}

      <CorpFooter />
    </>
  )
}
