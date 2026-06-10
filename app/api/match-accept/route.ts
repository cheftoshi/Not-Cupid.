import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyMatchToken, signMatchToken } from '@/lib/match-tokens'
import { acceptMatch } from '@/lib/match-actions'

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
      <div style="font-family:Georgia,serif;font-style:italic;font-size:1.5rem;font-weight:700;margin-bottom:2rem"><span style="color:#2563ff">Not</span><span style="color:#ff6a1f">Cupid</span></div>
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

    // Shared activation — identical to the in-app accept path.
    const result = await acceptMatch(matchId, userId)

    if (!result.ok) {
      if (result.reason === 'ended') return endedMatchPage()
      if (result.reason === 'not_found') {
        return htmlPage('Match not found', `<a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#2563ff">Back to NotCupid →</a>`, 404)
      }
      if (result.reason === 'at_capacity') {
        return htmlPage(
          'Your hands are full. ✋',
          `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">You're already running your max conversations. Wrap one up on your dashboard, then come back and say yes — this match stays open until it expires.</p>
           <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="background:#0e0c1a;color:#f6f6f6;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Open your dashboard →</a>`
        )
      }
      return invalidLink()
    }

    if (result.mutual) {
      return htmlPage(
        "It's a match. ✦",
        `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Both of you said yes. Check your email — we just sent their contact info, and the chat's open in the app.</p>
         <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f6f6f6;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
      )
    }

    return htmlPage(
      "You're in. ✓",
      `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">We've noted your interest and let them know. If they say yes too, you'll both get each other's email immediately.</p>
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
