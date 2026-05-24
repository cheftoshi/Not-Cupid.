import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const SCORE_THRESHOLD = 15

function compatibilityScore(a: any, b: any): number {
  const honesty = Math.abs(a.score_honesty - b.score_honesty)
  const openness = Math.abs(a.score_openness - b.score_openness)
  const agree = Math.abs(a.score_agreeableness - b.score_agreeableness)
  const extro = Math.abs(a.score_extraversion - b.score_extraversion)
  const diff = (honesty * 2) + (openness * 1.5) + (agree * 1.5) + extro
  return Math.round(100 - (diff / 48) * 100)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    const { data: user } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: pool } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('status', 'waiting')
      .eq('gender', user.seeking)
      .eq('seeking', user.gender)
      .neq('id', userId)

    if (!pool || pool.length === 0) {
      return NextResponse.json({ matched: false, message: 'In the pool — watching for matches' })
    }

    const ageCompatible = pool.filter((p: any) =>
      user.age >= p.age_min &&
      user.age <= p.age_max &&
      p.age >= user.age_min &&
      p.age <= user.age_max
    )

    if (ageCompatible.length === 0) {
      return NextResponse.json({ matched: false, message: 'No age-compatible matches yet' })
    }

    const scored = ageCompatible
      .map((p: any) => ({ ...p, score: compatibilityScore(user, p) }))
      .sort((a: any, b: any) => b.score - a.score)

    const best = scored[0]
    if (best.score < SCORE_THRESHOLD) {
      return NextResponse.json({ matched: false, message: 'No strong matches yet' })
    }

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
