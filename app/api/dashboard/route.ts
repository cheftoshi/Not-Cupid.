import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: user, error } = await supabaseAdmin
      .from('users').select('*').eq('id', id).single()
    if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    let match = null
    if (user.status === 'matched') {
      const { data: matchData } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`user_1_id.eq.${id},user_2_id.eq.${id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (matchData) {
        const otherId = matchData.user_1_id === id ? matchData.user_2_id : matchData.user_1_id
        const { data: other } = await supabaseAdmin
          .from('users').select('name').eq('id', otherId).single()
        match = {
          compatibility_score: matchData.compatibility_score,
          match_name: other?.name ?? 'Your match',
          status: matchData.status
        }
      }
    }

    return NextResponse.json({ user, match })
  } catch (err) {
    console.error('Dashboard error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
