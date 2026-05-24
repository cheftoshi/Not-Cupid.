import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Find matches older than 48 hours still pending
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
      // Mark match as expired
      await supabaseAdmin
        .from('matches')
        .update({ status: 'expired' })
        .eq('id', match.id)

      // Put both users back in pool
      await supabaseAdmin
        .from('users')
        .update({ status: 'waiting' })
        .in('id', [match.user_1_id, match.user_2_id])

      // Trigger rematching for both
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      await Promise.all([
        fetch(`${siteUrl}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: match.user_1_id })
        }),
        fetch(`${siteUrl}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: match.user_2_id })
        })
      ])

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
