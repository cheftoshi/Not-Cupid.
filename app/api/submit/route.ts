import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, age, gender, seeking, zip, email,
      age_min, age_max,
      score_honesty, score_emotionality, score_extraversion,
      score_agreeableness, score_conscientiousness, score_openness,
      archetype
    } = body

    if (!name || !age || !gender || !seeking || !zip || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{
        name, age: parseInt(age), gender, seeking, zip, email,
        age_min: age_min ?? 18, age_max: age_max ?? 99,
        score_honesty, score_emotionality, score_extraversion,
        score_agreeableness, score_conscientiousness, score_openness,
        archetype, status: 'waiting'
      }])
      .select().single()

if (error) {
  console.error('Supabase error:', error)
  if (error.code === '23505') {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
}
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.id })
    }).catch(err => console.error('Match trigger error:', err))

    return NextResponse.json({ success: true, userId: data.id })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
