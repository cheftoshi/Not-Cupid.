import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyMatchToken, signMatchToken } from '@/lib/match-tokens'
import { renderEmail, sendEmail, infoCard, button, C } from '@/lib/email'

export const dynamic = 'force-dynamic'

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string))
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<html><body style="font-family:monospace;max-width:480px;margin:4rem auto;padding:2rem;background:#f6f6f6;text-align:center;">
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
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#2563ff">Back to NotCupid →</a>`,
    400
  )
}

function endedMatchPage(reason?: string) {
  const detail = reason === 'passed'
    ? 'one of you passed on this one.'
    : reason === 'expired'
    ? "this match expired before both of you said yes."
    : reason === 'ended'
    ? 'this match has been ended.'
    : 'this match is closed.'
  return htmlPage(
    'This match has ended',
    `<p style="color:#7a7590;line-height:1.65;margin-bottom:1.5rem">${detail}</p>
     <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">log in to see your current matches.</p>
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" style="background:#0e0c1a;color:#f6f6f6;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;display:inline-block">go to dashboard →</a>`,
    410 /* Gone — semantically correct: match used to exist, doesn't now */
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

  // Token: either provided (new email) or absent (legacy email — mint a fresh one).
  let workingToken = token
  if (workingToken && !verifyMatchToken({ matchId, userId, action: 'accept', token: workingToken })) {
    console.warn('[match-accept] 400 bad token', {
      matchId: String(matchId).slice(0, 8), ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  // Validate the underlying match (existence, party, non-terminal).
  // We check this for BOTH legacy and tokenized links so a stale email doesn't
  // route a real user to a meaningless confirm screen.
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, status')
    .eq('id', matchId)
    .maybeSingle()

  if (!match || (match.user_1_id !== userId && match.user_2_id !== userId)) {
    console.warn('[match-accept] 400 link not recoverable', {
      matchId: String(matchId).slice(0, 8),
      reason: !match ? 'no_match' : 'not_party',
      legacy: !token,
      ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  if (match.status && ['ended', 'passed', 'expired'].includes(match.status)) {
    console.log('[match-accept] link points to ended match', {
      matchId: String(matchId).slice(0, 8),
      status: match.status,
      legacy: !token,
    })
    return endedMatchPage(match.status)
  }

  if (!workingToken) {
    workingToken = signMatchToken({ matchId, userId, action: 'accept' })
    console.log('[match-accept] legacy link recovered', { matchId: String(matchId).slice(0, 8) })
  }
  const token_for_form = workingToken

  // Render a confirmation page. No DB mutation here — email-link prefetchers
  // (Gmail / Outlook / antivirus) only GET, so they won't accidentally accept.
  const mId = escapeHtml(matchId)
  const uId = escapeHtml(userId)
  const tk = escapeHtml(token_for_form)
  return new NextResponse(`
    <html><body style="font-family:monospace;max-width:520px;margin:4rem auto;padding:2rem;background:#f6f6f6;text-align:center;">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
      <h1 style="font-size:1.8rem;color:#0e0c1a;margin-bottom:1rem">Confirm: yes, I'm interested</h1>
      <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Click below to confirm. If your match also says yes, you'll both get each other's email immediately.</p>
      <form method="POST" action="/api/match-accept" style="display:inline-block">
        <input type="hidden" name="matchId" value="${mId}" />
        <input type="hidden" name="userId" value="${uId}" />
        <input type="hidden" name="token" value="${tk}" />
        <button type="submit" style="background:#0e0c1a;color:#f6f6f6;padding:1rem 2rem;font-family:monospace;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;border:none;cursor:pointer">Yes, confirm →</button>
      </form>
      <p style="margin-top:2rem"><a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#2563ff;font-size:.75rem">← back to NotCupid</a></p>
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

    if (!match) return htmlPage('Match not found', `<a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#2563ff">Back to NotCupid →</a>`, 404)

    const isUser1 = match.user_1_id === userId
    const isUser2 = match.user_2_id === userId
    if (!isUser1 && !isUser2) return invalidLink()

    if (match.status && ['ended', 'passed', 'expired'].includes(match.status)) {
      return endedMatchPage(match.status)
    }

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

        const itsAMatchHtml = (otherName: string, otherEmail: string, recipientId: string) => renderEmail({
          preheader: `Both of you said yes. ${otherName.split(' ')[0]}'s email is inside — reach out.`,
          eyebrow: "it's a match ✦",
          headline: `${otherName.split(' ')[0]} said yes too.`,
          bodyHtml: `
            <p style="margin:0 0 14px 0;">The algo lit the spark; the rest is on you.</p>

            ${infoCard({
              eyebrow: `${otherName}'s email`,
              big: otherEmail,
            })}

            <p style="margin:14px 0 6px 0;color:${C.ink};font-size:15px;font-weight:500;">A nudge, not a script:</p>
            <ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${C.muted};line-height:1.7;">
              <li>Pick a time within the next 7 days. Momentum is everything.</li>
              <li>The first message should be a real one, not "hey." You both already passed the hard part.</li>
              <li>If it lands, come back and tell us how it went.</li>
            </ul>

            ${button({ href: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`, label: 'Back to NotCupid →' })}
          `,
          recipientId,
          footerNote: 'mutual yes. you earned this one.',
        })

        await Promise.all([
          sendEmail({
            to: user1.email,
            subject: `${user2.name.split(' ')[0]} said yes — here's their email`,
            html: itsAMatchHtml(user2.name, user2.email, user1.id),
          }),
          sendEmail({
            to: user2.email,
            subject: `${user1.name.split(' ')[0]} said yes — here's their email`,
            html: itsAMatchHtml(user1.name, user1.email, user2.id),
          }),
        ])
      }

      return htmlPage(
        "It's a match. ✦",
        `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Both of you said yes. Check your email — we just sent their contact info.</p>
         <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f6f6f6;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
      )
    }

    return htmlPage(
      "You're in. ✓",
      `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">We've noted your interest. If they say yes too, you'll both get each other's email immediately.</p>
       <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f6f6f6;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
    )
  } catch (err) {
    console.error('Match accept error:', err)
    return htmlPage(
      'Something went wrong',
      `<p style="color:#7a7590;margin-bottom:2rem">Please try again or contact us at match@notcupid.com</p>
       <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#2563ff">Back to NotCupid →</a>`,
      500
    )
  }
}
