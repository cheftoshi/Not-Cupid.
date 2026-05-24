import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const { data: user } = await supabaseAdmin
      .from('users').select('id').eq('email', email).single()

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ userId: user.id })
  } catch (err) {
    console.error('Get user error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
