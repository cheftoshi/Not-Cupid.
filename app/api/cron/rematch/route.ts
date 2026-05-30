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

    // ============== 0a) Activity-based ejection ==============
    // Users with no session activity in INACTIVE_DAYS get pool_active = false.
    const INACTIVE_DAYS = 7
    const inactiveCutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentSessions } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .gte('last_used_at', inactiveCutoff)
    const activeUserIds = new Set((recentSessions || []).map((s: any) => s.user_id))

    const { data: currentlyActive } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('pool_active', true)

    const toEject = (currentlyActive || [])
      .filter((u: any) => !activeUserIds.has(u.id))
      .map((u: any) => u.id)

    if (toEject.length > 0) {
      await supabaseAdmin
        .from('users')
        .update({ pool_active: false, pool_drop_at: nowIso })
        .in('id', toEject)
    }

    // ============== 0b) Wave drop — release a balanced batch ==============
    // Pull up to WAVE_PER_GENDER per gender from the inactive queue.
    const WAVE_PER_GENDER = 10
    const { data: queued } = await supabaseAdmin
      .from('users')
      .select('id, gender')
      .eq('pool_active', false)
      .eq('status', 'waiting')
      .is('matching_disabled_at', null)
      .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`)
      .order('pool_drop_at', { ascending: true, nullsFirst: true })

    const men = (queued || []).filter((u: any) => u.gender === 'm').slice(0, WAVE_PER_GENDER)
    const women = (queued || []).filter((u: any) => u.gender === 'f').slice(0, WAVE_PER_GENDER)
    const otherGender = (queued || [])
      .filter((u: any) => u.gender && u.gender !== 'm' && u.gender !== 'f')
      .slice(0, WAVE_PER_GENDER)
    const wakeIds = [...men, ...women, ...otherGender].map((u: any) => u.id)

    if (wakeIds.length > 0) {
      await supabaseAdmin
        .from('users')
        .update({ pool_active: true, pool_drop_at: null })
        .in('id', wakeIds)
    }

    console.log(`Pool rotation: ejected ${toEject.length}, woke ${wakeIds.length} (${men.length}m / ${women.length}f / ${otherGender.length}o)`)

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

    // ============== 2) Expire pending matches older than 48h ==============
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
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
    const toRematch = new Set<string>()
    const consider = async (userId: string) => {
      const { data: u } = await supabaseAdmin
        .from('users')
        .select('auto_rematch, matching_disabled_at, matching_cooldown_until')
        .eq('id', userId)
        .single()
      if (!u) return
      if (u.auto_rematch === false) return
      if (u.matching_disabled_at) return
      if (u.matching_cooldown_until && new Date(u.matching_cooldown_until) > new Date()) return
      toRematch.add(userId)
    }

    for (const m of expiredChats || []) {
      await consider(m.user_1_id)
      await consider(m.user_2_id)
    }
    for (const m of expiredPending || []) {
      await consider((m as any).user_1_id)
      await consider((m as any).user_2_id)
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

    // ============== 4) Determine priority order ==============
    // The under-represented gender goes first so they aren't out-competed by
    // earlier loop iterations claiming the best opposite-side candidates.
    const { data: poolPeek } = await supabaseAdmin
      .from('users')
      .select('gender')
      .eq('status', 'waiting')
      .is('matching_disabled_at', null)

    const mCount = poolPeek?.filter((p: any) => p.gender === 'm').length || 0
    const fCount = poolPeek?.filter((p: any) => p.gender === 'f').length || 0
    const priorityGender = fCount <= mCount ? 'f' : 'm'

    const { data: rematchUsers } = await supabaseAdmin
      .from('users')
      .select('id, gender')
      .in('id', Array.from(toRematch))

    const ordered = (rematchUsers || []).slice().sort((a: any, b: any) => {
      const aPri = a.gender === priorityGender ? 0 : 1
      const bPri = b.gender === priorityGender ? 0 : 1
      return aPri - bPri
    })

    // ============== 5) Set waiting + trigger /api/match per user, in order ==============
    let matched = 0
    for (const u of ordered) {
      await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', u.id)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.id }),
        })
        const j = await res.json().catch(() => ({}))
        if (j?.matched) matched++
      } catch (e) {
        console.warn('[cron] match call failed for', u.id, e)
      }
    }

    return NextResponse.json({
      success: true,
      chatsExpired: expiredChats?.length || 0,
      pendingExpired: expiredPending?.length || 0,
      rematchAttempted: ordered.length,
      rematched: matched,
      priorityGender,
      poolEjected: toEject.length,
      poolWaked: wakeIds.length,
      cooldownReleased: releasedIds.length,
    })
  } catch (err) {
    console.error('Rematch cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
