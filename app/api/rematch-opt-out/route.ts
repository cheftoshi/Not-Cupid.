import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, optOut } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    await supabaseAdmin
      .from('users')
      .update({ auto_rematch: !optOut })
      .eq('id', userId)

    return NextResponse.json({ success: true, auto_rematch: !optOut })
  } catch (err) {
    console.error('Opt out error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
