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

function endedMatchPage(reason?: string) {
  const detail = reason === 'passed'
    ? 'this match was already passed on.'
    : reason === 'expired'
    ? 'this match expired.'
    : reason === 'ended'
    ? 'this match has been ended.'
    : 'this match is closed.'
  return htmlPage(
    'This match has ended',
    `<p style="color:#7a7590;line-height:1.65;margin-bottom:1.5rem">${detail}</p>
     <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">log in to see your current matches.</p>
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" style="background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;display:inline-block">go to dashboard →</a>`,
    410
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
    console.warn('[match-pass] 400 missing required ids', {
      hasMatch: !!matchId, hasUser: !!userId,
      ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  let workingToken = token
  if (workingToken && !verifyMatchToken({ matchId, userId, action: 'pass', token: workingToken })) {
    console.warn('[match-pass] 400 bad token', {
      matchId: String(matchId).slice(0, 8), ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, status')
    .eq('id', matchId)
    .maybeSingle()

  if (!match || (match.user_1_id !== userId && match.user_2_id !== userId)) {
    console.warn('[match-pass] 400 link not recoverable', {
      matchId: String(matchId).slice(0, 8),
      reason: !match ? 'no_match' : 'not_party',
      legacy: !token,
      ua: req.headers.get('user-agent')?.slice(0, 80),
    })
    return invalidLink()
  }

  if (match.status && ['ended', 'passed', 'expired'].includes(match.status)) {
    return endedMatchPage(match.status)
  }

  if (!workingToken) {
    workingToken = signMatchToken({ matchId, userId, action: 'pass' })
    console.log('[match-pass] legacy link recovered', { matchId: String(matchId).slice(0, 8) })
  }

  const mId = escapeHtml(matchId)
  const uId = escapeHtml(userId)
  const tk = escapeHtml(workingToken)
  return new NextResponse(`
    <html><body style="font-family:monospace;max-width:520px;margin:4rem auto;padding:2rem;background:#f8f5ff;text-align:center;">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
      <h1 style="font-size:1.8rem;color:#0e0c1a;margin-bottom:1rem">Confirm: pass on this match</h1>
      <p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">Click below to confirm. You'll go back in the Boston pool and we'll find you another match.</p>
      <form method="POST" action="/api/match-pass" style="display:inline-block">
        <input type="hidden" name="matchId" value="${mId}" />
        <input type="hidden" name="userId" value="${uId}" />
        <input type="hidden" name="token" value="${tk}" />
        <button type="submit" style="background:transparent;color:#0e0c1a;border:1px solid #c8c4dc;padding:1rem 2rem;font-family:monospace;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Pass on this one →</button>
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
    if (!verifyMatchToken({ matchId, userId, action: 'pass', token })) return invalidLink()

    const { data: match } = await supabaseAdmin
      .from('matches').select('*').eq('id', matchId).single()
    if (!match) return new NextResponse('Match not found', { status: 404 })

    const isUser1 = match.user_1_id === userId
    const isUser2 = match.user_2_id === userId
    if (!isUser1 && !isUser2) return invalidLink()

    if (match.status && ['ended', 'passed', 'expired'].includes(match.status)) {
      return endedMatchPage(match.status)
    }

    await supabaseAdmin
      .from('matches')
      .update({ status: 'passed' })
      .eq('id', matchId)

    await supabaseAdmin
      .from('users')
      .update({ status: 'waiting' })
      .in('id', [match.user_1_id, match.user_2_id])

    const otherId = match.user_1_id === userId ? match.user_2_id : match.user_1_id
    const { data: other } = await supabaseAdmin
      .from('users').select('name').eq('id', otherId).single()

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

    return htmlPage(
      'Passed. 👋',
      `<p style="color:#7a7590;line-height:1.65;margin-bottom:2rem">No hard feelings. You're back in the Boston pool — we'll email you when the algorithm finds your next match.</p>
       <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="background:#0e0c1a;color:#f8f5ff;padding:.85rem 1.75rem;font-family:monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Back to NotCupid →</a>`
    )
  } catch (err) {
    console.error('Match pass error:', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
