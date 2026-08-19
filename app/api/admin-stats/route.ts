import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch'
import { ELIGIBLE_READY_REMINDER_CAMPAIGN } from '@/lib/eligible-ready-reminder'
import { experimentProfileReadiness } from '@/lib/experiment-profile'
import { RAFFLE } from '@/lib/raffle'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { ONLY_IN_BOSTON_CAMPAIGN, ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN } from '@/lib/acquisition'
import { detectProductBottlenecks } from '@/lib/product-bottlenecks'

export const dynamic = 'force-dynamic'

type PageViewRow = {
  id: number
  path: string
  anon_id: string | null
  referrer: string | null
  display_mode: string | null
  device_class: string | null
  orientation: string | null
  acquisition_source?: string | null
  acquisition_medium?: string | null
  acquisition_campaign?: string | null
  acquisition_kind?: string | null
  acquisition_landing_path?: string | null
  acquisition_captured_at?: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const nowMs = Date.now()
    const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twelveDaysAgo = new Date(nowMs - 12 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString()

    // These datasets all exceed (or can soon exceed) Supabase's 1,000-row Data
    // API ceiling. Stable range pagination keeps every admin total exact.
    const [users, rawMatches, msgRows, feedbackRows, rosterExposures, recentSessions, loveNotificationEvents] = await Promise.all([
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('users')
        .select('*')
        .not('is_test', 'is', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('messages')
        .select('id,match_id,sender_id,created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('date_feedback')
        .select('id,user_id')
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('roster_exposures')
        .select('user_id,candidate_id,shown_at,picked_at,picked_match_id')
        .order('shown_at', { ascending: true })
        .order('user_id', { ascending: true })
        .order('candidate_id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('sessions')
        .select('user_id,last_used_at')
        .gte('last_used_at', twelveDaysAgo)
        .order('last_used_at', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('love_notification_events')
        .select('id,match_id,recipient_id,notification_type,channel,status,claimed_at,sent_at,delivered_at,opened_at,clicked_at,responded_at,response')
        .order('claimed_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
    ])
    const realUserIds = new Set(users.map((user: any) => user.id))
    const matches = rawMatches.filter((match: any) =>
      realUserIds.has(match.user_1_id) && realUserIds.has(match.user_2_id)
    )
    let experienceRows: any[] = []
    try {
      const { data, error } = await supabaseAdmin.rpc('app_experience_summary', { p_since: oneDayAgo })
      if (!error) experienceRows = data ?? []
    } catch { /* additive migration may still be rolling out */ }
    const experienceByKey = new Map(experienceRows.map((row: any) => [`${row.event_name}:${row.metric_name || ''}`, row]))
    const interaction = (name: string) => Number(experienceByKey.get(`${name}:`)?.total ?? 0)
    const interactionUsers = (name: string) => Number(experienceByKey.get(`${name}:`)?.unique_users ?? 0)
    let recentClientErrors: any[] = []
    try {
      recentClientErrors = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('app_client_events')
        .select('id, path, device_class, display_mode, session_id, metadata, created_at')
        .eq('event_name', 'client_error')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to))
    } catch { /* diagnostics remain optional during a rolling migration */ }
    const currentRelease = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local'
    const currentReleaseErrors = recentClientErrors.filter((row: any) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return metadata.release === currentRelease
    })
    const errorGroupMap = new Map<string, any>()
    for (const row of currentReleaseErrors) {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : 'legacy'
      const code = typeof metadata.errorCode === 'string' ? metadata.errorCode : 'unclassified'
      const source = typeof metadata.errorSource === 'string' ? metadata.errorSource : 'unknown'
      const path = row.path || 'unknown'
      const key = `${fingerprint}:${code}:${source}:${path}`
      const current = errorGroupMap.get(key) || {
        fingerprint, code, source, path, count: 0, phone: 0, installedPwa: 0,
        release: typeof metadata.release === 'string' ? metadata.release : 'unknown',
        lastSeen: row.created_at,
      }
      current.count += 1
      if (row.device_class === 'phone') current.phone += 1
      if (row.display_mode === 'standalone') current.installedPwa += 1
      errorGroupMap.set(key, current)
    }
    const recentErrorGroups = Array.from(errorGroupMap.values())
      .sort((a, b) => b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)))
      .slice(0, 6)
    const vital = (name: string) => {
      const row = experienceByKey.get(`web_vital:${name}`)
      return row ? Number(Number(row.p75_metric_value ?? 0).toFixed(name === 'CLS' ? 3 : 0)) : null
    }
    const rosterTiming = experienceByKey.get('api_timing:roster_api')
    const appExperience = {
      measuredSince: oneDayAgo,
      interactions: {
        dashboardOpens: interaction('love_dashboard_open'),
        rosterViews: interaction('roster_view'),
        profileOpens: interaction('profile_open'),
        compatibilityPaywalls: interaction('compatibility_read_paywall'),
        compatibilityReadRequests: interaction('compatibility_read_requested'),
        compatibilityReadOpens: interaction('compatibility_read_opened'),
        pickAttempts: interaction('pick_attempt'),
        pickSuccesses: interaction('pick_success'),
        pickFailures: interaction('pick_failed'),
        pickFailureUsers: interactionUsers('pick_failed'),
        noSuitableChoice: interaction('no_suitable_choice'),
        firstMessages: interaction('first_message'),
        replies: interaction('reply'),
        coachRequests: interaction('coach_requested'),
      },
      performance: {
        rosterApiP75Ms: rosterTiming ? Math.round(Number(rosterTiming.p75_duration_ms ?? 0)) : null,
        lcpP75Ms: vital('LCP'),
        inpP75Ms: vital('INP'),
        clsP75: vital('CLS'),
        // Current-release errors drive the alarm. Fixed errors from an older
        // bundle remain visible in the rolling 24-hour context count.
        release: currentRelease,
        clientErrors: currentReleaseErrors.length,
        clientErrors24h: recentClientErrors.length,
        clientErrorSessions: new Set(currentReleaseErrors.map((row: any) => row.session_id).filter(Boolean)).size,
        recentErrorGroups,
      },
    }
    // Revenue ledgers — count EVERY stream, by real amount (not a flat proxy):
    //   • match_unlocks.amount_cents = historical Love compatibility deep-dives
    //   • unlocks.amount = legacy standalone unlock ledger (cents)
    const unlocks = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
      .from('unlocks')
      .select('id, amount')
      .order('id', { ascending: true })
      .range(from, to))
    let matchUnlocks: any[] = []
    try {
      matchUnlocks = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('match_unlocks')
        .select('user_id, match_id, amount_cents')
        .order('user_id', { ascending: true })
        .order('match_id', { ascending: true })
        .range(from, to))
    }
    catch { /* table missing — fall back to legacy unlocks only */ }
    let loveConnectionUnlocks: any[] = []
    try {
      loveConnectionUnlocks = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('love_connection_unlocks')
        .select('id, amount_cents, status')
        .neq('status', 'refunded')
        .order('id', { ascending: true })
        .range(from, to))
    } catch { /* connection paywall migration not applied yet */ }
    // ── Friend Maxxin metrics (wrapped so missing tables don't break the dashboard) ──
    // Hoisted so the top-level revenue total can fold in friend-side income.
    let friendPaidPacks = 0   // $0.99 packs actually bought (excludes free pro grants)
    let friendChatUnlocks = 0 // legacy per-crew $0.99 unlocks
    let friend: any = null
    try {
      const liveUsers = (users ?? []).filter((u: any) => !u.deleted_at)
      const optedIn = liveUsers.filter((u: any) => u.friend_opted_in_at)
      const [conns, circleMembers, acts, intentRows, actionRows, tripRows] = await Promise.all([
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_connections')
          .select('id, status, match_metro, match_context, match_expires_at')
          .order('id', { ascending: true }).range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_circle_members')
          .select('circle_id, user_id').is('left_at', null)
          .order('user_id', { ascending: true }).order('circle_id', { ascending: true }).range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_activities')
          .select('id, kind').order('id', { ascending: true }).range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_intents')
          .select('id, user_id, status, expires_at').order('id', { ascending: true }).range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_action_events')
          .select('id, user_id, event').gte('created_at', thirtyDaysAgo)
          .order('id', { ascending: true }).range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_trips')
          .select('id, user_id, destination_metro, starts_on, ends_on, status')
          .order('id', { ascending: true }).range(from, to)),
      ])
      const { count: fMsgCount } = await supabaseAdmin.from('friend_messages').select('id', { count: 'exact', head: true })
      const { count: unlockCount } = await supabaseAdmin.from('friend_chat_unlocks').select('user_id', { count: 'exact', head: true })
      const { count: clubCount } = await supabaseAdmin.from('friend_clubs').select('id', { count: 'exact', head: true }).eq('is_test', false).is('hidden_at', null)
      const { count: communityCount } = await supabaseAdmin.from('friend_community_links').select('id', { count: 'exact', head: true }).eq('is_test', false).eq('approved', true)
      const connList = conns
      friendChatUnlocks = unlockCount ?? 0
      try {
        // PAID packs only — synthetic ids (pro- grants, drop- weekly drops,
        // ref-/refwelcome- referral rewards) are free, never revenue.
        const roundRows = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin.from('friend_match_rounds')
          .select('id, stripe_payment_id').order('id', { ascending: true }).range(from, to))
        friendPaidPacks = roundRows.filter((r: any) => !/^(pro-|drop-|ref-|refwelcome-)/.test(String(r.stripe_payment_id ?? ''))).length
      } catch { /* friend_match_rounds not migrated yet */ }
      const realUserIds = new Set(liveUsers.map((u: any) => u.id))
      const realActions = actionRows.filter((event: any) => realUserIds.has(event.user_id))
      const uniqueActionUsers = (event: string) => new Set(realActions.filter((row: any) => row.event === event).map((row: any) => row.user_id)).size
      const connectionActionUsers = new Set(realActions.filter((row: any) => ['intent_joined', 'community_opened', 'club_joined', 'plan_rsvp'].includes(row.event)).map((row: any) => row.user_id)).size
      const today = new Date().toISOString().slice(0, 10)
      const realTrips = tripRows.filter((trip: any) => realUserIds.has(trip.user_id) && trip.status === 'active' && trip.ends_on >= today)
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
        activeCircles: new Set(circleMembers.map((m: any) => m.circle_id)).size,
        messages: fMsgCount ?? 0,
        posts: acts.filter((a: any) => a.kind === 'post').length,
        events: acts.filter((a: any) => a.kind !== 'post').length,
        openIntents: intentRows.filter((intent: any) => realUserIds.has(intent.user_id) && intent.status === 'open' && new Date(intent.expires_at).getTime() > Date.now()).length,
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
    let pageViews: PageViewRow[] | null = null
    let acquisitionTrackingReady = true
    try {
      pageViews = await fetchAllSupabaseRows<PageViewRow>((from, to) =>
        supabaseAdmin
          .from('page_views')
          .select('id, path, anon_id, referrer, display_mode, device_class, orientation, acquisition_source, acquisition_medium, acquisition_campaign, acquisition_kind, acquisition_landing_path, acquisition_captured_at, created_at')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      )
    } catch {
      acquisitionTrackingReady = false
      try {
        pageViews = await fetchAllSupabaseRows<PageViewRow>((from, to) => supabaseAdmin
          .from('page_views')
          .select('id, path, anon_id, referrer, display_mode, device_class, orientation, created_at')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to))
      } catch { pageViews = null }
    }

    let acquisitionEntries: any[] = []
    try {
      acquisitionEntries = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('raffle_entries')
        .select('user_id, created_at, acquisition_source, acquisition_medium, acquisition_campaign, acquisition_kind, acquisition_landing_path')
        .eq('event_key', RAFFLE.key)
        .eq('terms_version', RAFFLE.termsVersion)
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to))
    } catch {
      acquisitionTrackingReady = false
      acquisitionEntries = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('raffle_entries')
        .select('user_id, created_at')
        .eq('event_key', RAFFLE.key)
        .eq('terms_version', RAFFLE.termsVersion)
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to))
    }

    // First-party payment funnel, last 30 days. This is intentionally derived
    // from aggregate events and never exposes checkout/customer details.
    let monetization: any = null
    try {
      const rows = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('monetization_events')
        .select('id, user_id, event, product, amount_cents')
        .gte('created_at', thirtyDaysAgo)
        .order('id', { ascending: true })
        .range(from, to))
      {
        const productNames = ['love_connection', 'love_profile', 'friend_pack', 'pro']
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
      const rows = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('email_campaign_deliveries')
        .select('id, user_id, variant, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at')
        .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
        .order('id', { ascending: true })
        .range(from, to))
      {
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
        const [funnelRows, entriesResult] = await Promise.all([
          fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
            .from('campaign_funnel_events')
            .select('id, user_id, event')
            .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
            .order('id', { ascending: true })
            .range(from, to)),
          supabaseAdmin
            .from('raffle_entries')
            .select('user_id', { count: 'exact', head: true })
            .eq('event_key', RAFFLE.key)
            .eq('terms_version', RAFFLE.termsVersion)
            .neq('status', 'withdrawn'),
        ])
        const uniqueAt = (event: string) => new Set(
          funnelRows.filter((row: any) => row.event === event).map((row: any) => row.user_id)
        ).size
        const profileStarted = uniqueAt('profile_started')
        const profileSaved = uniqueAt('profile_saved')
        const profileEligible = Math.max(uniqueAt('profile_eligible'), profileNowEligible)
        const experimentViewed = uniqueAt('experiment_viewed')
        const rulesContinued = uniqueAt('rules_continued')
        const preferencesCompleted = uniqueAt('preferences_completed')
        const scheduleSelected = uniqueAt('schedule_selected')
        const questionnaireCompleted = uniqueAt('questionnaire_completed')
        const consentCompleted = uniqueAt('consent_completed')
        const entrySubmitAttempted = uniqueAt('entry_submit_attempted')
        const entrySubmitFailed = uniqueAt('entry_submit_failed')
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
            trackingReady: true,
            emailClicked: clicked,
            profileCtaClicked: profileClickerIds.size,
            profileStarted,
            profileSaved,
            profileEligible,
            profileNowEligible,
            experimentViewed,
            rulesContinued,
            preferencesCompleted,
            scheduleSelected,
            questionnaireCompleted,
            consentCompleted,
            entrySubmitAttempted,
            entrySubmitFailed,
            entrySubmitted,
            totalCurrentExperimentEntries: entriesResult.count ?? 0,
            profileClickToEligiblePct: percent(profileEligible, profileClickerIds.size),
            eligibleToEntryPct: percent(entrySubmitted, profileEligible),
            clickToEntryPct: percent(entrySubmitted, clicked),
          },
        }
      }
    } catch { loveCampaign = null }

    let eligibleReadyCampaign: any = null
    try {
      const [rows, funnelRows] = await Promise.all([
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
          .from('email_campaign_deliveries')
          .select('id,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,complained_at')
          .eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN)
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
          .from('campaign_funnel_events')
          .select('id,user_id,event')
          .eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN)
          .order('id', { ascending: true })
          .range(from, to)),
      ])
      {
        const uniqueAt = (event: string) => new Set(funnelRows.filter((row: any) => row.event === event).map((row: any) => row.user_id)).size
        const sent = rows.filter((row: any) => row.sent_at).length
        const delivered = rows.filter((row: any) => row.delivered_at).length
        const clicked = rows.filter((row: any) => row.clicked_at).length
        eligibleReadyCampaign = {
          key: ELIGIBLE_READY_REMINDER_CAMPAIGN,
          sent,
          delivered,
          opened: rows.filter((row: any) => row.opened_at).length,
          clicked,
          bounced: rows.filter((row: any) => row.bounced_at).length,
          complained: rows.filter((row: any) => row.complained_at).length,
          failed: rows.filter((row: any) => row.status === 'failed').length,
          deliveryRatePct: sent > 0 ? Math.round((delivered / sent) * 100) : null,
          clickRatePct: delivered > 0 ? Math.round((clicked / delivered) * 100) : null,
          experimentViewed: uniqueAt('experiment_viewed'),
          entrySubmitted: uniqueAt('entry_submitted'),
        }
      }
    } catch { eligibleReadyCampaign = null }

    const totalUsers = users.length
    const totalMatches = matches.length

    // ── Revenue: count ALL of it, by real amount (cents → dollars) ──
    const loveUnlockCents =
      matchUnlocks.reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0) +
      (unlocks ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
    const loveConnectionCents = loveConnectionUnlocks.reduce((sum: number, row: any) => sum + (row.amount_cents ?? 0), 0)
    const packCents = friendPaidPacks * 99
    const friendLegacyCents = friendChatUnlocks * 99
    const oneTimeCents = loveUnlockCents + loveConnectionCents + packCents + friendLegacyCents // collected to date
    // Active All-Access subscribers → monthly recurring revenue.
    const activeSubs = users.filter(
      (u: any) => !u.deleted_at && u.friend_pro_until && new Date(u.friend_pro_until).getTime() > nowMs
    ).length
    const mrrCents = activeSubs * 399
    const totalRevenue = oneTimeCents / 100 // one-time collected (subs shown separately as MRR)
    const revenue = {
      loveUnlocks: (loveUnlockCents / 100).toFixed(2),
      loveConnections: (loveConnectionCents / 100).toFixed(2),
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
    const other = users.filter(u => !['m', 'f'].includes(u.gender)).length

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
    const allUsers = users
    const allMatches = matches
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
    let onlyInBoston: any = null
    if (pageViews) {
      const pathCounts: Record<string, number> = {}
      const sessions = new Set<string>()
      const pwaSessions = new Set<string>()
      const viewsByDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        viewsByDay[d.toISOString().split('T')[0]] = 0
      }
      pageViews.forEach((v: any) => {
        pathCounts[v.path] = (pathCounts[v.path] || 0) + 1
        if (v.anon_id) sessions.add(v.anon_id)
        if (v.display_mode === 'standalone' && v.anon_id) pwaSessions.add(v.anon_id)
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
        pwaViews: pageViews.filter((view: any) => view.display_mode === 'standalone').length,
        pwaSessions: pwaSessions.size,
        browserViews: pageViews.filter((view: any) => view.display_mode === 'browser').length,
        phoneViews: pageViews.filter((view: any) => view.device_class === 'phone').length,
        landscapePhoneViews: pageViews.filter((view: any) => view.device_class === 'phone' && view.orientation === 'landscape').length,
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

      const campaign = ONLY_IN_BOSTON_CAMPAIGN
      const launchViews = pageViews.filter((view) => view.created_at >= campaign.launchStartedAt)
      const attributedViews = launchViews.filter((view) =>
        view.acquisition_campaign === campaign.campaign || view.acquisition_source === campaign.source
      )
      const instagramReferralViews = launchViews.filter((view) =>
        view.acquisition_source === 'instagram' || /(^|\.)instagram\.com/i.test((() => {
          try { return view.referrer ? new URL(view.referrer).hostname : '' } catch { return '' }
        })())
      )
      const facebookReferralViews = launchViews.filter((view) =>
        view.acquisition_source === 'facebook' || /(^|\.)facebook\.com/i.test((() => {
          try { return view.referrer ? new URL(view.referrer).hostname : '' } catch { return '' }
        })())
      )
      const experimentViews = launchViews.filter((view) => view.path === campaign.landingPath)
      const sessionsOf = (views: PageViewRow[]) => new Set(views.map((view) => view.anon_id).filter(Boolean)).size
      const campaignMatch = (row: any) => row.acquisition_campaign === campaign.campaign || row.acquisition_source === campaign.source
      const newSignups = users.filter((user: any) => user.created_at >= campaign.launchStartedAt)
      const directSignups = newSignups.filter(campaignMatch)
      const launchEntries = acquisitionEntries.filter((entry: any) => entry.created_at >= campaign.launchStartedAt)
      const directEntries = launchEntries.filter(campaignMatch)
      const percent = (numerator: number, denominator: number) => denominator > 0
        ? Math.round((numerator / denominator) * 100)
        : null
      const taggedChannel = (channel: typeof ONLY_IN_BOSTON_CAMPAIGN | typeof ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN) => {
        const channelMatch = (row: any) => campaignMatch(row) && row.acquisition_medium === channel.medium
        const views = attributedViews.filter(channelMatch)
        const signups = directSignups.filter(channelMatch)
        const entries = directEntries.filter(channelMatch)
        const sessions = sessionsOf(views)
        return {
          medium: channel.medium,
          taggedUrl: `https://notcupid.com${channel.shortPath}`,
          sessions,
          landingSessions: sessionsOf(views.filter((view) => view.path === channel.landingPath)),
          pageViews: views.length,
          signups: signups.length,
          entries: entries.length,
          visitToSignupPct: percent(signups.length, sessions),
          visitToEntryPct: percent(entries.length, sessions),
        }
      }
      onlyInBoston = {
        launchStartedAt: campaign.launchStartedAt,
        launchLabel: campaign.launchLabel,
        campaignActive: nowMs <= new Date(RAFFLE.entryClose).getTime(),
        measuredAt: new Date(nowMs).toISOString(),
        trackingReady: acquisitionTrackingReady,
        taggedUrl: `https://notcupid.com${campaign.shortPath}`,
        attributedSessions: sessionsOf(attributedViews),
        attributedLandingSessions: sessionsOf(attributedViews.filter((view) => view.path === campaign.landingPath)),
        attributedPageViews: attributedViews.length,
        attributedSignups: directSignups.length,
        attributedEntries: directEntries.length,
        attributedVisitToSignupPct: percent(directSignups.length, sessionsOf(attributedViews)),
        attributedVisitToEntryPct: percent(directEntries.length, sessionsOf(attributedViews)),
        instagramReferralSessions: sessionsOf(instagramReferralViews),
        facebookReferralSessions: sessionsOf(facebookReferralViews),
        channels: {
          instagramStory: taggedChannel(ONLY_IN_BOSTON_CAMPAIGN),
          facebookStory: taggedChannel(ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN),
        },
        launchWindowSessions: sessionsOf(launchViews),
        experimentSessions: sessionsOf(experimentViews),
        launchWindowPageViews: launchViews.length,
        launchWindowSignups: newSignups.length,
        launchWindowEntries: launchEntries.length,
      }
    }

    // ───────────── Love Line usage (independent of Dating Experiment) ─────────────
    // Authenticated actions establish real product use. Anonymous /dashboard
    // sessions are kept separate so a refresh or campaign landing cannot be
    // mistaken for a person picking or talking to a match.
    const realMatchIds = new Set(matches.map((match: any) => match.id))
    const summarizeLoveUsage = (cutoff: string) => {
      const loveViews = (pageViews ?? []).filter((view) =>
        view.path === '/dashboard' && view.created_at >= cutoff
      )
      const loveVisitSessions = new Set(loveViews.map((view) => view.anon_id).filter(Boolean))
      const signedInAccounts = new Set(recentSessions
        .filter((session: any) => session.last_used_at >= cutoff && realUserIds.has(session.user_id))
        .map((session: any) => session.user_id))
      const recentExposures = rosterExposures.filter((exposure: any) =>
        exposure.shown_at >= cutoff && realUserIds.has(exposure.user_id) && realUserIds.has(exposure.candidate_id)
      )
      const rosterCompositionAccounts = new Set(recentExposures.map((exposure: any) => exposure.user_id))
      const recentPicks = rosterExposures.filter((exposure: any) =>
        exposure.picked_at && exposure.picked_at >= cutoff && realUserIds.has(exposure.user_id) && realUserIds.has(exposure.candidate_id)
      )
      const pickers = new Set(recentPicks.map((exposure: any) => exposure.user_id))
      const recentMessages = msgRows.filter((message: any) =>
        message.created_at >= cutoff && realUserIds.has(message.sender_id) && realMatchIds.has(message.match_id)
      )
      const messageSenders = new Set(recentMessages.map((message: any) => message.sender_id))
      const activeConversations = new Set(recentMessages.map((message: any) => message.match_id))
      const newlyCreatedMutuals = matches.filter((match: any) =>
        match.created_at >= cutoff && match.user_1_accepted && match.user_2_accepted
      )
      const mutualParticipants = new Set<string>()
      newlyCreatedMutuals.forEach((match: any) => {
        mutualParticipants.add(match.user_1_id)
        mutualParticipants.add(match.user_2_id)
      })
      const meaningfulAccounts = new Set<string>([
        ...pickers,
        ...messageSenders,
        ...mutualParticipants,
      ])

      return {
        signedInAccounts: signedInAccounts.size,
        loveViews: loveViews.length,
        loveVisitSessions: loveVisitSessions.size,
        rosterCompositionAccounts: rosterCompositionAccounts.size,
        picks: recentPicks.length,
        pickers: pickers.size,
        messages: recentMessages.length,
        messageSenders: messageSenders.size,
        activeConversations: activeConversations.size,
        newlyCreatedMutuals: newlyCreatedMutuals.length,
        mutualParticipants: mutualParticipants.size,
        meaningfulLoveAccounts: meaningfulAccounts.size,
      }
    }
    const everMatchedIds = new Set<string>()
    const everMutualIds = new Set<string>()
    matches.forEach((match: any) => {
      everMatchedIds.add(match.user_1_id)
      everMatchedIds.add(match.user_2_id)
      if (match.user_1_accepted && match.user_2_accepted) {
        everMutualIds.add(match.user_1_id)
        everMutualIds.add(match.user_2_id)
      }
    })
    const everMessageSenders = new Set(msgRows
      .filter((message: any) => realUserIds.has(message.sender_id) && realMatchIds.has(message.match_id))
      .map((message: any) => message.sender_id))
    const loveUsage = {
      last24h: summarizeLoveUsage(oneDayAgo),
      last7d: summarizeLoveUsage(sevenDaysAgo),
      lifetime: {
        matches: matches.length,
        mutualMatches: bothAccepted,
        everMatchedAccounts: everMatchedIds.size,
        everMutualAccounts: everMutualIds.size,
        everMessageSenders: everMessageSenders.size,
      },
      trafficAvailable: pageViews !== null,
      measurementNotes: [
        'Signed-in accounts come from authenticated session activity anywhere in the app.',
        'Picks, mutual participants, and message senders are authenticated Love Line actions.',
        'Roster compositions include both interactive opens and scheduled rotation, so they are context rather than meaningful use.',
        'Love visits are anonymous browser/PWA sessions and are reported separately from people taking actions.',
        'Dating Experiment entries and all test accounts are excluded.',
      ],
    }

    // ───────────── Love concierge decision funnel ─────────────
    // This is the operational view: inventory, unanswered choices, reminder
    // reach, and the point where a notification turned into a decision.
    const closedStatuses = new Set(['ended', 'passed', 'expired'])
    const liveLoveMatches = matches.filter((match: any) =>
      !match.ended_at
      && !closedStatuses.has(match.status)
      && ((match.user_1_accepted && match.user_2_accepted)
        || !match.expires_at
        || new Date(match.expires_at).getTime() >= nowMs)
    )
    const oneSidedMatches = liveLoveMatches.filter((match: any) =>
      Boolean(match.user_1_accepted) !== Boolean(match.user_2_accepted)
    )
    const needsAnswerIds = new Set<string>()
    const awaitingAnswerIds = new Set<string>()
    const unanswered24hIds = new Set<string>()
    const unanswered48hIds = new Set<string>()
    for (const match of oneSidedMatches) {
      const recipientId = match.user_1_accepted ? match.user_2_id : match.user_1_id
      const chooserId = match.user_1_accepted ? match.user_1_id : match.user_2_id
      needsAnswerIds.add(recipientId)
      awaitingAnswerIds.add(chooserId)
      const ageMs = nowMs - new Date(match.created_at).getTime()
      if (ageMs >= 24 * 60 * 60 * 1000) unanswered24hIds.add(recipientId)
      if (ageMs >= 48 * 60 * 60 * 1000) unanswered48hIds.add(recipientId)
    }
    const active12dIds = new Set(recentSessions
      .filter((session: any) => session.last_used_at >= twelveDaysAgo && realUserIds.has(session.user_id))
      .map((session: any) => session.user_id))
    const activePoolIds = new Set(users
      .filter((user: any) => active12dIds.has(user.id)
        && user.pool_active === true
        && !user.deleted_at
        && !user.is_blocked
        && !user.matching_disabled_at
        && !!user.archetype)
      .map((user: any) => user.id))
    const liveParticipantIds = new Set<string>()
    liveLoveMatches.forEach((match: any) => {
      liveParticipantIds.add(match.user_1_id)
      liveParticipantIds.add(match.user_2_id)
    })
    const waitingWithoutConnection = Array.from(activePoolIds).filter((id) => !liveParticipantIds.has(id)).length
    const freshRosterIds = new Set(rosterExposures
      .filter((exposure: any) => exposure.shown_at >= oneDayAgo && activePoolIds.has(exposure.user_id))
      .map((exposure: any) => exposure.user_id))
    const recentPickerIds = new Set(rosterExposures
      .filter((exposure: any) => exposure.picked_at && exposure.picked_at >= sevenDaysAgo && activePoolIds.has(exposure.user_id))
      .map((exposure: any) => exposure.user_id))
    const mutualMatches = liveLoveMatches.filter((match: any) => match.user_1_accepted && match.user_2_accepted)
    const messagedMatchIds = new Set(msgRows
      .filter((message: any) => realUserIds.has(message.sender_id))
      .map((message: any) => message.match_id))
    const sentStatuses = new Set(['sent', 'delivered', 'opened', 'clicked'])
    const emailEvents = loveNotificationEvents.filter((event: any) => event.channel === 'email')
    const eventCount = (type: string, statuses?: Set<string>) => emailEvents.filter((event: any) =>
      event.notification_type === type && (!statuses || statuses.has(event.status))
    ).length
    const responsePairs = new Set(loveNotificationEvents
      .filter((event: any) => event.responded_at && event.response)
      .map((event: any) => `${event.match_id}:${event.recipient_id}:${event.response}`))
    const responseCount = (response: string) => Array.from(responsePairs).filter((key) => key.endsWith(`:${response}`)).length
    const loveFunnel = {
      measuredAt: new Date(nowMs).toISOString(),
      active12d: active12dIds.size,
      activePool: activePoolIds.size,
      freshRosters24h: freshRosterIds.size,
      activePoolWithoutLiveConnection: waitingWithoutConnection,
      activePoolWithoutPick7d: Array.from(activePoolIds).filter((id) => !recentPickerIds.has(id)).length,
      liveConnections: liveLoveMatches.length,
      oneSidedConnections: oneSidedMatches.length,
      mutualConnections: mutualMatches.length,
      mutualWithoutMessage: mutualMatches.filter((match: any) => !messagedMatchIds.has(match.id)).length,
      peopleNeedToAnswer: needsAnswerIds.size,
      peopleAwaitingAnswer: awaitingAnswerIds.size,
      unanswered24h: unanswered24hIds.size,
      unanswered48h: unanswered48hIds.size,
      notifications: {
        immediateSent: eventCount('interest_immediate', sentStatuses),
        reminder24hSent: eventCount('decision_24h', sentStatuses),
        finalSent: eventCount('decision_final', sentStatuses),
        mutualNoMessage12hSent: eventCount('mutual_no_message_12h', sentStatuses),
        delivered: emailEvents.filter((event: any) => ['delivered', 'opened', 'clicked'].includes(event.status)).length,
        opened: emailEvents.filter((event: any) => ['opened', 'clicked'].includes(event.status)).length,
        clicked: emailEvents.filter((event: any) => event.status === 'clicked').length,
        failed: emailEvents.filter((event: any) => event.status === 'failed').length,
      },
      decisions: {
        accepted: responseCount('accepted'),
        passed: responseCount('passed'),
        expired: responseCount('expired'),
      },
      notes: [
        'A live connection is pending inside its 72-hour decision window or mutually accepted.',
        'Need to answer means someone else already chose them; awaiting means they made the first choice.',
        '24-hour and near-expiry deliveries are deduplicated by match, recipient, and channel.',
      ],
    }

    const bottlenecks = detectProductBottlenecks({
      measuredAt: loveFunnel.measuredAt,
      onlyInBoston,
      loveUsage,
      loveFunnel,
      appExperience,
      monetization,
      friend,
    })

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue: totalRevenue.toFixed(2), mrr: revenue.mrr, activeSubs, revenue, pendingMatches, bothAccepted, passed, passRate, waiting, matched, men, women, other },
      signupsPerDay: days,
      funnel,
      traffic,
      onlyInBoston,
      loveUsage,
      loveFunnel,
      appExperience,
      monetization,
      loveCampaign,
      eligibleReadyCampaign,
      friend,
      bottlenecks,
      recentUsers,
      recentMatches,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
