import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const matchId = searchParams.get('matchId')
    const userId = searchParams.get('userId')

    if (!matchId || !userId) {
      return new NextResponse('Invalid link', { status: 400 })
    }

    const { data: match } = await supabaseAdmin
      .from('matches').select('*').eq('id', matchId).single()

    if (!match) return new NextResponse('Match not found', { status: 404 })

    // Update match status to passed
    await supabaseAdmin
      .from('matches')
      .update({ status: 'passed' })
      .eq('id', matchId)

    // Put both users back in the pool as waiting
    await supabaseAdmin
      .from('users')
      .update({ status: 'waiting' })
      .in('id', [match.user_1_id, match.user_2_id])

    // Get the other user's name for the message
    const otherId = match.user_1_id === userId ? match.user_2_id : match.user_1_id
    const { data: other } = await supabaseAdmin
      .from('users').select('name').eq('id', otherId).single()

    // Send a "back in the pool" email to the person who passed
    const { data: user } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).single()

    if (user) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NotCupid <match@notcupid.com>',
          to: [user.email],
          subject: 'You passed — back in the pool',
          html: `
            <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
              <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
              <p style="font-size:.75rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">noted.</p>
              <p style="font-size:1.1rem;color:#0e0c1a;font-weight:500;margin-bottom:1.5rem">You passed on ${other?.name ?? 'your match'}. No hard feelings.</p>
              <p style="font-size:.88rem;color:#7a7590;line-height:1.75;margin-bottom:1.5rem">
                You're back in the Boston pool. The algorithm is already looking for your next match. We'll email you when we find one.
              </p>
              <div style="padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">
                Boston only · notcupid.com · the algo decided
              </div>
            </div>
          `
        })
      })
    }

    return new NextResponse(`
      <html><body style="font-family:monospace;max-width:480px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
        <h1 style="font-size:2rem;color:#0e0c1a;margin-bottom:1rem">Passed. 👋</h1>
        <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">No hard feelings. You're back in the Boston pool — we'll email you when the algorithm finds your next match.</p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })

  } catch (err) {
    console.error('Match pass error:', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
