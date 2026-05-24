import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BOSTON_SPOTS = [
  'Trident Booksellers & Cafe on Newbury St',
  'Thinking Cup on Tremont St',
  'Render Coffee on Columbus Ave',
  'The Beehive in the South End',
  'Area Four in Kendall Square',
  'The Berkeley in Back Bay',
  'Broadsheet Coffee in Downtown Crossing',
  'George Howell Coffee at the Godfrey Hotel',
]

function matchEmail(name: string, otherName: string, score: number, spot: string, matchId: string, userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  const acceptUrl = `${baseUrl}/api/match-accept?matchId=${matchId}&userId=${userId}`
  const passUrl = `${baseUrl}/api/match-pass?matchId=${matchId}&userId=${userId}`
  return `
    <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
      <p style="font-size:.75rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">The algorithm has spoken</p>
      <p style="font-size:1.1rem;color:#0e0c1a;font-weight:500;margin-bottom:1.5rem;line-height:1.5">Hey ${name} — we found your match.</p>
      <div style="background:#ede9ff;padding:1.5rem;margin-bottom:1.5rem">
        <p style="font-size:.72rem;color:#7a7590;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.5rem">Compatibility score</p>
        <p style="font-size:2.5rem;font-weight:700;color:#8b7fd4;line-height:1">${score}<span style="font-size:1rem;color:#c8c4dc">%</span></p>
      </div>
      <p style="font-size:.88rem;color:#7a7590;line-height:1.75;margin-bottom:1.5rem">
        Your match is <strong style="color:#0e0c1a">${otherName}</strong>. Based on six dimensions of your personality, the algorithm thinks you two are worth meeting.
      </p>
      <div style="background:#fff;border:1px solid #c8c4dc;padding:1.25rem;margin-bottom:1.5rem">
        <p style="font-size:.65rem;color:#8b7fd4;letter-spacing:.15em;text-transform:uppercase;margin-bottom:.5rem">Suggested first spot</p>
        <p style="font-size:.9rem;color:#0e0c1a;font-weight:500">${spot}</p>
      </div>
      <p style="font-size:.85rem;color:#0e0c1a;font-weight:500;margin-bottom:1rem">Are you interested in meeting ${otherName}?</p>
      <p style="font-size:.78rem;color:#7a7590;line-height:1.65;margin-bottom:1.5rem">
        If both of you say yes — you'll get each other's email. If either passes, you go back in the pool.
      </p>
      <div style="display:flex;gap:1rem;margin-bottom:2rem">
        <a href="${acceptUrl}" style="flex:1;display:block;background:#0e0c1a;color:#f8f5ff;padding:1rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;text-align:center">Yes, I'm interested →</a>
        <a href="${passUrl}" style="flex:1;display:block;background:transparent;color:#7a7590;border:1px solid #c8c4dc;padding:1rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;text-align:center">Pass on this one</a>
      </div>
      <div style="padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">
        Boston only · notcupid.com · the algo decided
      </div>
    </div>
  `
}

export async function GET(req: NextRequest) {
  try {
    const { data: matches } = await supabaseAdmin
      .from('matches').select('*').eq('status', 'pending')

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No pending matches' })
    }

    const results = []

    for (const match of matches) {
      const { data: user1 } = await supabaseAdmin
        .from('users').select('*').eq('id', match.user_1_id).single()
      const { data: user2 } = await supabaseAdmin
        .from('users').select('*').eq('id', match.user_2_id).single()

      if (!user1 || !user2) continue

      const spot = BOSTON_SPOTS[Math.floor(Math.random() * BOSTON_SPOTS.length)]

      await Promise.all([
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NotCupid <match@notcupid.com>',
            to: [user1.email],
            subject: `${user2.name} — your NotCupid match is ready`,
            html: matchEmail(user1.name, user2.name, match.compatibility_score, spot, match.id, user1.id)
          })
        }),
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NotCupid <match@notcupid.com>',
            to: [user2.email],
            subject: `${user1.name} — your NotCupid match is ready`,
            html: matchEmail(user2.name, user1.name, match.compatibility_score, spot, match.id, user2.id)
          })
        })
      ])

      results.push({
        match_id: match.id,
        user1: user1.name,
        user2: user2.name,
        score: match.compatibility_score,
        spot
      })
    }

    return NextResponse.json({ success: true, sent: results.length, matches: results })
  } catch (err) {
    console.error('Admin send error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
