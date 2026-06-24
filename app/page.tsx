import { supabaseAdmin } from '@/lib/supabase'
import LandingClient from './landing-client'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // refresh stats every minute

async function getStats() {
  // Never let a slow/unreachable DB hang the landing page render — cap the
  // whole stats lookup and fall back to zeros if it's not quick.
  const fallback = { poolCount: 0, matchesThisWeek: 0, lastMatchAt: null as string | null }
  const timeout = new Promise<typeof fallback>((resolve) => setTimeout(() => resolve(fallback), 3000))
  return Promise.race([getStatsInner(), timeout])
}

async function getStatsInner() {
  try {
    // Total active members in the Boston pool
    const { count: poolCount } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('pool_active', true)
      .is('deleted_at', null)
      .not('is_test', 'is', true) // test accounts are never counted as real members

    // Mutual accepts this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: weekMatches } = await supabaseAdmin
      .from('matches')
      .select('user_1_accepted, user_2_accepted, created_at')
      .gte('created_at', weekAgo)
    const matchesThisWeek = (weekMatches || []).filter(
      (m: any) => m.user_1_accepted && m.user_2_accepted
    ).length

    // Most recent mutual match — for the "X minutes ago" vibe
    const { data: lastMatchArr } = await supabaseAdmin
      .from('matches')
      .select('created_at, user_1_accepted, user_2_accepted')
      .order('created_at', { ascending: false })
      .limit(50)
    const lastMatch = (lastMatchArr || []).find((m: any) => m.user_1_accepted && m.user_2_accepted)

    return {
      poolCount: poolCount ?? 0,
      matchesThisWeek,
      lastMatchAt: lastMatch?.created_at ?? null,
    }
  } catch (e) {
    console.error('Landing stats error:', e)
    return { poolCount: 0, matchesThisWeek: 0, lastMatchAt: null }
  }
}

export default async function Home() {
  const stats = await getStats()
  return <LandingClient stats={stats} />
}
