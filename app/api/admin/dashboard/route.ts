import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

// Count-only helper — `head:true` transfers ZERO rows, just the count. This is
// what keeps the admin dashboard from loading the entire users/matches tables
// into memory (it used to `select('*')` everything and tally in JS, which would
// OOM/timeout once the tables get large).
async function countUsers(filter?: (q: any) => any): Promise<number> {
  let q = supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count } = await q
  return count ?? 0
}
async function countMatches(filter?: (q: any) => any): Promise<number> {
  let q = supabaseAdmin.from('matches').select('id', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count } = await q
  return count ?? 0
}

export async function GET(_req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      totalUsers, men, women, bi, waiting, matched,
      totalMatches, bothAccepted, passed, pendingMatches,
      unlocksCount,
      recentUsersRes, recentMatchesRes, weekSignupsRes,
    ] = await Promise.all([
      countUsers(),
      countUsers((q) => q.eq('gender', 'm')),
      countUsers((q) => q.eq('gender', 'f')),
      countUsers((q) => q.eq('gender', 'b')),
      countUsers((q) => q.eq('status', 'waiting')),
      countUsers((q) => q.eq('status', 'matched')),
      countMatches(),
      countMatches((q) => q.eq('user_1_accepted', true).eq('user_2_accepted', true)),
      countMatches((q) => q.or('status.eq.passed,ended_reason.eq.one_passed')),
      countMatches((q) => q.eq('status', 'pending').is('ended_at', null)),
      // Revenue proxy: each unlock row ≈ $0.99 (legacy ledger).
      supabaseAdmin.from('unlocks').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users')
        .select('name, email, gender, seeking, zip, status, created_at')
        .order('created_at', { ascending: false }).limit(15),
      supabaseAdmin.from('matches')
        .select('id, compatibility_score, status, user_1_accepted, user_2_accepted, created_at')
        .order('created_at', { ascending: false }).limit(15),
      // Only the last week of signups for the daily chart — bounded, not the whole table.
      supabaseAdmin.from('users').select('created_at').gte('created_at', weekAgoIso),
    ])

    const totalRevenue = ((unlocksCount.count ?? 0) * 0.99).toFixed(2)
    const decided = bothAccepted + passed
    const passRate = decided > 0 ? Math.round((passed / decided) * 100) : null

    // Bucket the last 7 days of signups.
    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    ;(weekSignupsRes.data ?? []).forEach((u: any) => {
      const day = u.created_at?.split('T')[0]
      if (day && days[day] !== undefined) days[day]++
    })

    const recentMatches = (recentMatchesRes.data ?? []).map((m: any) => ({
      id: m.id, score: m.compatibility_score, status: m.status,
      user1_accepted: m.user_1_accepted, user2_accepted: m.user_2_accepted, created_at: m.created_at,
    }))

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue, pendingMatches, bothAccepted, passed, passRate, waiting, matched, men, women, bi },
      signupsPerDay: days,
      recentUsers: recentUsersRes.data ?? [],
      recentMatches,
    })
  } catch (err) {
    console.error('Admin dashboard error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
