import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS } from '@/lib/quiz-data'
import { compatibilityScore, thresholdFor } from '@/lib/matching'
import { intentOf, intentCompatible, equityBonus } from '@/lib/pools'
import { renderEmail, sendEmail, button, C } from '@/lib/email'

const RADIUS_NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

// Compatible people exist but all sit beyond the user's radius → email them
// to widen their search. Deduped (3-day cooldown) and gated on opt-out.
async function maybeSendRadiusNudge(user: any, compatibleCount: number) {
  if (compatibleCount === 0) return // no gender/age-compatible people at all — widening won't help
  if (user.email_notifications === false) return
  const radius = user.match_radius ?? DEFAULT_MATCH_RADIUS
  if (radius >= MAX_MATCH_RADIUS) return // already as wide as it goes
  const last = user.radius_nudge_sent_at ? new Date(user.radius_nudge_sent_at).getTime() : 0
  if (Date.now() - last < RADIUS_NUDGE_COOLDOWN_MS) return
  if (!user.email) return

  // Mark first so a slow/failed send can't spam on the next cron tick.
  await supabaseAdmin.from('users').update({ radius_nudge_sent_at: new Date().toISOString() }).eq('id', user.id)

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const html = renderEmail({
    preheader: `Your area's quiet at ${radius}mi — widen your search to meet more people.`,
    eyebrow: 'your pool is thin',
    headline: 'Quiet within your range right now.',
    bodyHtml: `
      <p style="margin:0 0 16px 0;">There are people who could be a fit — they're just sitting a little past your ${radius}-mile range. Widen your search and the algorithm can reach them on the next run.</p>
      ${button({ href: `${base}/dashboard`, label: 'Widen my search →' })}
      <p style="margin:16px 0 0 0;font-size:13px;color:${C.muted};">One tap on your dashboard bumps it out in 15-mile steps, up to 75. You can always tighten it back.</p>
    `,
    recipientId: user.id,
    footerNote: 'good matches are worth a few extra miles.',
  })
  await sendEmail({
    to: user.email,
    subject: `it's quiet within ${radius}mi — widen your search?`,
    html,
  }).catch(() => {})
}

// A candidate is in range if within the SEARCHER's radius. Unknown coords
// (null) pass through, same as before.
function isWithinMatchRadius(zip1: string, zip2: string, radiusMiles: number): boolean {
  const dist = zipDistanceMiles(zip1, zip2)
  if (dist === null) return true
  return dist <= radiusMiles
}

