'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import CorpFooter from '@/components/corp-footer'
import { suggestEmailCorrection } from '@/lib/email-typos'
import { QUESTIONS, DIMS, DIM_SHORT, VIBE_QUESTIONS, VIBE_HEADS, vibesFromAnswers, vibeLabel, validateZip, computeScores, pickArchetype, ATTACHMENT_QUESTIONS, computeAttachment, VALUES_QUESTIONS, valuesFromAnswers, RAPID_FIRE, rapidFromAnswers, PARTNER_QUESTIONS, partnerFromAnswers } from '@/lib/quiz-data'
import type { VibeKey } from '@/lib/quiz-data'
import { parseResponse } from '@/lib/fetch-helpers'
import styles from './quiz.module.css'

type Screen = 'intro' | 'verify' | 'quiz-intro' | 'quiz' | 'vibes-intro' | 'vibes' | 'rapid-intro' | 'rapid' | 'partner-intro' | 'partner' | 'attach-intro' | 'attach' | 'values-intro' | 'values' | 'loading' | 'result'

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

// Named chapters so the quiz reads like an experience, not a form.
// Two tracks: the CORE quiz (everyone — personality + lifestyle + fun) and the
// LOVE-line deep quiz (only when you board Love — partner + attachment + values).
const CHAPTERS: Record<string, { n: number; total: number; title: string; lede: string; sub: string; eyebrow?: string }> = {
  // ── core track (1–3 of 3)
  who:     { n: 1, total: 3, title: 'who you are',          lede: "the personality stuff. answer honestly — the algorithm clocks when you're performing.", sub: '12 quick ones.' },
  vibes:   { n: 2, total: 3, title: 'the day-to-day',       lede: 'how you actually live — your rhythms, your energy, your pace.',                        sub: '6 quick ones.' },
  rapid:   { n: 3, total: 3, title: 'rapid fire',           lede: 'no overthinking. gut answer, tap fast. speed-dating style.',                          sub: '8 this-or-thats.' },
  // ── love-deep track (1–3 of 3)
  partner: { n: 1, total: 3, title: 'what you’re looking for', eyebrow: 'love line', lede: 'now the romantic side — the kind of partner and relationship you actually want.', sub: '5 quick ones.' },
  attach:  { n: 2, total: 3, title: 'how you connect',      eyebrow: 'love line', lede: 'the way you bond is the single best read on how a relationship will feel. no wrong answers.', sub: '8 quick reads.' },
  values:  { n: 3, total: 3, title: 'what matters',         eyebrow: 'love line', lede: 'the stuff that quietly makes or breaks a match — kids, faith, ambition, health.', sub: '7 honest ones.' },
}

