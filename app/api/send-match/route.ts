import { NextRequest, NextResponse } from 'next/server'
import { signMatchToken } from '@/lib/match-tokens'
import { renderEmail, sendEmail, infoCard, button, C } from '@/lib/email'

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

function matchEmailHtml(
  name: string,
  otherName: string,
  score: number,
  spot: string,
  matchId: string,
  userId: string,
) {
  const base = process.env.NEXT_PUBLIC_SITE_URL
  const acceptToken = signMatchToken({ matchId, userId, action: 'accept' })
  const passToken = signMatchToken({ matchId, userId, action: 'pass' })
  const acceptUrl = `${base}/api/match-accept?matchId=${matchId}&userId=${userId}&token=${acceptToken}`
  const passUrl = `${base}/api/match-pass?matchId=${matchId}&userId=${userId}&token=${passToken}`

  return renderEmail({
    preheader: `${otherName} could be the one. ${score}% compatibility on the algo. You have 48 hours to decide.`,
    eyebrow: 'the algorithm has spoken',
    headline: `Hey ${name.split(' ')[0]} — we found you a match.`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">
        Six dimensions of your personality lined up with <strong style="color:${C.ink};">${otherName.split(' ')[0]}</strong>'s. Here's what the algo gave you back:
      </p>

      ${infoCard({
        eyebrow: 'compatibility score',
        big: `${score}<span style="font-size:18px;color:${C.mutedSoft};">%</span>`,
      })}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};border:1px solid ${C.border};border-radius:10px;margin:14px 0 18px 0;"><tr><td style="padding:18px 22px;">
        <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.16em;text-transform:uppercase;margin-bottom:6px;">suggested first spot</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:${C.ink};">${spot}</div>
      </td></tr></table>

      <p style="margin:18px 0 10px 0;color:${C.ink};font-size:16px;font-weight:500;">Want to meet ${otherName.split(' ')[0]}?</p>
      <p style="margin:0 0 22px 0;font-size:13px;">
        If you both say yes, you get each other's email. If either of you passes, you're back in the pool. You have 48 hours.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;">${button({ href: acceptUrl, label: "Yes, I'm in →" })}</td>
        <td>${button({ href: passUrl, label: 'Pass on this', variant: 'secondary' })}</td>
      </tr></table>
    `,
    recipientId: userId,
    footerNote: 'one match at a time. the algo picks; you decide.',
  })
}

export async function POST(req: NextRequest) {
  try {
    const { user1, user2, score, matchId } = await req.json()
    const spot = BOSTON_SPOTS[Math.floor(Math.random() * BOSTON_SPOTS.length)]

    const results = await Promise.all([
      sendEmail({
        to: user1.email,
        subject: `${user2.name.split(' ')[0]} could be the one — ${score}% match`,
        html: matchEmailHtml(user1.name, user2.name, score, spot, matchId, user1.id),
      }),
      sendEmail({
        to: user2.email,
        subject: `${user1.name.split(' ')[0]} could be the one — ${score}% match`,
        html: matchEmailHtml(user2.name, user1.name, score, spot, matchId, user2.id),
      }),
    ])

    const failed = results.filter((r) => !r.ok)
    if (failed.length) {
      console.error('Send match: partial failure', { failed })
    }

    return NextResponse.json({ success: true, spot, sent: results.filter((r) => r.ok).length })
  } catch (err) {
    console.error('Send match error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
