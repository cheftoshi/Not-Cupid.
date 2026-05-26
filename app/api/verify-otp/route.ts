import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Normalize inputs
    const email = (body.email || '').trim().toLowerCase()
    const code = (body.code || '').toString().trim().replace(/\s+/g, '')
    
    if (!email || !code) {
      return NextResponse.json({ error: 'Missing email or code' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 })
    }

    // Look for matching unverified code (use limit instead of single to avoid throws)
    const { data: codes, error: lookupErr } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
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
        .eq('code', code)
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
      .select('id, archetype')
      .ilike('email', email)         // case-insensitive
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!user) {
      // Return 200, not 404 — this is a successful verification, just no profile yet
      return NextResponse.json({
        success: true,
        needsQuiz: true,
        redirect: '/quiz',
      })
    }

    await createSession(user.id)

    return NextResponse.json({
      success: true,
      redirect: user.archetype ? '/profile' : '/quiz',
    })
  } catch (err: any) {
    console.error('Verify OTP error:', err)
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 })
  }
}
