import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'
import { releaseBalanceHolds } from '@/lib/balance'
import { ignoringParty } from '@/lib/match-actions'
import { sendPushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/request-security'
import { button, renderEmail, sendEmail } from '@/lib/email'
import {
  LOVE_ROTATION_HOUR_UTC,
  activeUserCutoffIso,
  rosterExposureCutoffIso,
} from '@/lib/matching-policy'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function loveRotationEmail(user: { id: string; name?: string | null }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const first = (user.name || 'there').split(' ')[0]
  return renderEmail({
    preheader: 'Your Love Line roster has rotated. Active people and fresh introductions now come first.',
    eyebrow: 'love line rotation ✦',
    headline: `${first}, your roster moved.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">We refreshed your place in the Love Line and moved recently active people to the front.</p>
      <p style="margin:0 0 18px 0;">People shown during the last seven days rotate out when another compatible option is available. Open your roster to see who is ready now.</p>
      ${button({ href: `${base}/dashboard#roster`, label: 'open the new roster →' })}
    `,
    recipientId: user.id,
    footerNote: 'fresh people first. no endless swiping.',
  })
}

export async function GET(req: NextRequest) {
  const cronAuthorized = isAuthorizedCronRequest(req)
  let adminAuthorized = false
  if (!cronAuthorized) {
    const admin = await getCurrentAdmin()
    if (!admin) {
      console.warn('[cron/rematch] 403 — invalid bearer and no admin session')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    adminAuthorized = true
  }
  // Manual forcing is deliberately admin-session-only. The normal Vercel cron
  // cannot be turned into an email blast just by adding a query parameter.
  const forceRotation = adminAuthorized && req.nextUrl.searchParams.get('rotate') === '1'

  try {
    const nowIso = new Date().toISOString()

    // ============== 0) Weekly active-user roster rotation ==============
    // During the daily noon-ET window, rotate users who authenticated in the
    // last 12 days and have not been rotated in seven days. Clearing the saved
    // snapshot makes the next open use the exposure-aware roster composer.
    // Both channels are attempted: email is the reliable baseline and push is
    // immediate for anyone who has installed/subscribed.
    let heartbeatPushed = 0
    let heartbeatEmailed = 0
    let rostersRotated = 0
    const hbNow = new Date()
    if (forceRotation || (hbNow.getUTCHours() === LOVE_ROTATION_HOUR_UTC && hbNow.getUTCMinutes() < 20)) {
      try {
        const { data: recentSessions, error: sessionErr } = await supabaseAdmin
          .from('sessions')
          .select('user_id')
          .gte('last_used_at', activeUserCutoffIso())
          .limit(5000)

        if (!sessionErr) {
          const activeIds = Array.from(new Set((recentSessions ?? []).map((session) => session.user_id)))
          if (activeIds.length > 0) {
            const { data: rotationUsers, error: hbErr } = await supabaseAdmin
              .from('users')
              .select('id, name, email, email_notifications, notifications_paused_at')
              .in('id', activeIds)
              .eq('pool_active', true)
              .eq('is_blocked', false)
              .is('deleted_at', null)
              .not('is_test', 'is', true)
              .is('matching_disabled_at', null)
              .not('archetype', 'is', null)
              .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`)
              .or(`roster_nudged_at.is.null,roster_nudged_at.lt.${rosterExposureCutoffIso()}`)
              .limit(200)

            if (!hbErr) {
              for (const u of rotationUsers ?? []) {
                const { error: rotateErr } = await supabaseAdmin
                  .from('users')
                  .update({ roster_snapshot: [], roster_refreshed_at: null })
                  .eq('id', u.id)
                if (rotateErr) continue

                rostersRotated++
                const shouldEmail = !!u.email && u.email_notifications !== false && !u.notifications_paused_at
                const [emailResult, pushed] = await Promise.all([
                  shouldEmail
                    ? sendEmail({
                        to: u.email,
                        subject: 'Your Love Line roster just rotated',
                        html: loveRotationEmail(u),
                      })
                    : Promise.resolve({ ok: false }),
                  sendPushToUser(u.id, {
                    title: 'your Love Line roster rotated ✦',
                    body: 'open the app to check your refreshed picks.',
                    url: '/dashboard#roster',
                    tag: 'roster-rotation',
                  }),
                ])
                if (emailResult.ok) heartbeatEmailed++
                if (pushed) heartbeatPushed++

                // If a subscribed channel failed, leave the nudge timestamp
                // untouched so the next daily rotation window can retry. Users
                // with email disabled are marked handled to avoid futile daily
                // retries when they also have no push subscription.
                if (emailResult.ok || pushed || !shouldEmail) {
                  await supabaseAdmin.from('users').update({ roster_nudged_at: nowIso }).eq('id', u.id)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Love roster rotation failed:', error)
      }
    }

    // ============== Activity ejection: DISABLED ==============
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
      // Each pending that died without a yes = an "ignored pick" for the picked
      // side. Past MAX_IGNORED_PICKS they get benched from rosters (see roster/pick).
      await Promise.all(
        expiredPending
          .map((m: any) => ignoringParty(m))
          .filter((id): id is string => !!id)
          .map((id) => supabaseAdmin.rpc('bump_ignored_picks', { p_id: id }).then(undefined, () => {}))
      )
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
        rostersRotated,
        rotationEmails: heartbeatEmailed,
        rotationPushes: heartbeatPushed,
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
      rostersRotated,
      rotationEmails: heartbeatEmailed,
      rotationPushes: heartbeatPushed,
    })
  } catch (err) {
    console.error('Rematch cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
