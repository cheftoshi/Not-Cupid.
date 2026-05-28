import { NextRequest, NextResponse } from 'next/server'
import { signMatchToken } from '@/lib/match-tokens'
import { renderEmail, sendEmail, infoCard, button, C } from '@/lib/email'

function matchEmailHtml(
  name: string,
  otherName: string,
  score: number,
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

    const results = await Promise.all([
      sendEmail({
        to: user1.email,
        subject: `${user2.name.split(' ')[0]} could be the one — ${score}% match`,
        html: matchEmailHtml(user1.name, user2.name, score, matchId, user1.id),
      }),
      sendEmail({
        to: user2.email,
        subject: `${user1.name.split(' ')[0]} could be the one — ${score}% match`,
        html: matchEmailHtml(user2.name, user1.name, score, matchId, user2.id),
      }),
    ])

    const failed = results.filter((r) => !r.ok)
    if (failed.length) {
      console.error('Send match: partial failure', { failed })
    }

    return NextResponse.json({ success: true, sent: results.filter((r) => r.ok).length })
  } catch (err) {
    console.error('Send match error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
