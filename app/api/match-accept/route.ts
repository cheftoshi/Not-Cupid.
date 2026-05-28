import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyMatchToken, signMatchToken } from '@/lib/match-tokens'

export const dynamic = 'force-dynamic'

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string))
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<html><body style="font-family:monospace;max-width:480px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
      <h1 style="font-size:2rem;color:#0e0c1a;margin-bottom:1rem">${title}</h1>
      ${body}
    </body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  )
}

function invalidLink() {
  return htmlPage(
    'Invalid or expired link',
    `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">This link is no longer valid. If you think this is a mistake, contact match@notcupid.com.</p>
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4">Back to NotCupid →</a>`,
    400
  )
}

function parseParams(req: NextRequest, body?: URLSearchParams) {
  const url = new URL(req.url)
  const matchId = body?.get('matchId') || url.searchParams.get('matchId')
  const userId = body?.get('userId') || url.searchParams.get('userId')
  const token = body?.get('token') || url.searchParams.get('token')
  return { matchId, userId, token }
}

export async function GET(req: NextRequest) {
  const { matchId, userId, token } = parseParams(req)
  if (!matchId || !userId) {
    console.warn('[match-accept] 400 missing required ids', {
      hasMatch: !!matchId, hasUser: !!userId,
      ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  // Backward compat: legacy emails (sent pre-signed-token deploy) don't have a token.
  // If the matchId+userId pair maps to a real, non-terminal match the user is on,
  // we generate a fresh token here so they can complete the action. The POST still
  // requires a valid token, so state mutation is unchanged.
  let workingToken = token
  if (!workingToken) {
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('user_1_id, user_2_id, status')
      .eq('id', matchId)
      .maybeSingle()

    const terminal = !match || (match.status && ['ended', 'passed', 'expired'].includes(match.status))
    const isParty = match && (match.user_1_id === userId || match.user_2_id === userId)

    if (terminal || !isParty) {
      console.warn('[match-accept] 400 legacy link not recoverable', {
        matchId: String(matchId).slice(0, 8),
        ua: req.headers.get('user-agent')?.slice(0, 80),
      })
      return invalidLink()
    }
    workingToken = signMatchToken({ matchId, userId, action: 'accept' })
    console.log('[match-accept] legacy link recovered', { matchId: String(matchId).slice(0, 8) })
  } else if (!verifyMatchToken({ matchId, userId, action: 'accept', token: workingToken })) {
    console.warn('[match-accept] 400 bad token', {
      matchId: String(matchId).slice(0, 8), ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }
  const token_for_form = workingToken

  // Render a confirmation page. No DB mutation here — email-link prefetchers
  // (Gmail / Outlook / antivirus) only GET, so they won't accidentally accept.
  const mId = escapeHtml(matchId)
  const uId = escapeHtml(userId)
  const tk = escapeHtml(token_for_form)
  return new NextResponse(`
    <html><body style="font-family:monospace;max-width:520px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
      <h1 style="font-size:1.8rem;color:#0e0c1a;margin-bottom:1rem">Confirm: yes, I'm interested</h1>
      <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Click below to confirm. If your match also says yes, you'll both get each other's email immediately.</p>
      <form method="POST" action="/api/match-accept" style="display:inline-block">
        <input type="hidden" name="matchId" value="${mId}" />
        <input type="hidden" name="userId" value="${uId}" />
        <input type="hidden" name="token" value="${tk}" />
        <button type="submit" style="background:#0e0c1a;color:#f8f5ff;padding:1rem 2rem;font-family:monospace;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;border:none;cursor:pointer">Yes, confirm →</button>
      </form>
      <p style="margin-top:2rem"><a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4;font-size:.75rem">← back to NotCupid</a></p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } })
}

export async function POST(req: NextRequest) {
  try {
    const body = new URLSearchParams(await req.text())
    const { matchId, userId, token } = parseParams(req, body)
    if (!matchId || !userId || !token) return invalidLink()
    if (!verifyMatchToken({ matchId, userId, action: 'accept', token })) return invalidLink()

    const { data: match } = await supabaseAdmin
      .from('matches').select('*').eq('id', matchId).single()

    if (!match) return htmlPage('Match not found', `<a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4">Back to NotCupid →</a>`, 404)

    const isUser1 = match.user_1_id === userId
    const isUser2 = match.user_2_id === userId
    if (!isUser1 && !isUser2) return invalidLink()

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
                    <p style="font-size:.65rem;color:#8b7fd4;letter-spacing:.15em;text-transform:uppercase;margin-bottom:.5rem">${user1.name}'s email</p>
                    <p style="font-size:1.2rem;font-weight:700;color:#0e0c1a">${user1.email}</p>
                  </div>
                  <p style="font-size:.8rem;color:#7a7590;line-height:1.65;">Reach out. The algo did its part.</p>
                  <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">Boston only · notcupid.com</div>
                </div>
              `
            })
          })
        ])
      }

      return htmlPage(
        "It's a match. ✦",
        `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Both of you said yes. Check your email — we just sent their contact info.</p>
         <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
      )
    }

    return htmlPage(
      "You're in. ✓",
      `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">We've noted your interest. If they say yes too, you'll both get each other's email immediately.</p>
       <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
    )
  } catch (err) {
    console.error('Match accept error:', err)
    return htmlPage(
      'Something went wrong',
      `<p style="color:#7a7590;margin-bottom:2rem">Please try again or contact us at match@notcupid.com</p>
       <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#8b7fd4">Back to NotCupid →</a>`,
      500
    )
  }
}
