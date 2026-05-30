import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { metroOf } from '@/lib/quiz-data'
import { metroGenderCounts, shouldHoldForBalance } from '@/lib/balance'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, age, gender, seeking, zip, email,
      age_min, age_max,
      score_honesty, score_emotionality, score_extraversion,
      score_agreeableness, score_conscientiousness, score_openness,
      archetype,
      vibes,
      relationship_style,
    } = body

    const VALID_RELATIONSHIP_STYLES = new Set([
      'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
    ])

    if (!name || !age || !gender || !seeking || !zip || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const insertRow: any = {
      name, age: parseInt(age), gender, seeking, zip, email,
      age_min: age_min ?? 18, age_max: age_max ?? 99,
      score_honesty, score_emotionality, score_extraversion,
      score_agreeableness, score_conscientiousness, score_openness,
      archetype, status: 'waiting',
    }
    if (vibes && typeof vibes === 'object') insertRow.vibes = vibes
    if (relationship_style && VALID_RELATIONSHIP_STYLES.has(relationship_style)) {
      insertRow.relationship_style = relationship_style
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([insertRow])
      .select().single()

if (error) {
  if (error.code === '23505') {
    // Expected, handled case — client looks up the existing user and
    // redirects to their dashboard. Logged as warn (not error) so real
    // failures stand out in Vercel logs.
    console.warn('Submit: duplicate email, redirecting to existing account', { email })
    return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  }
  console.error('Submit: supabase error:', error)
  return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
}
    // Gender-balance intake gate: if this signup would push their metro's
    // active pool past the ratio ceiling, hold them in a soft "early access"
    // state (pool_active=false) instead of matching. The cron releases them
    // as the scarce side joins, or after a 3-day cap. They just see the normal
    // positive "in the queue" state — no negative messaging.
    let held = false
    try {
      const counts = await metroGenderCounts()
      const metro = metroOf(data.zip) ?? 'unknown'
      if (shouldHoldForBalance(counts[metro], data.gender)) {
        await supabaseAdmin
          .from('users')
          .update({ pool_active: false, balance_hold_at: new Date().toISOString() })
          .eq('id', data.id)
        held = true
      }
    } catch (e) {
      console.error('Submit: balance gate check failed (matching anyway):', e)
    }

    if (!held) {
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id })
      }).catch(err => console.error('Match trigger error:', err))
    }

    return NextResponse.json({ success: true, userId: data.id })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
