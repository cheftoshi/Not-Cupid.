import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Returns ONLY the authenticated caller's own dashboard data.
// (Previously took a client-supplied ?id= and returned any user's full row —
// email, ZIP, orientation, scores, photos. That was an unauthenticated IDOR.)
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let match = null
  if (user.status === 'matched') {
    const { data: matchData } = await supabaseAdmin
      .from('matches')
      .select('*')
      .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (matchData) {
      const otherId = matchData.user_1_id === user.id ? matchData.user_2_id : matchData.user_1_id
      const { data: other } = await supabaseAdmin
        .from('users').select('name').eq('id', otherId).single()
      match = {
        compatibility_score: matchData.compatibility_score,
        match_name: other?.name ?? 'Your match',
        status: matchData.status,
      }
    }
  }

  return NextResponse.json({ user, match })
}
