import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { data: users } = await supabaseAdmin.from('users').select('*').not('is_test', 'is', true).order('created_at', { ascending: false })
    const { data: matches } = await supabaseAdmin.from('matches').select('*').order('created_at', { ascending: false })
    // Revenue ledgers — count EVERY stream, by real amount (not a flat proxy):
    //   • match_unlocks.amount_cents = current love-profile unlocks ($0.99)
    //   • unlocks.amount = legacy standalone unlock ledger (cents)
    const { data: unlocks } = await supabaseAdmin.from('unlocks').select('amount')
    let matchUnlocks: any[] = []
    try { matchUnlocks = (await supabaseAdmin.from('match_unlocks').select('amount_cents')).data ?? [] }
    catch { /* table missing — fall back to legacy unlocks only */ }
    // For the conversion funnel: which matches have ≥1 message, and which users gave date feedback.
    const { data: msgRows } = await supabaseAdmin.from('messages').select('match_id')
    const { data: feedbackRows } = await supabaseAdmin.from('date_feedback').select('user_id')

    // ── Friend Maxxin metrics (wrapped so missing tables don't break the dashboard) ──
    // Hoisted so the top-level revenue total can fold in friend-side income.
    let friendPaidPacks = 0   // $1.99 packs actually bought (excludes free pro grants)
    let friendChatUnlocks = 0 // legacy per-crew $0.99 unlocks
    let friend: any = null
    try {
      const liveUsers = (users ?? []).filter((u: any) => !u.deleted_at)
      const optedIn = liveUsers.filter((u: any) => u.friend_opted_in_at)
      const { data: conns } = await supabaseAdmin.from('friend_connections').select('status')
      const { data: circleMembers } = await supabaseAdmin.from('friend_circle_members').select('circle_id').is('left_at', null)
      const { count: fMsgCount } = await supabaseAdmin.from('friend_messages').select('id', { count: 'exact', head: true })
      const { count: unlockCount } = await supabaseAdmin.from('friend_chat_unlocks').select('user_id', { count: 'exact', head: true })
      const { data: acts } = await supabaseAdmin.from('friend_activities').select('kind')
      const connList = conns ?? []
      friendChatUnlocks = unlockCount ?? 0
      try {
        // PAID packs only — pro-granted free packs carry a synthetic `pro-…` id.
        const { data: roundRows } = await supabaseAdmin.from('friend_match_rounds').select('stripe_payment_id')
        friendPaidPacks = (roundRows ?? []).filter((r: any) => !String(r.stripe_payment_id ?? '').startsWith('pro-')).length
      } catch { /* friend_match_rounds not migrated yet */ }
      friend = {
        optedIn: optedIn.length,
        matchRounds: friendPaidPacks,
        chatUnlocks: friendChatUnlocks,
        // $1.99/pack + legacy $0.99 crew unlocks.
        unlockRevenue: ((friendPaidPacks * 199 + friendChatUnlocks * 99) / 100).toFixed(2),
        connectionsPending: connList.filter((c: any) => c.status === 'pending').length,
        connectionsMade: connList.filter((c: any) => c.status === 'connected').length,
        activeCircles: new Set((circleMembers ?? []).map((m: any) => m.circle_id)).size,
        messages: fMsgCount ?? 0,
        posts: (acts ?? []).filter((a: any) => a.kind === 'post').length,
        events: (acts ?? []).filter((a: any) => a.kind !== 'post').length,
      }
    } catch (e) {
      console.warn('friend metrics unavailable', e)
    }
    // Web traffic (last 7 days) for the in-admin flow view. Wrapped so a missing
    // page_views table (migration not run yet) doesn't break the whole dashboard.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    let pageViews: any[] | null = null
    try {
      const r = await supabaseAdmin.from('page_views').select('path, anon_id, created_at').gte('created_at', sevenDaysAgo)
      pageViews = r.data ?? []
    } catch { pageViews = null }

    const totalUsers = users?.length ?? 0
    const totalMatches = matches?.length ?? 0

    // ── Revenue: count ALL of it, by real amount (cents → dollars) ──
    const loveUnlockCents =
      matchUnlocks.reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0) +
      (unlocks ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
    const packCents = friendPaidPacks * 199
    const friendLegacyCents = friendChatUnlocks * 99
    const oneTimeCents = loveUnlockCents + packCents + friendLegacyCents // collected to date
    // Active All-Access subscribers → monthly recurring revenue.
    const nowMs = Date.now()
    const activeSubs = (users ?? []).filter(
      (u: any) => !u.deleted_at && u.friend_pro_until && new Date(u.friend_pro_until).getTime() > nowMs
    ).length
    const mrrCents = activeSubs * 399
    const totalRevenue = oneTimeCents / 100 // one-time collected (subs shown separately as MRR)
    const revenue = {
      loveUnlocks: (loveUnlockCents / 100).toFixed(2),
      packs: (packCents / 100).toFixed(2),
      friendLegacy: (friendLegacyCents / 100).toFixed(2),
      oneTimeTotal: totalRevenue.toFixed(2),
      mrr: (mrrCents / 100).toFixed(2),
      activeSubs,
    }
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

    // ───────────── Web traffic (last 7 days) ─────────────
    let traffic: any = null
    if (pageViews) {
      const pathCounts: Record<string, number> = {}
      const sessions = new Set<string>()
      const viewsByDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        viewsByDay[d.toISOString().split('T')[0]] = 0
      }
      pageViews.forEach((v: any) => {
        pathCounts[v.path] = (pathCounts[v.path] || 0) + 1
        if (v.anon_id) sessions.add(v.anon_id)
        const day = v.created_at?.split('T')[0]
        if (day && viewsByDay[day] !== undefined) viewsByDay[day]++
      })
      const topPaths = Object.entries(pathCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([path, count]) => ({ path, count }))
      traffic = {
        totalViews: pageViews.length,
        uniqueSessions: sessions.size,
        topPaths,
        viewsByDay,
      }
    }

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue: totalRevenue.toFixed(2), mrr: revenue.mrr, activeSubs, revenue, pendingMatches, bothAccepted, passed, passRate, waiting, matched, men, women, bi },
      signupsPerDay: days,
      funnel,
      traffic,
      friend,
      recentUsers,
      recentMatches,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
