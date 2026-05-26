import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'

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

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, archetype')
      .eq('email', email)
      .is('deleted_at', null)
      .single()

    if (!user) {
      return NextResponse.json({
        error: "No profile yet — take the quiz to sign up",
        needsQuiz: true,
      }, { status: 404 })
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
