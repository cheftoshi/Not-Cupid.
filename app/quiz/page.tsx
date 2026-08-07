'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import { suggestEmailCorrection } from '@/lib/email-typos'
import { QUESTIONS, DIMS, DIM_SHORT, VIBE_QUESTIONS, VIBE_HEADS, vibesFromAnswers, vibeLabel, validateZip, computeScores, pickArchetype, ATTACHMENT_QUESTIONS, computeAttachment, VALUES_QUESTIONS, valuesFromAnswers, RAPID_FIRE, rapidFromAnswers, PARTNER_QUESTIONS, partnerFromAnswers, typeSlug } from '@/lib/quiz-data'
import type { VibeKey } from '@/lib/quiz-data'
import { parseResponse } from '@/lib/fetch-helpers'
import { toast } from '@/components/feedback'
import styles from './quiz.module.css'

type Screen = 'intro' | 'details' | 'verify' | 'save-error' | 'quiz-intro' | 'quiz' | 'vibes-intro' | 'vibes' | 'rapid-intro' | 'rapid' | 'love-preferences' | 'partner-intro' | 'partner' | 'attach-intro' | 'attach' | 'values-intro' | 'values' | 'loading' | 'result' | 'love-done'

interface FormData {
  name: string; age: string; gender: string; seek: string
  zip: string; email: string; ageMin: string; ageMax: string
}

const LOADING_MSGS = [
  'Reading the patterns...',
  'Balancing personality and pace...',
  'Finding what feels natural...',
  'Turning answers into your baseline...',
  'Checking your local pool...',
  'Your profile is almost ready...',
]

