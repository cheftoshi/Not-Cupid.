import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { renderEmail, sendEmail, infoCard } from '@/lib/email'
import { hashOtp } from '@/lib/otp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    // Reserved documentation domains cannot receive a real sign-in code.
    const domain = email.split('@')[1] || ''
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || /^(?:.*\.)?example\.(?:com|net|org)$/.test(domain)
      || /(?:^|\.)(?:invalid|test|localhost)$/.test(domain)) {
      return NextResponse.json({ error: 'Enter a valid email address that can receive mail.', code: 'invalid_email' }, { status: 400 })
    }

    // Rate limit by email and IP to prevent email-bombing.
    // 3 sends per email per 10 min, 40 sends per IP per 10 min.
    const ip = getClientIp(req)
    const emailLimit = await rateLimit({ key: `otp_send_email:${email}`, windowSec: 600, maxAttempts: 3, blockSec: 600 })
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: `Too many codes sent. Try again in ${emailLimit.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSec) } }
      )
    }
    // Per-IP cap is loose (shared mobile/CGNAT IPs route many real users
    // through one address — common during a launch surge). The per-email
    // cap above is the real abuse guard.
    const ipLimit = await rateLimit({ key: `otp_send_ip:${ip}`, windowSec: 600, maxAttempts: 40, blockSec: 600 })
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${ipLimit.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } }
      )
    }

    // Cryptographically secure 6-digit OTP (Math.random is predictable).
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    // Never log the OTP — Vercel logs are accessible to anyone with project access.

    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert(
        { email, code: hashOtp(email, otp), expires_at: expiresAt, verified: false },
        { onConflict: 'email' }
      )

    if (dbError) {
      console.error('send-otp: storage unavailable')
      return NextResponse.json({ error: 'Could not issue a verification code' }, { status: 500 })
    }

    const html = renderEmail({
      preheader: `Your NotCupid verification code is ${otp}. Expires in 15 minutes.`,
      eyebrow: 'verification code',
      headline: 'Tap in.',
      bodyHtml: `
        <p style="margin:0 0 8px 0;">Use this code to log in. Don't share it with anyone.</p>
        ${infoCard({ big: otp, sub: 'expires in 15 minutes' })}
        <p style="margin:8px 0 0 0;font-size:13px;">If you didn't ask for this, just ignore the email — nothing happens.</p>
      `,
      footerNote: 'one-time code, never asked for over chat.',
    })

    const sent = await sendEmail({ to: email, subject: 'Your NotCupid code', html })
    if (!sent.ok) {
      return NextResponse.json({ error: 'We could not deliver a code. Check your email address and try again shortly.', code: 'delivery_unavailable' }, { status: 503 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-otp: request failed')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
