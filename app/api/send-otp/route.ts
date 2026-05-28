import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { renderEmail, sendEmail, infoCard } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Normalize email
    const email = (body.email || '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Basic format check - catches obvious typos before we waste a Resend send
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Rate limit by email and IP to prevent email-bombing.
    // 3 sends per email per 10 min, 10 sends per IP per 10 min.
    const ip = getClientIp(req)
    const emailLimit = await rateLimit({ key: `otp_send_email:${email}`, windowSec: 600, maxAttempts: 3, blockSec: 600 })
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: `Too many codes sent. Try again in ${emailLimit.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSec) } }
      )
    }
    const ipLimit = await rateLimit({ key: `otp_send_ip:${ip}`, windowSec: 600, maxAttempts: 10, blockSec: 600 })
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
        { email, code: otp, expires_at: expiresAt, verified: false },
        { onConflict: 'email' }
      )

    if (dbError) {
      console.error('Supabase insert error:', JSON.stringify(dbError))
      return NextResponse.json({ error: 'DB error', details: dbError.message }, { status: 500 })
    }
    console.log('OTP saved to DB successfully')

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
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
