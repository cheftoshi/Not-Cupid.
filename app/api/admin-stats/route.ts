import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { data: users } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false })
    const { data: matches } = await supabaseAdmin.from('matches').select('*').order('created_at', { ascending: false })
    const { data: unlocks } = await supabaseAdmin.from('unlocks').select('*')
    // For the conversion funnel: which matches have ≥1 message, and which users gave date feedback.
    const { data: msgRows } = await supabaseAdmin.from('messages').select('match_id')
    const { data: feedbackRows } = await supabaseAdmin.from('date_feedback').select('user_id')

    const totalUsers = users?.length ?? 0
    const totalMatches = matches?.length ?? 0
    const totalRevenue = (unlocks?.length ?? 0) * 0.99
    // Two accept/pass flows exist:
    //   - email link sets status='both_accepted' / 'passed'
    //   - in-app sets booleans / ended_reason but not status
    // We compute from the union of signals so the stat reflects reality.
    const bothAccepted = matches?.filter(m => m.user_1_accepted && m.user_2_accepted).length ?? 0
    const passed = matches?.filter(
      m => m.status === 'passed' || m.ended_reason === 'one_passed'
    ).length ?? 0
    const pendingMatches = matches?.filter(
      m => m.status === 'pending' && !(m.user_1_accepted && m.user_2_accepted) && !m.ended_at
    ).length ?? 0
    const waiting = users?.filter(u => u.status === 'waiting').length ?? 0
    const matched = users?.filter(u => u.status === 'matched').length ?? 0
    const men = users?.filter(u => u.gender === 'm').length ?? 0
    const women = users?.filter(u => u.gender === 'f').length ?? 0
    const bi = users?.filter(u => u.gender === 'b').length ?? 0

    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    users?.forEach(u => {
      const day = u.created_at?.split('T')[0]
      if (day && days[day] !== undefined) days[day]++
    })

    const recentUsers = users?.slice(0, 15).map(u => ({
      name: u.name, email: u.email, gender: u.gender,
      seeking: u.seeking, zip: u.zip, status: u.status, created_at: u.created_at
    }))

    const recentMatches = matches?.slice(0, 15).map(m => ({
      id: m.id, score: m.compatibility_score, status: m.status,
      user1_accepted: m.user_1_accepted, user2_accepted: m.user_2_accepted, created_at: m.created_at
    }))

    // Pass rate = passed / decided. Null when nothing decided yet (avoid 0/0).
    const decided = bothAccepted + passed
    const passRate = decided > 0 ? Math.round((passed / decided) * 100) : null

    // ───────────── Conversion funnel (the app's "webflow") ─────────────
    // Distinct users at each stage of the journey, computed from real data so
    // you can see exactly where people drop off.
    const allUsers = users ?? []
    const allMatches = matches ?? []
    const liveUsers = allUsers.filter(u => !u.deleted_at)
    const total = liveUsers.length

    const matchedUserIds = new Set<string>()
    const mutualUserIds = new Set<string>()
    allMatches.forEach(m => {
      matchedUserIds.add(m.user_1_id); matchedUserIds.add(m.user_2_id)
      if (m.user_1_accepted && m.user_2_accepted) { mutualUserIds.add(m.user_1_id); mutualUserIds.add(m.user_2_id) }
    })
    // Matches that have at least one message → the users in them "chatted".
    const matchesWithMsgs = new Set((msgRows ?? []).map(r => r.match_id))
    const chattedUserIds = new Set<string>()
    allMatches.forEach(m => {
      if (matchesWithMsgs.has(m.id)) { chattedUserIds.add(m.user_1_id); chattedUserIds.add(m.user_2_id) }
    })
    const datedUserIds = new Set((feedbackRows ?? []).map(r => r.user_id))

    const countIn = (set: Set<string>) => liveUsers.filter(u => set.has(u.id)).length
    const stage = (label: string, count: number) => ({
      label, count, pctOfTotal: total > 0 ? Math.round((count / total) * 100) : 0,
    })

    const funnel = [
      stage('Signed up', total),
      stage('Finished quiz', liveUsers.filter(u => u.archetype && typeof u.score_honesty === 'number').length),
      stage('Did vibes round', liveUsers.filter(u => u.vibes && typeof u.vibes === 'object' && Object.keys(u.vibes).length > 0).length),
      stage('Got a match', countIn(matchedUserIds)),
      stage('Mutually accepted', countIn(mutualUserIds)),
      stage('Started chatting', countIn(chattedUserIds)),
      stage('Went on a date', countIn(datedUserIds)),
    ]

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue: totalRevenue.toFixed(2), pendingMatches, bothAccepted, passed, passRate, waiting, matched, men, women, bi },
      signupsPerDay: days,
      funnel,
      recentUsers,
      recentMatches,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