const INTENT_OPTIONS = [
  {
    value: 'love',
    eyebrow: 'love line',
    icon: '💘',
    title: 'I want to date.',
    body: 'Five curated options, up to three active connections, and help turning a chat into a real plan.',
    next: 'baseline first · Love setup after',
  },
  {
    value: 'friends',
    eyebrow: 'friend line',
    icon: '🧡',
    title: 'I want more people around me.',
    body: 'Find compatible people, small plans, and communities without pretending you are here to date.',
    next: 'baseline first · short Friend setup after',
  },
  {
    value: 'both',
    eyebrow: 'both lines',
    icon: '✨',
    title: 'I am open to both.',
    body: 'Build one baseline, then set up Love and Friend one at a time. You can pause between them.',
    next: 'one clear step at a time',
  },
] as const

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
  // Staggered reveal — eyebrow → title → lede → button (inline animation names
  // resolve against the GLOBAL fadeUp keyframes; inline styles bypass module scoping).
  const stag = (delay: number): React.CSSProperties => ({ animation: `fadeUp 0.45s ease ${delay}s both` })
  return (
    <div className={styles.screen}>
      <div className={styles.introWrap}>
        <div className={styles.introHero}>
          <div className={styles.stickerRow} style={stag(0.05)}>
            {c.eyebrow && <span className={styles.sticker}>✦ {c.eyebrow}</span>}
            <span className={styles.stickerGold}>chapter {c.n} / {c.total}</span>
          </div>
          <h1 className={styles.introH1} style={stag(0.2)}>
            {k === 'rapid' ? <>rapid <em>fire ⚡</em></> : <em>{c.title}.</em>}
          </h1>
          <p className={styles.introLede} style={stag(0.38)}>
            {c.lede}<br />
            <span className={styles.introLedeSub}>{c.sub} then we keep moving.</span>
          </p>
        </div>
        <button className="btn-primary" onClick={onStart} style={{ width: '100%', justifyContent: 'center', ...stag(0.55) }}>
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
  const nextIntent = searchParams.get('next') === 'friends' ? 'friends' : null
  const afterCorePath = nextIntent === 'friends' ? '/friends/quiz' : '/hub'
  // Love-line deep quiz: /quiz?line=love (logged-in users, after the core quiz).
  const isLoveDeep = searchParams.get('line') === 'love'
  // Invite attribution: /quiz?ref=<code> (from a /join/<code> link). Kept in
  // localStorage so it survives the OTP round-trip, sent with /api/submit.
  const refCode = (() => {
    const fromUrl = (searchParams.get('ref') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    if (typeof window !== 'undefined') {
      try {
        if (fromUrl) { localStorage.setItem('nc_ref', fromUrl); return fromUrl }
        return localStorage.getItem('nc_ref') || ''
      } catch { return fromUrl }
    }
    return fromUrl
  })()
  const [screen, setScreen] = useState<Screen>('intro')
  const [retakeReady, setRetakeReady] = useState(false)
  const [form, setForm] = useState<FormData>({ name:'', age:'', gender:'', seek:'', zip:'', email:'', ageMin:'22', ageMax:'38' })
  // Live pool teaser for the entered ZIP ("214 people in the Boston experiment").
  const [poolPeek, setPoolPeek] = useState<{ city: string; count: number; recent: number } | null>(null)
  // ONE-FLOW ONBOARDING: "what are you here for?" — asked at signup so the core
  // quiz can route STRAIGHT into the right deep quiz (no hub fork mid-flow).
  // State (not a ref) so the result screen re-renders when signup completes.
  // Friend referral links carry their intent in the URL; the "both" handoff also
  // carries its next step in the URL, so the rendered selection never depends on
  // browser-only storage during hydration.
  const [intent, setIntentState] = useState<'' | 'love' | 'friends' | 'both'>(() => {
    if (nextIntent === 'friends' && !isLoveDeep) return 'friends'
    return ''
  })
  const setIntent = (v: '' | 'love' | 'friends' | 'both') => {
    setIntentState(v)
  }
  const [postQuizPath, setPostQuizPath] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [zipStatus, setZipStatus] = useState<'idle'|'valid'|'invalid'|'outofrange'>('idle')
  const [otp, setOtp] = useState(['','','','','',''])
  const [otpError, setOtpError] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [coreSaveError, setCoreSaveError] = useState(false)
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
  const [partnerAnswers, setPartnerAnswers] = useState<(number | number[])[]>([])
  const [partnerSelected, setPartnerSelected] = useState<number|null>(null)
  const [partnerMulti, setPartnerMulti] = useState<number[]>([]) // multi-select picks for the current Q
  const [loveDeepReady, setLoveDeepReady] = useState(false)
  const [loveSaveError, setLoveSaveError] = useState('')
  const [loveSaveBusy, setLoveSaveBusy] = useState(false)
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
        const seeking = data.user.seeking || ''
        const ageMin = Number(data.user.age_min) || 18
        const ageMax = Number(data.user.age_max) || 99
        setForm((f) => ({
          ...f,
          name: data.user.name || '',
          email: data.user.email || '',
          seek: seeking,
          ageMin: String(ageMin),
          ageMax: String(ageMax),
        }))
        setLoveDeepReady(true)
        // Friend-first signup stores deliberately broad legacy defaults because
        // these columns are required. Ask for real Love preferences exactly once
        // when those defaults are still present; otherwise avoid a repeated step.
        const needsLovePreferences = !seeking || ageMin < 18 || ageMax <= ageMin ||
          (seeking === 'b' && ageMin === 18 && ageMax === 99)
        setScreen(needsLovePreferences ? 'love-preferences' : 'partner-intro')
      } else {
        window.location.href = '/login?next=' + encodeURIComponent('/quiz?line=love')
      }
    })()
  }, [isLoveDeep, loveDeepReady])

  // Already logged in but landed on the bare signup quiz (e.g. sent here by the
  // hub or friend-quiz gate)? Don't make them re-enter details + re-verify their
  // email — that read as "it's making me sign up / take the quiz again". Route
  // them into the retake flow, which hydrates their info and jumps straight to
  // the questions, saving via /api/quiz/update (no duplicate-email 409).
  useEffect(() => {
    if (isRetake || isLoveDeep || screen !== 'intro') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile')
        if (!cancelled && res.ok) window.location.replace('/quiz?retake=1')
      } catch { /* not logged in — stay on signup */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const friendOnly = intent === 'friends'
  const loveDeepPreferenceValid = ['m', 'f', 'b'].includes(form.seek) &&
    parseInt(form.ageMin) >= 18 && parseInt(form.ageMax) > parseInt(form.ageMin) && parseInt(form.ageMax) <= 99
  const lovePreferenceValid = friendOnly || (form.seek && parseInt(form.ageMin) >= 18 && parseInt(form.ageMax) > parseInt(form.ageMin))
  const formValid = form.name.trim() && parseInt(form.age) >= 18 && form.gender && lovePreferenceValid &&
    emailValid && zipStatus === 'valid'
  const otpComplete = otp.every(d => d !== '')

  function continueFromIntent() {
    if (!intent) return
    if (intent === 'friends') {
      // The core users table predates Friend Line and still requires Love
      // preference columns. Use broad, neutral defaults for Friend-first signup;
      // if they enter Love later, the Love setup asks them to tune the profile.
      setForm((current) => ({
        ...current,
        seek: current.seek || 'b',
        ageMin: '18',
        ageMax: '99',
      }))
    }
    setScreen('details')
  }

  function handleZip(z: string) {
    setForm(f => ({...f, zip: z}))
    if (z.length < 5) { setZipStatus('idle'); setPoolPeek(null); return }
    const result = validateZip(z)
    setZipStatus(result === 'incomplete' ? 'idle' : result as any)
    // The "who's waiting" teaser — show the pool is real the moment the ZIP is in.
    if (result === 'valid') {
      fetch(`/api/pool-preview?zip=${z}`)
        .then((r) => r.json())
        .then((d) => { if (d?.ok) setPoolPeek(d) })
        .catch(() => {})
    } else setPoolPeek(null)
  }

  async function sendOtp() {
    setOtpSending(true)
    setOtpError('')
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: form.email })
      })
      const data = await parseResponse<{ error?: string }>(response)
      if (!response.ok) {
        setOtpError(data.error || 'Could not send the code. Try again.')
        return
      }
      setScreen('verify')
      setResendTimer(60)
    } catch { setOtpError('Could not send the code. Try again.') }
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
          if (
            coreSaveError && archetype &&
            answers.length === QUESTIONS.length &&
            vibeAnswers.length === VIBE_QUESTIONS.length &&
            rapidAnswers.length === RAPID_FIRE.length
          ) {
            setCoreSaveError(false)
            setScreen('loading')
            setLoadingStep(0)
            setLoadingPct(0)
            void submitCore(scores, archetype, vibeAnswers, rapidAnswers)
          } else {
            setScreen('quiz-intro')
          }
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
      // Land on /hub (the line chooser), NOT the love dashboard — finishing the
      // CORE quiz means "pick a line," and this path also catches users who
      // signed up before the quiz existed (verify-otp routes them here).
      if (isRetake) {
        const res = await fetch('/api/quiz/update', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(scorePayload),
        })
        if (res.ok) {
          window.location.href = afterCorePath
          return
        }
        // IMPORTANT: do NOT fall through to /api/submit — their email already
        // has an account, so submit 409s → login → verify-otp sees no archetype
        // → back to retake → loop ("it keeps telling me to retake the quiz").
        // Keep the answers in memory and offer a real retry. Never make a
        // failed save look like a successful result.
        console.error('Retake save failed', res.status)
        setCoreSaveError(true)
        setScreen('save-error')
        return
      }

      const res = await fetch('/api/submit', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: form.name, age: form.age, gender: form.gender, seeking: form.seek,
          zip: form.zip, email: form.email, age_min: parseInt(form.ageMin), age_max: parseInt(form.ageMax),
          ...(refCode ? { ref: refCode } : {}),
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
      if (!res.ok) throw new Error(data.error || 'Could not save your baseline')
      if (data.userId) {
        userIdRef.current = data.userId
        // Session exists server-side. Do NOT redirect — let the loading screen
        // finish into the RESULT screen (the archetype reveal is the quiz's
        // payoff + share moment). The result's continue button routes by the
        // intent they picked at signup: straight into the right deep quiz, no
        // hub fork mid-flow.
        setPostQuizPath(
          intent === 'friends' ? '/friends/quiz'
          : intent === 'both' ? '/quiz?line=love&next=friends'
          : intent === 'love' ? '/quiz?line=love'
          : afterCorePath
        )
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      setCoreSaveError(true)
      setOtp(['','','','','',''])
      setOtpError('')
      setScreen('save-error')
    }
  }, [form, isRetake, afterCorePath, intent])

  // LOVE-DEEP submit — partner prefs + attachment + values. Enriches the love
  // profile (best-effort) and lands on the love dashboard.
  const submitLoveDeep = useCallback(async (attachAns: number[], valuesAns: number[], partnerAns: (number | number[])[]) => {
    userIdRef.current = 'done' // prevent the loading screen's result fallback
    setLoveSaveBusy(true)
    try {
      const attach = computeAttachment(attachAns)
      const { relationship_style, partner } = partnerFromAnswers(partnerAns)
      const values_profile = { ...valuesFromAnswers(valuesAns), partner }
      const response = await fetch('/api/quiz/love-deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attach_anxiety: attach.anxiety,
          attach_avoidance: attach.avoidance,
          attach_style: attach.style,
          values_profile,
          relationship_style,
          seeking: form.seek,
          age_min: parseInt(form.ageMin),
          age_max: parseInt(form.ageMax),
        }),
      })
      if (!response.ok) {
        const data = await parseResponse<{ error?: string }>(response)
        throw new Error(data.error || 'Could not save your Love setup')
      }
      setLoveSaveError('')
    } catch (err) {
      console.error('Love-deep submit failed:', err)
      setLoveSaveError('Your answers are still here. We just need to try saving them again.')
    } finally {
      // A finish MOMENT, not an abrupt bounce — the core quiz gets a result
      // reveal; the love-deep deserves its own beat before the dashboard.
      setScreen('love-done')
      setLoveSaveBusy(false)
    }
  }, [form.seek, form.ageMin, form.ageMax])

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

  // love-deep: partner preferences. Single Qs store an index; `multi` Qs store
  // an array of indices (skip = -1 / []).
  const advancePartner = useCallback((ans: number | number[]) => {
    const newAnswers = [...partnerAnswers, ans]
    setPartnerAnswers(newAnswers)
    setPartnerSelected(null)
    setPartnerMulti([])
    if (currentPartnerQ + 1 >= PARTNER_QUESTIONS.length) {
      setScreen('attach-intro') // love chapter 2: how you connect
    } else { setCurrentPartnerQ(q => q + 1) }
  }, [partnerAnswers, currentPartnerQ])
  function togglePartnerMulti(i: number) {
    setPartnerMulti(cur => cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i])
  }
  function nextPartner() {
    const q = PARTNER_QUESTIONS[currentPartnerQ]
    if (q?.multi) { if (partnerMulti.length > 0) advancePartner([...partnerMulti].sort((a, b) => a - b)) }
    else if (partnerSelected !== null) advancePartner(partnerSelected)
  }
  function skipPartner() { advancePartner(PARTNER_QUESTIONS[currentPartnerQ]?.multi ? [] : -1) }

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
          // Fresh signups now ALWAYS land on the result (the payoff + share
          // moment) — the continue button routes onward. Retakes/errors redirect
          // before this fires, in which case navigation has already left.
          setScreen('result')
          setTimeout(() => setBarsVisible(true), 400)
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
          <div className={styles.intentWrap}>
            <div className={styles.introHero}>
              <div className={styles.stickerRow}>
                <span className={styles.sticker}>no swiping</span>
                <span className={styles.stickerGold}>step 1 of 2</span>
              </div>
              <h1 className={styles.introH1}>
                what are you<br />here to <em>find?</em>
              </h1>
              <p className={styles.introLede}>
                Pick a path now. We&apos;ll only show you the setup that path needs—and you can add the other line later.
                <span className={styles.introLedeSub}>one baseline powers both lines.</span>
              </p>
            </div>

            <div className={styles.intentGrid} role="radiogroup" aria-label="Choose what you want from NotCupid">
              {INTENT_OPTIONS.map((option) => {
                const selected = intent === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.intentCard} ${selected ? styles.intentCardSelected : ''}`}
                    onClick={() => setIntent(option.value)}
                  >
                    <span className={styles.intentIcon}>{option.icon}</span>
                    <span className={styles.intentCopy}>
                      <span className={styles.intentEyebrow}>{option.eyebrow}</span>
                      <strong>{option.title}</strong>
                      <span>{option.body}</span>
                      <em>{option.next}</em>
                    </span>
                    <span className={styles.intentCheck}>{selected ? '✓' : '→'}</span>
                  </button>
                )
              })}
            </div>

            <button className="btn-primary" onClick={continueFromIntent} disabled={!intent}
              style={{width:'100%',justifyContent:'center',marginTop:'1rem'}}>
              continue with {intent === 'friends' ? 'Friend Line' : intent === 'love' ? 'Love Line' : intent === 'both' ? 'both lines' : 'your choice'} →
            </button>
            <p className={styles.formNote}>about 4 minutes for your baseline · pause anytime after that</p>
          </div>
        </div>
      )}

      {screen === 'details' && (
        <div className={styles.screen}>
          <div className={styles.introWrap}>
            <div className={styles.detailsHeader}>
              <div className={styles.stickerRow}>
                <span className={styles.stickerGold}>step 2 of 2</span>
                <span className={styles.pathPill}>{intent === 'friends' ? '🧡 Friend Line' : intent === 'love' ? '💘 Love Line' : '✨ both lines'}</span>
              </div>
              <h1 className={styles.detailsTitle}>the basics.<br /><em>nothing weird.</em></h1>
              <p className={styles.detailsLede}>
                This creates your private baseline and keeps recommendations local.
                {friendOnly
                  ? ' Dating preferences stay out of your Friend-first signup.'
                  : ' Love preferences help us avoid showing you people outside your range.'}
              </p>
              <button type="button" className={styles.changePath} onClick={() => setScreen('intro')}>← change my path</button>
            </div>

            <div className={styles.formBlock}>
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
                  <label className={styles.label}>how do you describe yourself?</label>
                  <select className={styles.input} value={form.gender}
                    onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
                    <option value="">—</option>
                    <option value="m">man</option>
                    <option value="f">woman</option>
                    <option value="nb">non-binary</option>
                    <option value="o">another identity</option>
                  </select>
                </div>

                {!friendOnly && (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>who should Love Line show you?</label>
                      <select className={styles.input} value={form.seek}
                        onChange={e => setForm(f=>({...f,seek:e.target.value}))}>
                        <option value="">—</option>
                        <option value="f">women</option>
                        <option value="m">men</option>
                        <option value="b">everyone</option>
                      </select>
                    </div>

                    <div className={`${styles.field} ${styles.fieldFull}`}>
                      <label className={styles.label}>Love match age range</label>
                      <div className={styles.ageRangeWrap}>
                        <input className={styles.input} type="number" placeholder="22" min={18} max={99}
                          value={form.ageMin} onChange={e => setForm(f=>({...f,ageMin:e.target.value}))} style={{flex:1}} />
                        <span className={styles.ageSep}>—</span>
                        <input className={styles.input} type="number" placeholder="35" min={18} max={99}
                          value={form.ageMax} onChange={e => setForm(f=>({...f,ageMax:e.target.value}))} style={{flex:1}} />
                      </div>
                    </div>
                  </>
                )}

                {friendOnly && (
                  <div className={`${styles.friendFirstNote} ${styles.fieldFull}`}>
                    <strong>Friend-first means friend-first.</strong>
                    <span>We&apos;ll ask who you want to meet and what you like doing in the short Friend setup after your baseline.</span>
                  </div>
                )}

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>zip code</label>
                  <div className={styles.zipWrap}>
                    <input className={styles.input} placeholder="02116" maxLength={5}
                      value={form.zip} onChange={e => handleZip(e.target.value)} />
                    {zipStatus === 'valid' && <span className={styles.zipOk}>✓ you're in</span>}
                    {zipStatus === 'outofrange' && <span className={styles.zipBad}>outside range — <a href="/out-of-range" style={{color:'var(--lav)'}}>join waitlist</a></span>}
                    {zipStatus === 'invalid' && <span className={styles.zipBad}>not in our area</span>}
                  </div>
                  {poolPeek && poolPeek.count > 0 && zipStatus === 'valid' && (
                    <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(37,99,255,0.08)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 999, padding: '0.4rem 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-accent)' }}>
                      ✦ {poolPeek.count.toLocaleString()} {poolPeek.count === 1 ? 'person is' : 'people are'} in the {poolPeek.city} experiment{poolPeek.recent > 0 ? ` · ${poolPeek.recent} joined this month` : ''}
                    </div>
                  )}
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>email</label>
                  <input className={styles.input} type="email" placeholder="you@email.com"
                    value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
                  {form.email && !emailValid && (
                    <span className={styles.fieldError}>that doesn't look like an email</span>
                  )}
                  {form.email.includes('@') && (() => {
                    const suggestion = suggestEmailCorrection(form.email)
                    if (!suggestion) return null
                    return (
                      <div style={{fontFamily:"'DM Mono', ui-monospace, monospace",fontSize:'.62rem',letterSpacing:'.06em',color:'var(--h-accent)',marginTop:'.35rem'}}>
                        did you mean{' '}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, email: suggestion }))}
                          style={{background:'rgba(37,99,255,0.15)',border:'1px solid rgba(37,99,255,0.4)',color:'var(--h-accent)',padding:'.15rem .5rem',borderRadius:'4px',fontFamily:'inherit',fontSize:'inherit',cursor:'pointer'}}
                        >
                          {suggestion}
                        </button>
                        {' '}?
                      </div>
                    )
                  })()}
                </div>
              </div>

              <label style={{display:'flex',alignItems:'flex-start',gap:'0.55rem',margin:'0.9rem 0 0.2rem',cursor:'pointer',textAlign:'left'}}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                  style={{width:17,height:17,marginTop:'0.15rem',flexShrink:0,accentColor:'var(--h-accent)'}} />
                <span style={{fontFamily:"'DM Mono', ui-monospace, monospace",fontSize:'0.66rem',letterSpacing:'0.03em',lineHeight:1.5,color:'var(--h-text-dim)'}}>
                  I&apos;m 18 or older and I agree to NotCupid&apos;s{' '}
                  <a href="/terms" target="_blank" style={{color:'var(--h-accent)'}}>Terms</a>,{' '}
                  <a href="/privacy" target="_blank" style={{color:'var(--h-accent)'}}>Privacy Policy</a> &amp;{' '}
                  <a href="/safety" target="_blank" style={{color:'var(--h-accent)'}}>community guidelines</a>.
                </span>
              </label>
              {otpError && <p className={styles.otpError} role="alert">{otpError}</p>}
              <button className="btn-primary" onClick={sendOtp}
                disabled={!formValid || !agreed || otpSending}
                style={{width:'100%',justifyContent:'center',marginTop:'0.5rem'}}>
                {otpSending ? 'sending code...' : 'verify my email →'}
              </button>
              <p className={styles.formNote}>we&apos;ll send one 6-digit code · no password to remember</p>
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
                  aria-label={`Verification code digit ${i + 1}`}
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
              <button className={styles.resendBtn} onClick={() => setScreen('details')}>
                wrong email?
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'save-error' && (
        <div className={styles.screen}>
          <div className={styles.verifyWrap}>
            <div className={styles.verifyTop}>
              <span className={styles.verifyEmoji}>↻</span>
              <h2 className={styles.verifyH2}>your answers are safe.</h2>
              <p className={styles.verifySub}>
                {isRetake
                  ? 'We couldn’t update your baseline. Try saving again without redoing the quiz.'
                  : 'We couldn’t save your baseline. Request a fresh code and we’ll retry without making you redo the quiz.'}
              </p>
            </div>
            {otpError && <p className={styles.otpError} role="alert">{otpError}</p>}
            {isRetake ? (
              <button className="btn-primary" disabled={!archetype}
                onClick={() => {
                  if (!archetype) return
                  setCoreSaveError(false)
                  void submitCore(scores, archetype, vibeAnswers, rapidAnswers)
                }}
                style={{width:'100%',justifyContent:'center'}}>
                try saving again →
              </button>
            ) : (
              <button className="btn-primary" onClick={sendOtp} disabled={otpSending}
                style={{width:'100%',justifyContent:'center'}}>
                {otpSending ? 'sending code…' : 'send a fresh code →'}
              </button>
            )}
          </div>
        </div>
      )}

      {screen === 'love-preferences' && (
        <div className={styles.screen}>
          <div className={styles.introWrap}>
            <div className={styles.detailsHeader}>
              <div className={styles.stickerRow}>
                <span className={styles.sticker}>💘 Love Line</span>
                <span className={styles.stickerGold}>before matching</span>
              </div>
              <h1 className={styles.detailsTitle}>who should we<br /><em>look for?</em></h1>
              <p className={styles.detailsLede}>Your Friend setup never needed dating preferences. Love Line does—so let&apos;s set them now.</p>
            </div>
            <div className={styles.formBlock}>
              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>show me</label>
                  <select className={styles.input} value={form.seek}
                    onChange={e => setForm(f => ({ ...f, seek: e.target.value }))}>
                    <option value="">—</option>
                    <option value="f">women</option>
                    <option value="m">men</option>
                    <option value="b">everyone</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label}>match age range</label>
                  <div className={styles.ageRangeWrap}>
                    <input className={styles.input} type="number" min={18} max={99}
                      value={form.ageMin} onChange={e => setForm(f => ({ ...f, ageMin: e.target.value }))} style={{flex:1}} />
                    <span className={styles.ageSep}>—</span>
                    <input className={styles.input} type="number" min={18} max={99}
                      value={form.ageMax} onChange={e => setForm(f => ({ ...f, ageMax: e.target.value }))} style={{flex:1}} />
                  </div>
                </div>
              </div>
              <button className="btn-primary" disabled={!loveDeepPreferenceValid}
                onClick={() => setScreen('partner-intro')}
                style={{width:'100%',justifyContent:'center',marginTop:'0.9rem'}}>
                continue → what you want
              </button>
              <p className={styles.formNote}>private · editable later · used only for Love Line</p>
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

            {/* keyed by question index so each step slides in instead of hard-cutting */}
            <div key={currentQ} className={styles.qStep}>
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
          onSkip={() => { window.location.href = nextIntent === 'friends' ? '/friends/quiz' : '/dashboard' }}
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
            {PARTNER_QUESTIONS[currentPartnerQ].hint && (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563ff', margin: '-0.4rem 0 0.9rem' }}>
                ⚡ {PARTNER_QUESTIONS[currentPartnerQ].hint}
              </p>
            )}
            <div className={styles.qOptions}>
              {PARTNER_QUESTIONS[currentPartnerQ].opts.map((opt, i) => {
                const isMulti = !!PARTNER_QUESTIONS[currentPartnerQ].multi
                const on = isMulti ? partnerMulti.includes(i) : partnerSelected === i
                return (
                  <button key={i}
                    className={`${styles.qOpt} ${on ? styles.qOptSelected : ''}`}
                    onClick={() => (isMulti ? togglePartnerMulti(i) : setPartnerSelected(i))}>
                    <span className={styles.qKey}>{isMulti ? (on ? '✓' : '+') : String.fromCharCode(65 + i)}</span>
                    <span className={styles.qOptText}>{opt}</span>
                  </button>
                )
              })}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={skipPartner}>skip this one</button>
              <button className="btn-primary" onClick={nextPartner} disabled={PARTNER_QUESTIONS[currentPartnerQ].multi ? partnerMulti.length === 0 : partnerSelected === null}>
                {PARTNER_QUESTIONS[currentPartnerQ].multi && partnerMulti.length > 0 ? `next (${partnerMulti.length}) →` : 'next →'}
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
            <p className={styles.loadingSub}>turning your answers into one baseline for the path you chose.</p>
            <div className={styles.loadingBarWrap}>
              <div className={styles.loadingBar} style={{width:`${loadingPct}%`}} />
            </div>
            <p className={styles.loadingStatus}>{LOADING_MSGS[Math.min(loadingStep, LOADING_MSGS.length-1)]}</p>
          </div>
        </div>
      )}

      {screen === 'love-done' && (
        <div className={styles.screen}>
          <div className={styles.introWrap} style={{ textAlign: 'center' }}>
            {loveSaveError ? (
              <>
                <div style={{ fontSize: '2.6rem', marginBottom: '0.8rem' }}>↻</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--h-accent-2)', marginBottom: '0.9rem' }}>save interrupted</div>
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(1.9rem, 7vw, 2.6rem)', lineHeight: 1.08, margin: '0 0 0.9rem' }}>nothing was lost.</h1>
                <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.6rem' }}>{loveSaveError}</p>
                <button className="btn-primary" disabled={loveSaveBusy} onClick={() => submitLoveDeep(attachAnswers, valuesAnswers, partnerAnswers)} style={{ width: '100%', justifyContent: 'center' }}>
                  {loveSaveBusy ? 'saving…' : 'try saving again →'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.6rem', marginBottom: '0.8rem', animation: 'fadeUp 0.45s ease both' }}>💘</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '0.9rem', animation: 'fadeUp 0.45s ease 0.12s both' }}>love profile complete</div>
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(1.9rem, 7vw, 2.6rem)', lineHeight: 1.08, margin: '0 0 0.9rem', animation: 'fadeUp 0.45s ease 0.24s both' }}>
                  your Love profile<br />has a clearer <em style={{ color: 'var(--blue)', fontWeight: 700 }}>signal.</em>
                </h1>
                <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.6rem', animation: 'fadeUp 0.45s ease 0.36s both' }}>
                  How you connect and what you value now shape your roster. You can tune these preferences anytime.
                </p>
                <button className="btn-primary" onClick={() => { window.location.href = nextIntent === 'friends' ? '/friends/quiz' : '/dashboard' }} style={{ width: '100%', justifyContent: 'center', animation: 'fadeUp 0.45s ease 0.5s both' }}>
                  {nextIntent === 'friends' ? 'continue → Friend setup' : 'see your Love Line →'}
                </button>
              </>
            )}
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

            {postQuizPath && (
              <button className="btn-primary"
                onClick={() => { window.location.href = postQuizPath }}
                style={{margin:'0 0 1rem',width:'100%',justifyContent:'center'}}>
                {postQuizPath === '/friends/quiz' ? 'continue → Friend setup'
                  : postQuizPath.includes('line=love') ? 'continue → Love setup'
                  : 'continue → your hub'}
              </button>
            )}

            {/* share your type — the viral surface (unfurls the OG card) */}
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/type/${typeSlug(archetype.name)}`
                try {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share({ title: `I'm ${archetype.name}`, text: `the NotCupid algorithm says I'm ${archetype.name}. find your type:`, url })
                  } else {
                    await navigator.clipboard.writeText(url)
                    toast('link copied — post your type ✦', 'success')
                  }
                } catch { /* share sheet closed */ }
              }}
              style={{ display: 'block', margin: '0.9rem auto 0', background: 'transparent', border: '1.5px solid var(--h-border)', color: 'var(--h-text)', borderRadius: 999, padding: '0.7rem 1.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              ↗ share your type
            </button>
            <a href="/types" target="_blank" style={{ display: 'block', textAlign: 'center', marginTop: '0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-faint)', textDecoration: 'underline', textUnderlineOffset: 3 }}>see all the types →</a>

            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <span className={styles.profileTitle}>your hexaco profile</span>
                <span className={styles.profileLock}>🔒 full breakdown on your profile</span>
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
                          color:'var(--h-accent)',
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
              <div className={styles.matchBadge}>baseline complete ✓</div>
              <p className={styles.matchTitle}>one step at a time.</p>
              <p className={styles.matchDesc}>
                {intent === 'friends'
                  ? 'Next is a short Friend setup about how you like to spend time. Then we can introduce people and plans that fit.'
                  : intent === 'both'
                    ? 'Next we finish your Love setup, then your Friend setup. Each line stays separate, and you can pause between them.'
                    : intent === 'love'
                      ? 'Next is a focused Love setup about what you want and how you connect. Then your five curated options can open.'
                      : 'Your baseline is ready. Open the Hub whenever you want to choose a line.'}
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

    </>
  )
}
