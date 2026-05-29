import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS } from '@/lib/quiz-data'
import { compatibilityScore, thresholdFor } from '@/lib/matching'
import { intentOf, intentCompatible } from '@/lib/pools'

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
      return NextResponse.json({ matched: false, message: 'No compatible matches nearby yet' })
    }

    const scored = locationCompatible
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
    const userIntent = intentOf(user)
    const sameIntent = clearing.filter((p: any) => intentCompatible(userIntent, intentOf(p)))
    const best = (sameIntent.length > 0 ? sameIntent : clearing)[0]

    const { data: match } = await supabaseAdmin
      .from('matches')
      .insert([{
        user_1_id: userId,
        user_2_id: best.id,
        compatibility_score: best.score,
        status: 'pending'
      }])
      .select().single()

    await supabaseAdmin.from('users').update({ status: 'matched' }).eq('id', userId)
    await supabaseAdmin.from('users').update({ status: 'matched' }).eq('id', best.id)

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