function ChapterCard({ k, onStart, onSkip, styles }: { k: string; onStart: () => void; onSkip?: () => void; styles: any }) {
  const c = CHAPTERS[k]
  if (!c) return null
  return (
    <div className={styles.screen}>
      <div className={styles.introWrap}>
        <div className={styles.introHero}>
          <div className={styles.stickerRow}>
            {c.eyebrow && <span className={styles.sticker}>✦ {c.eyebrow}</span>}
            <span className={styles.stickerGold}>chapter {c.n} / {c.total}</span>
          </div>
          <h1 className={styles.introH1}>
            {k === 'rapid' ? <>rapid <em>fire ⚡</em></> : <em>{c.title}.</em>}
          </h1>
          <p className={styles.introLede}>
            {c.lede}<br />
            <span className={styles.introLedeSub}>{c.sub} then we keep moving.</span>
          </p>
        </div>
        <button className="btn-primary" onClick={onStart} style={{ width: '100%', justifyContent: 'center' }}>
          {k === 'rapid' ? "let's go ⚡" : 'start →'}
        </button>
        {onSkip && (
          <button className="btn-ghost" onClick={onSkip} style={{ width: '100%', justifyContent: 'center', marginTop: '.6rem' }}>
            skip for now →
          </button>
        )}
      </div>
    </div>
  )
}

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
  // Love-line deep quiz: /quiz?line=love (logged-in users, after the core quiz).
  const isLoveDeep = searchParams.get('line') === 'love'
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
  // v2: attachment (Likert 1–5) + values (single-choice)
  const [currentAttachQ, setCurrentAttachQ] = useState(0)
  const [attachAnswers, setAttachAnswers] = useState<number[]>([])
  const [attachSelected, setAttachSelected] = useState<number|null>(null)
  const [currentValuesQ, setCurrentValuesQ] = useState(0)
  const [valuesAnswers, setValuesAnswers] = useState<number[]>([])
  const [valuesSelected, setValuesSelected] = useState<number|null>(null)
  // v2: rapid fire (this-or-that; selected value is 0 or 1, skip = -1)
  const [currentRapidQ, setCurrentRapidQ] = useState(0)
  const [rapidAnswers, setRapidAnswers] = useState<number[]>([])
  const [rapidSelected, setRapidSelected] = useState<number|null>(null)
  // love-deep: partner preferences (single-choice; skip = -1)
  const [currentPartnerQ, setCurrentPartnerQ] = useState(0)
  const [partnerAnswers, setPartnerAnswers] = useState<number[]>([])
  const [partnerSelected, setPartnerSelected] = useState<number|null>(null)
  const [loveDeepReady, setLoveDeepReady] = useState(false)
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

  // Love-deep entry: logged-in user boarding the Love line completes the deeper
  // romantic quiz (partner → attachment → values). Requires the core quiz first.
  useEffect(() => {
    if (!isLoveDeep || loveDeepReady) return
    (async () => {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await parseResponse<any>(res)
        if (!data?.user?.archetype) {
          // Haven't done the core quiz yet — send them there first.
          window.location.href = '/quiz'
          return
        }
        setForm((f) => ({ ...f, name: data.user.name || '', email: data.user.email || '' }))
        setLoveDeepReady(true)
        setScreen('partner-intro')
      } else {
        window.location.href = '/login?next=' + encodeURIComponent('/quiz?line=love')
      }
    })()
  }, [isLoveDeep, loveDeepReady])

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
          setScreen('quiz-intro')
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

  // CORE submit — personality + lifestyle + rapid. Lands on /hub (the line
  // chooser). Attachment/values are NOT here; they're the love-deep quiz.
  const submitCore = useCallback(async (finalScores: Record<string, number>, arch: ReturnType<typeof pickArchetype>, vibeAns: number[], rapidAns: number[]) => {
    try {
      // Rapid-fire ⚡ lives under vibes.rapid (light this-or-that signal).
      const vibes = { ...vibesFromAnswers(vibeAns), rapid: rapidFromAnswers(rapidAns) }
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
        // Email already has an account — send them to log in (they own the email,
        // so they can OTP in). We never expose user ids to the browser.
        window.location.href = '/login?next=' + encodeURIComponent('/hub')
        return
      }
      if (data.userId) {
        userIdRef.current = data.userId
        // Session is created server-side in /api/submit, so the user is logged
        // in. Land them on /hub (the line chooser) so they board Love and/or
        // Friend — the core quiz they just finished powers both lines.
        window.location.href = '/hub'
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      setScreen('result')
      setTimeout(() => setBarsVisible(true), 400)
    }
  }, [form, isRetake])

  // LOVE-DEEP submit — partner prefs + attachment + values. Enriches the love
  // profile (best-effort) and lands on the love dashboard.
  const submitLoveDeep = useCallback(async (attachAns: number[], valuesAns: number[], partnerAns: number[]) => {
    userIdRef.current = 'done' // prevent the loading screen's result fallback
    try {
      const attach = computeAttachment(attachAns)
      const { relationship_style, partner } = partnerFromAnswers(partnerAns)
      const values_profile = { ...valuesFromAnswers(valuesAns), partner }
      await fetch('/api/quiz/love-deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attach_anxiety: attach.anxiety,
          attach_avoidance: attach.avoidance,
          attach_style: attach.style,
          values_profile,
          relationship_style,
        }),
      })
    } catch (err) {
      console.error('Love-deep submit failed:', err)
    } finally {
      window.location.href = '/dashboard'
    }
  }, [])

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
      setScreen('rapid-intro') // core chapter 3: rapid fire
    } else { setCurrentVibeQ(q => q + 1) }
  }, [vibeAnswers, currentVibeQ])

  function nextVibe() { if (vibeSelected !== null) advanceVibe(vibeSelected) }
  function skipVibe() { advanceVibe(-1) }

  // love-deep: partner preferences (single-choice index, skip = -1)
  const advancePartner = useCallback((ans: number) => {
    const newAnswers = [...partnerAnswers, ans]
    setPartnerAnswers(newAnswers)
    setPartnerSelected(null)
    if (currentPartnerQ + 1 >= PARTNER_QUESTIONS.length) {
      setScreen('attach-intro') // love chapter 2: how you connect
    } else { setCurrentPartnerQ(q => q + 1) }
  }, [partnerAnswers, currentPartnerQ])
  function nextPartner() { if (partnerSelected !== null) advancePartner(partnerSelected) }
  function skipPartner() { advancePartner(-1) }

  // v2: attachment (Likert 1–5; selected value is the 1–5 rating, skip = -1)
  const advanceAttach = useCallback((ans: number) => {
    const newAnswers = [...attachAnswers, ans]
    setAttachAnswers(newAnswers)
    setAttachSelected(null)
    if (currentAttachQ + 1 >= ATTACHMENT_QUESTIONS.length) {
      setScreen('values-intro') // love chapter 3: what matters
    } else { setCurrentAttachQ(q => q + 1) }
  }, [attachAnswers, currentAttachQ])
  function nextAttach() { if (attachSelected !== null) advanceAttach(attachSelected) }
  function skipAttach() { advanceAttach(-1) }

  // love-deep: values (single-choice index) — last love chapter → submit love-deep.
  const advanceValues = useCallback((ans: number) => {
    const newAnswers = [...valuesAnswers, ans]
    setValuesAnswers(newAnswers)
    setValuesSelected(null)
    if (currentValuesQ + 1 >= VALUES_QUESTIONS.length) {
      setScreen('loading')
      setLoadingStep(0)
      setLoadingPct(0)
      submitLoveDeep(attachAnswers, newAnswers, partnerAnswers)
    } else { setCurrentValuesQ(q => q + 1) }
  }, [valuesAnswers, currentValuesQ, submitLoveDeep, attachAnswers, partnerAnswers])
  function nextValues() { if (valuesSelected !== null) advanceValues(valuesSelected) }
  function skipValues() { advanceValues(-1) }

  // core: rapid fire (this-or-that; 0/1, skip = -1) — last core chapter → submit core.
  const advanceRapid = useCallback((ans: number) => {
    const newAnswers = [...rapidAnswers, ans]
    setRapidAnswers(newAnswers)
    setRapidSelected(null)
    if (currentRapidQ + 1 >= RAPID_FIRE.length) {
      setScreen('loading')
      setLoadingStep(0)
      setLoadingPct(0)
      submitCore(scores, archetype!, vibeAnswers, newAnswers)
    } else { setCurrentRapidQ(q => q + 1) }
  }, [rapidAnswers, currentRapidQ, submitCore, scores, archetype, vibeAnswers])
  function skipRapid() { advanceRapid(-1) }

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
  const MAX_SCORE = 8 // HEXACO trimmed to 2 questions/dim × 4 pts

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
                    <option value="nb">non-binary</option>
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
                      <div style={{fontFamily:"'DM Mono', ui-monospace, monospace",fontSize:'.62rem',letterSpacing:'.06em',color:'#1b46c9',marginTop:'.35rem'}}>
                        did you mean{' '}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, email: suggestion }))}
                          style={{background:'rgba(37,99,255,0.15)',border:'1px solid rgba(37,99,255,0.4)',color:'#1b46c9',padding:'.15rem .5rem',borderRadius:'4px',fontFamily:'inherit',fontSize:'inherit',cursor:'pointer'}}
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

      {screen === 'quiz-intro' && (
        <ChapterCard k="who" onStart={() => setScreen('quiz')} styles={styles} />
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
        <ChapterCard k="vibes" onStart={() => setScreen('vibes')} styles={styles} />
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

      {screen === 'partner-intro' && (
        <ChapterCard
          k="partner"
          onStart={() => setScreen('partner')}
          onSkip={() => { window.location.href = '/dashboard' }}
          styles={styles}
        />
      )}

      {screen === 'partner' && PARTNER_QUESTIONS[currentPartnerQ] && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>{PARTNER_QUESTIONS[currentPartnerQ].short}</span>
                <span className={styles.qCount}>{currentPartnerQ + 1}/{PARTNER_QUESTIONS.length}</span>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(currentPartnerQ / PARTNER_QUESTIONS.length) * 100}%` }} />
            </div>
            <p className={styles.qText}>{PARTNER_QUESTIONS[currentPartnerQ].q}</p>
            <div className={styles.qOptions}>
              {PARTNER_QUESTIONS[currentPartnerQ].opts.map((opt, i) => (
                <button key={i}
                  className={`${styles.qOpt} ${partnerSelected === i ? styles.qOptSelected : ''}`}
                  onClick={() => setPartnerSelected(i)}>
                  <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipPartner}>skip this one</button>
              <button className="btn-primary" onClick={nextPartner} disabled={partnerSelected === null}>
                {currentPartnerQ + 1 === PARTNER_QUESTIONS.length ? 'next →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'attach-intro' && (
        <ChapterCard k="attach" onStart={() => setScreen('attach')} styles={styles} />
      )}

      {screen === 'attach' && ATTACHMENT_QUESTIONS[currentAttachQ] && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>how you connect</span>
                <span className={styles.qCount}>{currentAttachQ + 1}/{ATTACHMENT_QUESTIONS.length}</span>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(currentAttachQ / ATTACHMENT_QUESTIONS.length) * 100}%` }} />
            </div>
            <p className={styles.qText}>{ATTACHMENT_QUESTIONS[currentAttachQ].q}</p>
            <div className={styles.qOptions}>
              {[['1', 'Strongly disagree'], ['2', 'Disagree'], ['3', 'Neutral'], ['4', 'Agree'], ['5', 'Strongly agree']].map(([val, label]) => {
                const v = parseInt(val)
                return (
                  <button key={val}
                    className={`${styles.qOpt} ${attachSelected === v ? styles.qOptSelected : ''}`}
                    onClick={() => setAttachSelected(v)}>
                    <span className={styles.qKey}>{val}</span>
                    <span className={styles.qOptText}>{label}</span>
                  </button>
                )
              })}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipAttach}>skip this one</button>
              <button className="btn-primary" onClick={nextAttach} disabled={attachSelected === null}>
                {currentAttachQ + 1 === ATTACHMENT_QUESTIONS.length ? 'next →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'values-intro' && (
        <ChapterCard k="values" onStart={() => setScreen('values')} styles={styles} />
      )}

      {screen === 'values' && VALUES_QUESTIONS[currentValuesQ] && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>{VALUES_QUESTIONS[currentValuesQ].short}</span>
                <span className={styles.qCount}>{currentValuesQ + 1}/{VALUES_QUESTIONS.length}</span>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(currentValuesQ / VALUES_QUESTIONS.length) * 100}%` }} />
            </div>
            <p className={styles.qText}>{VALUES_QUESTIONS[currentValuesQ].q}</p>
            <div className={styles.qOptions}>
              {VALUES_QUESTIONS[currentValuesQ].opts.map((opt, i) => (
                <button key={i}
                  className={`${styles.qOpt} ${valuesSelected === i ? styles.qOptSelected : ''}`}
                  onClick={() => setValuesSelected(i)}>
                  <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipValues}>skip this one</button>
              <button className="btn-primary" onClick={nextValues} disabled={valuesSelected === null}>
                {currentValuesQ + 1 === VALUES_QUESTIONS.length ? 'finish →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'rapid-intro' && (
        <ChapterCard k="rapid" onStart={() => setScreen('rapid')} styles={styles} />
      )}

      {screen === 'rapid' && RAPID_FIRE[currentRapidQ] && (
        <div className={styles.screen}>
          <div className={styles.quizWrap}>
            <div className={styles.quizTop}>
              <div className={styles.quizLogo}>Not<span>Cupid</span></div>
              <div className={styles.qMeta}>
                <span className={styles.qDim}>rapid fire ⚡</span>
                <span className={styles.qCount}>{currentRapidQ + 1}/{RAPID_FIRE.length}</span>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(currentRapidQ / RAPID_FIRE.length) * 100}%` }} />
            </div>
            <p className={styles.qText}>{RAPID_FIRE[currentRapidQ].q}</p>
            <div className={styles.qOptions}>
              {[RAPID_FIRE[currentRapidQ].a, RAPID_FIRE[currentRapidQ].b].map((opt, i) => (
                <button key={i}
                  className={`${styles.qOpt} ${rapidSelected === i ? styles.qOptSelected : ''}`}
                  onClick={() => { setRapidSelected(i); advanceRapid(i) }}>
                  <span className={styles.qKey}>{i === 0 ? 'A' : 'B'}</span>
                  <span className={styles.qOptText}>{opt}</span>
                </button>
              ))}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipRapid}>no preference</button>
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
                          background:'rgba(37,99,255,0.13)',
                          color:'#1b46c9',
                          border:'1px solid rgba(37,99,255,0.35)',
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
