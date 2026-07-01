import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'
import { metroOf } from '@/lib/quiz-data'
import { metroGenderCounts, shouldHoldForBalance } from '@/lib/balance'
import { renderEmail, sendEmail, button, C } from '@/lib/email'

async function sendCoreCompletionEmail(user: { id: string; email: string; name?: string | null; archetype?: string | null }, held: boolean) {
  if (!user.email) return
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const first = (user.name || 'there').split(' ')[0]
  const html = renderEmail({
    preheader: held
      ? 'Your NotCupid profile is complete. We’ll open your roster as the local pool balances.'
      : 'Your NotCupid profile is complete. Choose Love, Friend, or both from the Hub.',
    eyebrow: 'profile complete',
    headline: `${first}, you're in.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">Your core profile is live. This is the baseline that powers both lines: Love for dating, Friend for plans, crews, and people you might actually click with.</p>
      ${user.archetype ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.lavSoft};border-radius:10px;margin:16px 0;"><tr><td style="padding:18px 20px;"><div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.16em;text-transform:uppercase;margin-bottom:6px;">your starting signal</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${C.ink};line-height:1.1;">${user.archetype}</div></td></tr></table>` : ''}
      <p style="margin:0 0 18px 0;">Next step: open the Hub and choose where you want to start today. No swiping. No endless browsing. Just a smaller set of real openings.</p>
      ${button({ href: `${base}/hub`, label: 'open your hub →' })}
      ${held ? `<p style="margin:16px 0 0 0;font-size:13px;color:${C.muted};">Small note: your local roster may open a little slower while we keep the pool balanced. Your profile is still complete and ready.</p>` : ''}
    `,
    recipientId: user.id,
    footerNote: 'meet people. not profiles.',
  })
  await sendEmail({ to: user.email, subject: "You're in — your NotCupid profile is ready", html })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, age, gender, seeking, zip, email,
      age_min, age_max,
      score_honesty, score_emotionality, score_extraversion,
      score_agreeableness, score_conscientiousness, score_openness,
      archetype,
      vibes,
      relationship_style,
      attach_anxiety, attach_avoidance, attach_style, values_profile,
    } = body

    const VALID_RELATIONSHIP_STYLES = new Set([
      'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
    ])

    if (!name || !age || !gender || !seeking || !zip || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Proof of email ownership: there must be a verified OTP for this email.
    // (Without this, a script could POST here to create an account + get a
    // session cookie for ANY email — account creation with no email proof.)
    const { data: verifiedOtp } = await supabaseAdmin
      .from('otp_codes')
      .select('id')
      .eq('email', email)
      .eq('verified', true)
      .limit(1)
      .maybeSingle()
    if (!verifiedOtp) {
      return NextResponse.json({ error: 'Please verify your email first.' }, { status: 403 })
    }

    // Server-side validation (don't trust the client): bound everything that
    // gets written, so oversized junk / out-of-range scores can't be stored.
    const ageNum = parseInt(age)
    if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 120) {
      return NextResponse.json({ error: 'Invalid age' }, { status: 400 })
    }
    if (!/^\d{5}$/.test(String(zip).trim())) {
      return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 })
    }
    const cleanName = String(name).trim().slice(0, 100)
    if (!cleanName) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    // HEXACO dimensions are 0–16 (4 questions × 4 pts); clamp so a tampered
    // client can't store fake personality scores that skew matching.
    const clampScore = (v: any) => Math.max(0, Math.min(8, Number(v) || 0)) // 2 questions/dim × 4 = max 8
    const clampAge = (v: any, d: number) => { const n = parseInt(v); return Number.isFinite(n) ? Math.max(18, Math.min(120, n)) : d }

    const insertRow: any = {
      name: cleanName, age: ageNum, gender, seeking, zip: String(zip).trim(), email,
      age_min: clampAge(age_min, 18), age_max: clampAge(age_max, 99),
      score_honesty: clampScore(score_honesty), score_emotionality: clampScore(score_emotionality),
      score_extraversion: clampScore(score_extraversion), score_agreeableness: clampScore(score_agreeableness),
      score_conscientiousness: clampScore(score_conscientiousness), score_openness: clampScore(score_openness),
      archetype: archetype ? String(archetype).slice(0, 80) : archetype, status: 'waiting',
    }
    if (vibes && typeof vibes === 'object') insertRow.vibes = vibes
    if (relationship_style && VALID_RELATIONSHIP_STYLES.has(relationship_style)) {
      insertRow.relationship_style = relationship_style
    }
    // Quiz v2: attachment (0–100) + values profile.
    const clamp100 = (v: any) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
    if (attach_anxiety != null) insertRow.attach_anxiety = clamp100(attach_anxiety)
    if (attach_avoidance != null) insertRow.attach_avoidance = clamp100(attach_avoidance)
    if (['secure', 'anxious', 'avoidant', 'fearful'].includes(attach_style)) insertRow.attach_style = attach_style
    if (values_profile && typeof values_profile === 'object') insertRow.values_profile = values_profile

    let { data, error } = await supabaseAdmin
      .from('users')
      .insert([insertRow])
      .select().single()

    // Graceful fallback: if the quiz-v2 columns aren't migrated yet, retry
    // without them so signup never breaks (run 20260609_quiz_v2.sql to activate).
    if (error && /attach_|values_profile|column|schema cache/i.test(error.message || '') && error.code !== '23505') {
      delete insertRow.attach_anxiety; delete insertRow.attach_avoidance; delete insertRow.attach_style; delete insertRow.values_profile
      console.warn('Submit: quiz-v2 columns missing — run 20260609 migration. Saving without them.')
      ;({ data, error } = await supabaseAdmin.from('users').insert([insertRow]).select().single())
    }

if (error) {
  if (error.code === '23505') {
    // Expected, handled case — client looks up the existing user and
    // redirects to their dashboard. Logged as warn (not error) so real
    // failures stand out in Vercel logs.
    console.warn('Submit: duplicate email, redirecting to existing account', { email })
    return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  }
  console.error('Submit: supabase error:', error)
  return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
}
    // Gender-balance intake gate: if this signup would push their metro's
    // active pool past the ratio ceiling, hold them in a soft "early access"
    // state (pool_active=false) instead of matching. The cron releases them
    // as the scarce side joins, or after a 3-day cap. They just see the normal
    // positive "in the queue" state — no negative messaging.
    let held = false
    try {
      const counts = await metroGenderCounts()
      const metro = metroOf(data.zip) ?? 'unknown'
      if (shouldHoldForBalance(counts[metro], data.gender)) {
        await supabaseAdmin
          .from('users')
          .update({ pool_active: false, balance_hold_at: new Date().toISOString() })
          .eq('id', data.id)
        held = true
      }
    } catch (e) {
      console.error('Submit: balance gate check failed (matching anyway):', e)
    }

    // Log the new user in. Without this, a brand-new signup had no session,
    // so when the quiz redirected them to /dashboard, getCurrentUser() was
    // null → bounced to "/" — i.e. "I registered but it didn't work." Now
    // they land on the dashboard authenticated. (verify-otp doesn't create a
    // session for not-yet-existing users, so this is the only place to do it.)
    try {
      await createSession(data.id)
    } catch (e) {
      console.error('Submit: createSession failed (user saved, not logged in):', e)
    }

    // Roster-first: we no longer auto-assign a single match on signup. Unless
    // they were balance-held (pool_active=false), the user lands on the
    // dashboard and picks from their top ~5 (GET /api/match/roster → /pick).
    await sendCoreCompletionEmail({
      id: data.id,
      email: data.email,
      name: data.name,
      archetype: data.archetype,
    }, held).catch((e) => console.error('Submit: completion email failed', e))

    return NextResponse.json({ success: true, userId: data.id, held })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
