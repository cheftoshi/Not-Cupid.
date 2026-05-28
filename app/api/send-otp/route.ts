import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NotCupid <match@notcupid.com>',
        to: [email],
        subject: 'Your NotCupid verification code',
        html: `
          <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:2rem;background:#f8f5ff;">
            <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
            <p style="font-size:.9rem;color:#7a7590;margin-bottom:1.5rem;line-height:1.65">Your verification code. Don't share it.</p>
            <div style="font-size:2.5rem;font-weight:700;letter-spacing:.3em;color:#0e0c1a;background:#ede9ff;padding:1.5rem;text-align:center;margin-bottom:1.5rem">${otp}</div>
            <p style="font-size:.75rem;color:#c8c4dc;line-height:1.65">Expires in 15 minutes.</p>
            <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.7rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">Boston only · notcupid.com</div>
          </div>
        `
      })
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
