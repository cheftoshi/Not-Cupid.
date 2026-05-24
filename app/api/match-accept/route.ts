import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const matchId = searchParams.get('matchId')
    const userId = searchParams.get('userId')

    if (!matchId || !userId) {
      return new NextResponse(`
        <html><body style="font-family:monospace;max-width:480px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
          <h1 style="font-size:2rem;color:#0e0c1a;margin-bottom:1rem">Invalid link</h1>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4">Back to NotCupid →</a>
        </body></html>
      `, { headers: { 'Content-Type': 'text/html' } })
    }

    const { data: match } = await supabaseAdmin
      .from('matches').select('*').eq('id', matchId).single()

    if (!match) {
      return new NextResponse(`
        <html><body style="font-family:monospace;max-width:480px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
          <h1 style="font-size:2rem;color:#0e0c1a;margin-bottom:1rem">Match not found</h1>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4">Back to NotCupid →</a>
        </body></html>
      `, { headers: { 'Content-Type': 'text/html' } })
    }

    const isUser1 = match.user_1_id === userId
    const updateField = isUser1 ? 'user_1_accepted' : 'user_2_accepted'
    const otherAccepted = isUser1 ? match.user_2_accepted : match.user_1_accepted

    await supabaseAdmin
      .from('matches')
      .update({ [updateField]: true })
      .eq('id', matchId)

    if (otherAccepted) {
      const { data: user1 } = await supabaseAdmin
        .from('users').select('*').eq('id', match.user_1_id).single()
      const { data: user2 } = await supabaseAdmin
        .from('users').select('*').eq('id', match.user_2_id).single()

      if (user1 && user2) {
        await supabaseAdmin
          .from('matches')
          .update({ status: 'both_accepted' })
          .eq('id', matchId)

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
              subject: `${user2.name} said yes — here's their email`,
              html: `
                <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
                  <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
                  <p style="font-size:.75rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">It's a match ✦</p>
                  <p style="font-size:1.1rem;color:#0e0c1a;font-weight:500;margin-bottom:1.5rem">Both of you said yes. The rest is on you.</p>
                  <div style="background:#ede9ff;padding:1.5rem;margin-bottom:1.5rem">
                    <p style="font-size:.65rem;color:#8b7fd4;letter-spacing:.15em;text-transform:uppercase;margin-bottom:.5rem">${user2.name}'s email</p>
                    <p style="font-size:1.2rem;font-weight:700;color:#0e0c1a">${user2.email}</p>
                  </div>
                  <p style="font-size:.8rem;color:#7a7590;line-height:1.65;">Reach out. The algo did its part.</p>
                  <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">Boston only · notcupid.com</div>
                </div>
              `
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
              subject: `${user1.name} said yes — here's their email`,
              html: `
                <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
                  <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
                  <p style="font-size:.75rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">It's a match ✦</p>
                  <p style="font-size:1.1rem;color:#0e0c1a;font-weight:500;margin-bottom:1.5rem">Both of you said yes. The rest is on you.</p>
                  <div style="background:#ede9ff;padding:1.5rem;margin-bottom:1.5rem">
