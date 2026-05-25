import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const { data: expiredMatches } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', cutoff)

    if (!expiredMatches || expiredMatches.length === 0) {
      return NextResponse.json({ message: 'No expired matches' })
    }

    const reshuffled = []

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

    return NextResponse.json({
      success: true,
      reshuffled: reshuffled.length,
      matchIds: reshuffled
    })
  } catch (err) {
    console.error('Rematch cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
