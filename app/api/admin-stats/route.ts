import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch'
import { experimentProfileReadiness } from '@/lib/experiment-profile'
import { RAFFLE } from '@/lib/raffle'

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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Friend Maxxin metrics (wrapped so missing tables don't break the dashboard) ──
    // Hoisted so the top-level revenue total can fold in friend-side income.
    let friendPaidPacks = 0   // $0.99 packs actually bought (excludes free pro grants)
    let friendChatUnlocks = 0 // legacy per-crew $0.99 unlocks
    let friend: any = null
    try {
      const liveUsers = (users ?? []).filter((u: any) => !u.deleted_at)
      const optedIn = liveUsers.filter((u: any) => u.friend_opted_in_at)
      const { data: conns } = await supabaseAdmin.from('friend_connections').select('status, match_metro, match_context, match_expires_at')
      const { data: circleMembers } = await supabaseAdmin.from('friend_circle_members').select('circle_id').is('left_at', null)
      const { count: fMsgCount } = await supabaseAdmin.from('friend_messages').select('id', { count: 'exact', head: true })
      const { count: unlockCount } = await supabaseAdmin.from('friend_chat_unlocks').select('user_id', { count: 'exact', head: true })
      const { data: acts } = await supabaseAdmin.from('friend_activities').select('kind')
      const { data: intentRows } = await supabaseAdmin.from('friend_intents').select('user_id, status, expires_at')
      const { data: actionRows } = await supabaseAdmin.from('friend_action_events').select('user_id, event').gte('created_at', thirtyDaysAgo)
      const { data: tripRows } = await supabaseAdmin.from('friend_trips').select('user_id, destination_metro, starts_on, ends_on, status')
      const { count: clubCount } = await supabaseAdmin.from('friend_clubs').select('id', { count: 'exact', head: true }).eq('is_test', false).is('hidden_at', null)
      const { count: communityCount } = await supabaseAdmin.from('friend_community_links').select('id', { count: 'exact', head: true }).eq('is_test', false).eq('approved', true)
      const connList = conns ?? []
      friendChatUnlocks = unlockCount ?? 0
      try {
        // PAID packs only — synthetic ids (pro- grants, drop- weekly drops,
        // ref-/refwelcome- referral rewards) are free, never revenue.
        const { data: roundRows } = await supabaseAdmin.from('friend_match_rounds').select('stripe_payment_id')
        friendPaidPacks = (roundRows ?? []).filter((r: any) => !/^(pro-|drop-|ref-|refwelcome-)/.test(String(r.stripe_payment_id ?? ''))).length
      } catch { /* friend_match_rounds not migrated yet */ }
      const realUserIds = new Set(liveUsers.map((u: any) => u.id))
      const realActions = (actionRows ?? []).filter((event: any) => realUserIds.has(event.user_id))
      const uniqueActionUsers = (event: string) => new Set(realActions.filter((row: any) => row.event === event).map((row: any) => row.user_id)).size
      const connectionActionUsers = new Set(realActions.filter((row: any) => ['intent_joined', 'community_opened', 'club_joined', 'plan_rsvp'].includes(row.event)).map((row: any) => row.user_id)).size
      const today = new Date().toISOString().slice(0, 10)
      const realTrips = (tripRows ?? []).filter((trip: any) => realUserIds.has(trip.user_id) && trip.status === 'active' && trip.ends_on >= today)
      const activeTravelers = realTrips.filter((trip: any) => trip.starts_on <= today).length
      const travelMatches = connList.filter((connection: any) =>
        connection.status !== 'declined' && Array.isArray(connection.match_context?.travelers) && connection.match_context.travelers.length > 0
      ).length
      friend = {
        optedIn: optedIn.length,
        matchRounds: friendPaidPacks,
        chatUnlocks: friendChatUnlocks,
        // $0.99/pack + legacy $0.99 crew unlocks.
        unlockRevenue: ((friendPaidPacks * 99 + friendChatUnlocks * 99) / 100).toFixed(2),
        connectionsPending: connList.filter((c: any) => c.status === 'pending').length,
        connectionsMade: connList.filter((c: any) => c.status === 'connected').length,
        activeCircles: new Set((circleMembers ?? []).map((m: any) => m.circle_id)).size,
        messages: fMsgCount ?? 0,
        posts: (acts ?? []).filter((a: any) => a.kind === 'post').length,
        events: (acts ?? []).filter((a: any) => a.kind !== 'post').length,
        openIntents: (intentRows ?? []).filter((intent: any) => realUserIds.has(intent.user_id) && intent.status === 'open' && new Date(intent.expires_at).getTime() > Date.now()).length,
        clubs: clubCount ?? 0,
        communities: communityCount ?? 0,
        discoveryUsers30d: uniqueActionUsers('discovery_viewed'),
        intentCreators30d: uniqueActionUsers('intent_created'),
        intentJoiners30d: uniqueActionUsers('intent_joined'),
        communityOpeners30d: uniqueActionUsers('community_opened'),
        planRsvps30d: uniqueActionUsers('plan_rsvp'),
        connectionActionUsers30d: connectionActionUsers,
        scheduledTrips: realTrips.length,
        activeTravelers,
        travelMatches,
        travelMetros: new Set(realTrips.map((trip: any) => trip.destination_metro)).size,
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

    // First-party payment funnel, last 30 days. This is intentionally derived
    // from aggregate events and never exposes checkout/customer details.
    let monetization: any = null
    try {
      const result = await supabaseAdmin
        .from('monetization_events')
        .select('user_id, event, product, amount_cents')
        .gte('created_at', thirtyDaysAgo)
      if (!result.error) {
        const rows = result.data ?? []
        const productNames = ['love_profile', 'friend_pack', 'pro']
        const summarize = (product?: string) => {
          const subset = product ? rows.filter((row: any) => row.product === product) : rows
          const unique = (event: string) => new Set(
            subset.filter((row: any) => row.event === event).map((row: any) => row.user_id)
          ).size
          const views = unique('paywall_viewed')
          const starts = unique('checkout_started')
          const purchases = subset.filter((row: any) => row.event === 'purchase_completed')
          return {
            paywallViewers: views,
            checkoutStarters: starts,
            checkoutFailures: subset.filter((row: any) => row.event === 'checkout_failed').length,
            purchases: purchases.length,
            trackedRevenue: (purchases.reduce((sum: number, row: any) => sum + (row.amount_cents ?? 0), 0) / 100).toFixed(2),
            viewToCheckoutPct: views > 0 ? Math.round((starts / views) * 100) : null,
          }
        }
        monetization = {
          periodDays: 30,
          ...summarize(),
          products: Object.fromEntries(productNames.map((product) => [product, summarize(product)])),
        }
      }
    } catch { monetization = null }

    // Dating Experiment comeback lifecycle. Opens are directional because mailbox privacy
    // proxies can prefetch pixels; first-party CTA clicks are the stronger KPI.
    let loveCampaign: any = null
    try {
      const result = await supabaseAdmin
        .from('email_campaign_deliveries')
        .select('user_id, variant, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at')
        .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
      if (!result.error) {
        const rows = result.data ?? []
        const sent = rows.filter((row: any) => row.sent_at).length
        const delivered = rows.filter((row: any) => row.delivered_at).length
        const opened = rows.filter((row: any) => row.opened_at).length
        const clicked = rows.filter((row: any) => row.clicked_at).length
        const variants = rows.reduce((counts: Record<string, number>, row: any) => {
          counts[row.variant || 'unknown'] = (counts[row.variant || 'unknown'] || 0) + 1
          return counts
        }, {})
        const profileClickerIds = new Set(rows
          .filter((row: any) => row.variant === 'profile' && row.clicked_at)
          .map((row: any) => row.user_id))
        const profileNowEligible = (users ?? []).filter((user: any) =>
          profileClickerIds.has(user.id) && experimentProfileReadiness(user).complete
        ).length
        const [funnelResult, entriesResult] = await Promise.all([
          supabaseAdmin
            .from('campaign_funnel_events')
            .select('user_id, event')
            .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN),
          supabaseAdmin
            .from('raffle_entries')
            .select('user_id', { count: 'exact', head: true })
            .eq('event_key', RAFFLE.key)
            .eq('terms_version', RAFFLE.termsVersion)
            .neq('status', 'withdrawn'),
        ])
        const funnelRows = funnelResult.data ?? []
        const uniqueAt = (event: string) => new Set(
          funnelRows.filter((row: any) => row.event === event).map((row: any) => row.user_id)
        ).size
        const profileStarted = uniqueAt('profile_started')
        const profileSaved = uniqueAt('profile_saved')
        const profileEligible = Math.max(uniqueAt('profile_eligible'), profileNowEligible)
        const experimentViewed = uniqueAt('experiment_viewed')
        const entrySubmitted = uniqueAt('entry_submitted')
        const percent = (numerator: number, denominator: number) => denominator > 0
          ? Math.round((numerator / denominator) * 100)
          : null
        loveCampaign = {
          key: LOVE_RELAUNCH_CAMPAIGN,
          queued: rows.filter((row: any) => row.status === 'queued').length,
          sent,
          delivered,
          opened,
          clicked,
          bounced: rows.filter((row: any) => row.bounced_at).length,
          complained: rows.filter((row: any) => row.complained_at).length,
          failed: rows.filter((row: any) => row.status === 'failed').length,
          deliveryRatePct: sent > 0 ? Math.round((delivered / sent) * 100) : null,
          clickRatePct: delivered > 0 ? Math.round((clicked / delivered) * 100) : null,
          variants,
          funnel: {
            trackingReady: !funnelResult.error,
            emailClicked: clicked,
            profileCtaClicked: profileClickerIds.size,
            profileStarted,
            profileSaved,
            profileEligible,
            profileNowEligible,
            experimentViewed,
            entrySubmitted,
            totalCurrentExperimentEntries: entriesResult.count ?? 0,
            profileClickToEligiblePct: percent(profileEligible, profileClickerIds.size),
            eligibleToEntryPct: percent(entrySubmitted, profileEligible),
            clickToEntryPct: percent(entrySubmitted, clicked),
          },
        }
      }
    } catch { loveCampaign = null }

    const totalUsers = users?.length ?? 0
    const totalMatches = matches?.length ?? 0

    // ── Revenue: count ALL of it, by real amount (cents → dollars) ──
    const loveUnlockCents =
      matchUnlocks.reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0) +
      (unlocks ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
    const packCents = friendPaidPacks * 99
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
        reactivation: {
          welcomeViews: pathCounts['/reactivation/welcome_viewed'] || 0,
          profileReviewStarts: pathCounts['/reactivation/profile_review_started'] || 0,
          profileSaves: pathCounts['/reactivation/profile_saved'] || 0,
          loveAnswerStarts: pathCounts['/reactivation/love_answers_started'] || 0,
          loveReactivated: pathCounts['/reactivation/love_reactivated'] || 0,
          currentProfileUsed: pathCounts['/reactivation/current_profile_used'] || 0,
          dismissed: pathCounts['/reactivation/welcome_dismissed'] || 0,
        },
      }
    }

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue: totalRevenue.toFixed(2), mrr: revenue.mrr, activeSubs, revenue, pendingMatches, bothAccepted, passed, passRate, waiting, matched, men, women, bi },
      signupsPerDay: days,
      funnel,
      traffic,
      monetization,
      loveCampaign,
      friend,
      recentUsers,
      recentMatches,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
