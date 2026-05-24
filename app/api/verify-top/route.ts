import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 })
    }

    await supabaseAdmin.from('otp_codes').update({ verified: true }).eq('email', email)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Verify OTP error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
