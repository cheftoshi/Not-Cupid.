import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabaseAdmin.from('otp_codes').upsert({
      email, code: otp, expires_at: expiresAt, verified: false
    }, { onConflict: 'email' })

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
            <p style="font-size:.75rem;color:#c8c4dc;line-height:1.65">Expires in 15 minutes. If you didn't request this, ignore it.</p>
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
