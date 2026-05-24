import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabaseAdmin.from('otp_codes').upsert({
      email,
      code: otp,
      expires_at: expiresAt,
      verified: false
    }, { onConflict: 'email' })

    console.log(`OTP for ${email}: ${otp}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
