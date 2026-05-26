import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const nowIso = new Date().toISOString()

    // ============== PART 1: NEW — Auto-end active chats whose timer expired ==============
    const { data: expiredChats } = await supabaseAdmin
      .from('matches')
      .update({
        status: 'ended',
        ended_at: nowIso,
        ended_reason: 'expired',
      })
      .eq('status', 'active')
      .lt('chat_expires_at', nowIso)
      .select('id, user_1_id, user_2_id')

    console.log(`Auto-ended ${expiredChats?.length || 0} expired chats`)

    if (expiredChats && expiredChats.length > 0) {
      // Add to match_history to prevent re-matching the same pair
      const historyRows = expiredChats.map((m) => {
        const sorted = [m.user_1_id, m.user_2_id].sort()
        return {
          user_a_id: sorted[0],
          user_b_id: sorted[1],
          match_id: m.id,
          outcome: 'expired',
        }
      })
      await supabaseAdmin
        .from('match_history')
        .upsert(historyRows, { onConflict: 'user_a_id,user_b_id' })

      // Reshuffle users from expired chats (if auto_rematch enabled)
      for (const chat of expiredChats) {
        const { data: u1 } = await supabaseAdmin
          .from('users').select('auto_rematch').eq('id', chat.user_1_id).single()
        const { data: u2 } = await supabaseAdmin
          .from('users').select('auto_rematch').eq('id', chat.user_2_id).single()

        if (u1?.auto_rematch !== false) {
          await supabaseAdmin
            .from('users')
            .update({ status: 'waiting' })
            .eq('id', chat.user_1_id)
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: chat.user_1_id })
          })
        }
        if (u2?.auto_rematch !== false) {
          await supabaseAdmin
            .from('users')
            .update({ status: 'waiting' })
            .eq('id', chat.user_2_id)
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: chat.user_2_id })
          })
        }
      }
    }
    // ============== END auto-expire ==============

    // ============== PART 2: ORIGINAL — Expire pending matches older than 48h ==============
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: expiredMatches } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', cutoff)

    const reshuffled: string[] = []
    if (expiredMatches && expiredMatches.length > 0) {
      for (const match of expiredMatches) {
        await supabaseAdmin
          .from('matches')
          .update({ status: 'expired' })
          .eq('id', match.id)

        // Only put back users who haven't opted out
        const { data: user1 } = await supabaseAdmin
          .from('users').select('auto_rematch').eq('id', match.user_1_id).single()
        const { data: user2 } = await supabaseAdmin
          .from('users').select('auto_rematch').eq('id', match.user_2_id).single()

        if (user1?.auto_rematch !== false) {
          await supabaseAdmin
            .from('users')
            .update({ status: 'waiting' })
            .eq('id', match.user_1_id)
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: match.user_1_id })
          })
        }
        if (user2?.auto_rematch !== false) {
          await supabaseAdmin
            .from('users')
            .update({ status: 'waiting' })
            .eq('id', match.user_2_id)
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: match.user_2_id })
          })
        }
        reshuffled.push(match.id)
      }
    }

    return NextResponse.json({
      success: true,
      chatsExpired: expiredChats?.length || 0,
      pendingExpired: reshuffled.length,
      matchIds: reshuffled,
    })
  } catch (err) {
    console.error('Rematch cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