function isGenderMatch(user: any, candidate: any): boolean {
  const userSeeks = user.seeking
  const candGender = candidate.gender
  const candSeeks = candidate.seeking
  const userGender = user.gender

  const userWantsCand = userSeeks === 'b' || userSeeks === candGender
  const candWantsUser = candSeeks === 'b' || candSeeks === userGender

  return userWantsCand && candWantsUser
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    const { data: user } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (user.pool_active === false) {
      return NextResponse.json({ matched: false, message: 'Waiting for the next pool wave' })
    }

    const nowIso = new Date().toISOString()
    const { data: pool } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('status', 'waiting')
      .eq('pool_active', true)
      .eq('is_blocked', false)
      .neq('id', userId)
      .is('matching_disabled_at', null)
      .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`)

    if (!pool || pool.length === 0) {
      return NextResponse.json({ matched: false, message: 'In the pool — watching for matches' })
    }

    const genderCompatible = pool.filter((p: any) => isGenderMatch(user, p))

    const ageCompatible = genderCompatible.filter((p: any) =>
      user.age >= p.age_min &&
      user.age <= p.age_max &&
      p.age >= user.age_min &&
      p.age <= user.age_max
    )

    const radiusMiles = user.match_radius ?? DEFAULT_MATCH_RADIUS
    const locationCompatible = ageCompatible.filter((p: any) =>
      isWithinMatchRadius(user.zip, p.zip, radiusMiles)
    )

    if (locationCompatible.length === 0) {
      // Compatible people exist but all beyond the radius → nudge to widen.
      // Awaited so the dedup write lands; the email send itself is swallowed.
      await maybeSendRadiusNudge(user, ageCompatible.length)
      return NextResponse.json({ matched: false, message: 'No compatible matches nearby yet' })
    }

    // Hard cluster segregation: ENM/poly is a closed pool. An enm user only
    // sees other enm users, and monogamous users never see enm candidates
    // (and vice versa). serious/casual/open stay soft-prioritized below.
    const uIntent = intentOf(user)
    const clusterCompatible = locationCompatible.filter((p: any) => {
      const pIntent = intentOf(p)
      if (uIntent === 'enm' || pIntent === 'enm') return uIntent === 'enm' && pIntent === 'enm'
      return true
    })

    if (clusterCompatible.length === 0) {
      return NextResponse.json({ matched: false, message: 'No compatible matches in your cluster yet' })
    }

    const scored = clusterCompatible
      .map((p: any) => ({ ...p, score: compatibilityScore(user, p) }))
      .sort((a: any, b: any) => b.score - a.score)

    // How long has this user been waiting? Since their most recent ended
    // match, or signup if they've never matched. Feeds the wait-time decay
    // so long-waiters get a gradually easier bar.
    const { data: lastEnded } = await supabaseAdmin
      .from('matches')
      .select('ended_at')
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const waitStartMs = lastEnded?.ended_at
      ? new Date(lastEnded.ended_at).getTime()
      : new Date(user.created_at).getTime()
    const waitDays = Math.max(0, (Date.now() - waitStartMs) / 86_400_000)

    const minScore = thresholdFor(user, pool || [], { waitDays })
    const clearing = scored.filter((p: any) => p.score >= minScore)

    if (clearing.length === 0) {
      console.warn('[match] rejected (threshold)', {
        userId: String(userId).slice(0, 8),
        gender: user.gender,
        topScore: scored[0]?.score ?? null,
        requiredScore: minScore,
        poolSize: pool?.length || 0,
      })
      return NextResponse.json({
        matched: false,
        message: 'No strong matches yet',
        debug: { topScore: scored[0]?.score ?? null, requiredScore: minScore },
      })
    }

    // Intent prioritization (prioritize, don't constrain): among candidates
    // that clear the threshold, prefer the best one whose relationship intent
    // is compatible (same bucket, or either side is 'open'). If none of the
    // clearing candidates is intent-compatible, fall back to the best overall
    // so a thin segment never blocks a match. `clearing` is already sorted by
    // score desc, so [0] of each subset is its top-scorer.
    // Equity rotation: among threshold-clearing candidates, rank by
    // (compatibility + a small under-served bonus) so the same high-scorers
    // don't monopolize the scarce side. Compatibility still dominates; this
    // only tips near-ties toward people who haven't matched recently.
    const nowMs = Date.now()
    const rank = (arr: any[]) =>
      arr
        .map((p: any) => ({ ...p, eff: p.score + equityBonus(p.last_matched_at, nowMs) }))
        .sort((a: any, b: any) => b.eff - a.eff)

    const userIntent = intentOf(user)
    const sameIntent = rank(clearing.filter((p: any) => intentCompatible(userIntent, intentOf(p))))
    const best = (sameIntent.length > 0 ? sameIntent : rank(clearing))[0]

    // Atomic claim BEFORE creating the match, so a concurrent roster-pick (or
    // another match run) can't double-match either party. Each claim only
    // succeeds if the user is still 'waiting'.
    const matchedAt = new Date().toISOString()
    const { data: claimedSelf } = await supabaseAdmin
      .from('users').update({ status: 'matched', last_matched_at: matchedAt }).eq('id', userId).eq('status', 'waiting').select('id')
    if (!claimedSelf || claimedSelf.length === 0) {
      return NextResponse.json({ matched: false, message: 'Already matched' })
    }
    const { data: claimedBest } = await supabaseAdmin
      .from('users').update({ status: 'matched', last_matched_at: matchedAt }).eq('id', best.id).eq('status', 'waiting').select('id')
    if (!claimedBest || claimedBest.length === 0) {
      // Candidate was claimed by someone else a moment ago — release self.
      await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', userId)
      return NextResponse.json({ matched: false, message: 'Candidate just got matched' })
    }

    const { data: match } = await supabaseAdmin
      .from('matches')
      .insert([{
        user_1_id: userId,
        user_2_id: best.id,
        compatibility_score: best.score,
        status: 'pending',
        // Unaccepted matches expire 72h after creation (accepted chats get
        // their own 36h inactivity window). Drives the card countdown + the
        // "accept window closing" reminder consistently.
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      }])
      .select().single()

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user1: user,
        user2: best,
        score: best.score,
        matchId: match.id
      })
    })

    return NextResponse.json({ matched: true, score: best.score, matchId: match.id })
  } catch (err) {
    console.error('Match error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
