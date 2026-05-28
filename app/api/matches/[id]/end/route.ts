import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Reason = 'ghosted' | 'not_vibing' | 'user_ended'
const VALID_REASONS: Reason[] = ['ghosted', 'not_vibing', 'user_ended']

const COOLDOWN_DAYS = 7
const GHOST_REPORTS_BAN_THRESHOLD = 3

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* end with no body is OK */ }

  const reason: Reason = VALID_REASONS.includes(body?.reason) ? body.reason : 'user_ended'

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

  const targetId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id
  const bothAccepted = !!(match.user_1_accepted && match.user_2_accepted)
  const now = new Date().toISOString()

  // End the match
  const { error: matchError } = await supabaseAdmin
    .from('matches')
    .update({
      status: 'ended',
      ended_at: now,
      ended_reason: reason,
      chat_expires_at: now,
    })
    .eq('id', matchId)

  if (matchError) {
    console.error('End match error:', matchError)
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  // Record end_reports row (admin moderation context, always)
  await supabaseAdmin.from('end_reports').insert({
    match_id: matchId,
    reporter_id: user.id,
    target_id: targetId,
    reason,
  })

  // Add to match_history to prevent re-matching
  const [aId, bId] = [match.user_1_id, match.user_2_id].sort()
  await supabaseAdmin.from('match_history').upsert(
    { user_a_id: aId, user_b_id: bId, match_id: matchId, outcome: reason },
    { onConflict: 'user_a_id,user_b_id' }
  )

  if (reason === 'ghosted') {
    // Only count ghost reports if the match actually reached mutual acceptance —
    // prevents weaponizing the report against people who simply passed.
    if (bothAccepted) {
      const { data: target } = await supabaseAdmin
        .from('users')
        .select('ghost_reports_received, matching_disabled_at')
        .eq('id', targetId)
        .single()

      const newCount = (target?.ghost_reports_received ?? 0) + 1
      const updates: any = { ghost_reports_received: newCount }

      if (newCount >= GHOST_REPORTS_BAN_THRESHOLD && !target?.matching_disabled_at) {
        updates.matching_disabled_at = now
      } else {
        updates.matching_cooldown_until = new Date(Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
      }

      await supabaseAdmin.from('users').update(updates).eq('id', targetId)
    }
  }

  return NextResponse.json({ success: true })
}
