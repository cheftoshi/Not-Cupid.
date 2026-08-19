import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { hashOtp } from '@/lib/otp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Normalize inputs
    const email = (body.email || '').trim().toLowerCase()
    const code = (body.code || '').toString().trim().replace(/\s+/g, '')

    if (!email || email.length > 254 || !code) {
      return NextResponse.json({ error: 'Missing email or code' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 })
    }
    const codeHash = hashOtp(email, code)

    // Brute-force protection: 6 verify attempts per email per 15 min, then 15-min lockout.
    // Also IP-level so a single attacker can't sweep many emails.
    const ip = getClientIp(req)
    const emailLimit = await rateLimit({ key: `otp_verify_email:${email}`, windowSec: 900, maxAttempts: 6, blockSec: 900 })
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Request a new code.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSec) } }
      )
    }
    // Loose per-IP cap for shared mobile/CGNAT IPs during a launch surge;
    // the 6-per-email cap above is the real brute-force guard.
    const ipLimit = await rateLimit({ key: `otp_verify_ip:${ip}`, windowSec: 900, maxAttempts: 80, blockSec: 900 })
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } }
      )
    }

    // Look for matching unverified code (use limit instead of single to avoid throws)
    const { data: codes, error: lookupErr } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', codeHash)
      .order('created_at', { ascending: false })
      .limit(1)

    if (lookupErr) {
      console.error('OTP lookup error:', lookupErr)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const otp = codes?.[0]

    if (!otp) {
      // Check if maybe it was already verified (different error message)
      const { data: usedCode } = await supabaseAdmin
        .from('otp_codes')
        .select('verified')
        .eq('email', email)
        .eq('code', codeHash)
        .limit(1)
        .maybeSingle()

      if (usedCode?.verified) {
        return NextResponse.json({ error: 'This code was already used. Request a new one.' }, { status: 400 })
      }

      return NextResponse.json({ error: 'Invalid code. Check the email and code, or request a new one.' }, { status: 400 })
    }

    if (otp.verified) {
      return NextResponse.json({ error: 'This code was already used. Request a new one.' }, { status: 400 })
    }

    if (new Date(otp.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 })
    }

    // Mark this specific code as verified (and any others for this email)
    await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('email', email)

    // Look up user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, archetype, is_blocked')
      .ilike('email', email)         // case-insensitive
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!user) {
      // Brand-new user (no row yet). They take the core personality quiz first
      // — it powers BOTH lines (the Friend Line reuses these HEXACO scores).
      // /api/submit creates their row + session, then routes them to /hub (the
      // line chooser) to board Love and/or Friend. Returning 200 (not 404).
      return NextResponse.json({
        success: true,
        needsQuiz: true,
        redirect: '/quiz',
      })
    }

    if (user.is_blocked) {
      return NextResponse.json({ error: 'This account is unavailable.' }, { status: 403 })
    }

    await createSession(user.id)
    await supabaseAdmin.from('otp_codes').delete().eq('email', email)

    // Existing user. If they've completed the quiz → /hub. If they
    // signed up but never finished the quiz → /quiz?retake=1 so the
    // retake flow updates their row instead of trying to insert a
    // duplicate via /api/submit.
    return NextResponse.json({
      success: true,
      redirect: user.archetype ? '/hub' : '/quiz?retake=1',
      // Existing completed members get the one-time, non-destructive profile
      // upgrade flow. Incomplete accounts still go straight back to the quiz.
      returning: !!user.archetype,
    })
  } catch (err) {
    console.error('Verify OTP error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
