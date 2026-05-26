import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchId = params.id

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }
  if (match.status === 'ended') {
    return NextResponse.json({ success: true, alreadyEnded: true })
  }

  const now = new Date().toISOString()

  const { error: matchError } = await supabaseAdmin
    .from('matches')
    .update({
      status: 'ended',
      ended_at: now,
      ended_reason: 'user_ended',
      chat_expires_at: now,
    })
    .eq('id', matchId)

  if (matchError) {
    console.error('End match error:', matchError)
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  // Add to match_history to prevent re-matching (canonical ordering: a < b)
  const [aId, bId] = [match.user_1_id, match.user_2_id].sort()
  await supabaseAdmin.from('match_history').upsert(
    {
      user_a_id: aId,
      user_b_id: bId,
      match_id: matchId,
      outcome: 'ended',
    },
    { onConflict: 'user_a_id,user_b_id' }
  )

  return NextResponse.json({ success: true })
}
