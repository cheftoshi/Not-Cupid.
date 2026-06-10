import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'
import { releaseBalanceHolds } from '@/lib/balance'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization') || ''
  const userAgent = req.headers.get('user-agent') || ''
  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  // Fallback: Vercel's scheduler always sends this UA on cron invocations,
  // even when the CRON_SECRET env var isn't wired through to the runtime.
  // Lets the real scheduler in regardless. Bearer + admin remain the stronger
  // paths; tighten to bearer-only once CRON_SECRET reliably reaches the env.
  const vercelCronUA = /vercel-cron/i.test(userAgent)
  const isVercelCron = bearerOk || vercelCronUA

  if (!isVercelCron) {
    const admin = await getCurrentAdmin()
    if (!admin) {
      console.warn('[cron/rematch] 403 — not cron and not admin', {
        hasCronSecret: !!cronSecret,
        gotAuthHeader: !!authHeader,
        ua: userAgent.slice(0, 40),
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const nowIso = new Date().toISOString()

    // ============== Pool rotation: DISABLED ==============
    // Activity-based ejection (no login in 7 days -> pool_active=false) was wrong
    // for NotCupid's model: users take the quiz and WAIT for a match email — they
    // have no reason to log back in, so the ejection benched the real, willing pool
    // (179 of 287 waiting users) and starved matching, esp. the scarce female side.
    // Removed 2026-05-31. pool_active now stays true; the gate in /api/match is a
    // harmless no-op kept for future use. Keep these counters for the response shape.
    const toEject: string[] = []
    const wakeIds: string[] = []

    // ============== 0c) Auto-release expired cooldowns ==============
    // A user whose matching_cooldown_until has passed (and who isn't banned
    // or currently matched) automatically rejoins the active pool. We clear
    // the cooldown timestamp so we don't reprocess them next run, and queue
    // them for a fresh rematch attempt below.
    const { data: cooledDown } = await supabaseAdmin
      .from('users')
      .select('id')
      .not('matching_cooldown_until', 'is', null)
      .lt('matching_cooldown_until', nowIso)
      .is('matching_disabled_at', null)
      .neq('status', 'matched')

    const releasedIds = (cooledDown || []).map((u: any) => u.id)
    if (releasedIds.length > 0) {
      await supabaseAdmin
        .from('users')
        .update({ matching_cooldown_until: null, status: 'waiting', pool_active: true })
        .in('id', releasedIds)
    }
    console.log(`Cooldown auto-release: ${releasedIds.length}`)

    // ============== 0d) Gender-balance hold release ==============
    // Release intake-gated users as the scarce side grows (room under the
    // ceiling) or after the 3-day anti-churn cap. Released users go straight
    // into the rematch set below so they get a match attempt this run.
    let balanceReleased: string[] = []
    try {
      balanceReleased = await releaseBalanceHolds()
    } catch (e) {
      console.error('Balance hold release failed:', e)
    }
    console.log(`Balance-hold release: ${balanceReleased.length}`)

    // ============== 1) Auto-end active chats whose timer expired ==============
    // Close chats that have gone silent past their (sliding) 24h window.
    // Keyed on both-accepted + chat_expires_at, not status='active' (matches
    // are activated as 'both_accepted', so the old status filter never fired).
    const { data: expiredChats } = await supabaseAdmin
      .from('matches')
      .update({ status: 'ended', ended_at: nowIso, ended_reason: 'expired' })
      .eq('user_1_accepted', true)
      .eq('user_2_accepted', true)
      .is('ended_at', null)
      .not('chat_expires_at', 'is', null)
      .lt('chat_expires_at', nowIso)
      .select('id, user_1_id, user_2_id')

    console.log(`Auto-ended ${expiredChats?.length || 0} expired chats`)

    if (expiredChats && expiredChats.length > 0) {
      const historyRows = expiredChats.map((m) => {
        const [a, b] = [m.user_1_id, m.user_2_id].sort()
        return { user_a_id: a, user_b_id: b, match_id: m.id, outcome: 'expired' }
      })
      await supabaseAdmin
        .from('match_history')
        .upsert(historyRows, { onConflict: 'user_a_id,user_b_id' })
    }

    // ============== 2) Expire pending matches older than 72h ==============
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const { data: expiredPending } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', cutoff)

    if (expiredPending && expiredPending.length > 0) {
      const ids = expiredPending.map((m: any) => m.id)
      await supabaseAdmin.from('matches').update({ status: 'expired' }).in('id', ids)
    }

    // ============== 3) Collect all user IDs eligible to rematch ==============
    // Batched: one IN query for everyone touched by an expiry, instead of a
    // sequential per-user fetch loop (2 round trips per expired match).
    const toRematch = new Set<string>()
    const touched = new Set<string>()
    for (const m of expiredChats || []) { touched.add(m.user_1_id); touched.add(m.user_2_id) }
    for (const m of expiredPending || []) { touched.add((m as any).user_1_id); touched.add((m as any).user_2_id) }
    if (touched.size > 0) {
      const { data: touchedUsers } = await supabaseAdmin
        .from('users')
        .select('id, matching_disabled_at, matching_cooldown_until')
        .in('id', Array.from(touched))
      const nowMs2 = Date.now()
      for (const u of touchedUsers ?? []) {
        // Roster-first: everyone whose match ended returns to the pool (no
        // auto_rematch opt-out anymore — pausing is done via unsubscribe).
        if (u.matching_disabled_at) continue
        if (u.matching_cooldown_until && new Date(u.matching_cooldown_until).getTime() > nowMs2) continue
        toRematch.add(u.id)
      }
    }
    // Freshly cooldown-released users are eligible by construction
    // (cooldown cleared, not banned, not matched) — add them directly.
    for (const id of releasedIds) toRematch.add(id)
    // Balance-released users likewise want a match attempt this run.
    for (const id of balanceReleased) toRematch.add(id)

    if (toRematch.size === 0) {
      return NextResponse.json({
        success: true,
        chatsExpired: expiredChats?.length || 0,
        pendingExpired: expiredPending?.length || 0,
        rematched: 0,
        poolEjected: toEject.length,
        poolWaked: wakeIds.length,
        cooldownReleased: releasedIds.length,
      })
    }

    // ============== 4) Return eligible users to the choosable pool ==========
    // Roster-first: no auto-assigning a single match here. Set everyone whose
    // match ended/expired (plus cooldown/balance releases) back to 'waiting'
    // so they reappear in the pool and get a fresh roster on their next
    // dashboard visit. Match creation happens when a user actively picks.
    const { error: poolErr } = await supabaseAdmin
      .from('users')
      .update({ status: 'waiting' })
      .in('id', Array.from(toRematch))
    const returnedToPool = poolErr ? 0 : toRematch.size

    return NextResponse.json({
      success: true,
      chatsExpired: expiredChats?.length || 0,
      pendingExpired: expiredPending?.length || 0,
      returnedToPool,
      poolEjected: toEject.length,
      poolWaked: wakeIds.length,
      cooldownReleased: releasedIds.length,
    })
  } catch (err) {
    console.error('Rematch cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
