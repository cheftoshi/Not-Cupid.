import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

function emailHtml(name: string, baseUrl: string) {
  const safeName = (name || 'there').split(' ')[0]
  return `
    <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f8f5ff;">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.1em;color:#0e0c1a;margin-bottom:2rem">NOTCUPID</div>
      <p style="font-size:.75rem;color:#8b7fd4;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">we upgraded the algorithm.</p>
      <p style="font-size:1.15rem;color:#0e0c1a;font-weight:500;margin-bottom:1.25rem;line-height:1.5">
        hey ${safeName}, the algo got smarter. take the new quiz to get a better match.
      </p>
      <p style="font-size:.92rem;color:#7a7590;line-height:1.7;margin-bottom:1.5rem">
        we kept the personality questions you already nailed and added 6 quick ones about how you actually live —
        when you peak, how often you want to see someone, what you're really looking for. it scores compatibility on more than just vibes now.
      </p>
      <p style="font-size:.92rem;color:#7a7590;line-height:1.7;margin-bottom:2rem">
        five minutes. you'll get re-matched the moment you finish.
      </p>
      <div style="margin-bottom:2rem">
        <a href="${baseUrl}/quiz?retake=1" style="display:inline-block;background:#0e0c1a;color:#f8f5ff;padding:1rem 1.75rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none">retake the quiz →</a>
      </div>
      <div style="padding-top:1.5rem;border-top:1px solid #ede9ff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">
        boston only · notcupid.com · the algo got upgraded
      </div>
    </div>
  `
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (dryRun) {
    return NextResponse.json({ wouldSend: users?.length || 0, sample: users?.slice(0, 3).map(u => u.email) })
  }

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const u of users || []) {
    if (!u.email) continue
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NotCupid <match@notcupid.com>',
          to: [u.email],
          subject: 'the algo got smarter — retake the quiz',
          html: emailHtml(u.name || '', baseUrl),
        }),
      })
      if (res.ok) sent++
      else {
        failed++
        const detail = await res.text().catch(() => '')
        errors.push(`${u.email}: ${res.status} ${detail.slice(0, 100)}`)
      }
    } catch (e: any) {
      failed++
      errors.push(`${u.email}: ${e.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    totalUsers: users?.length || 0,
    sent,
    failed,
    errors: errors.slice(0, 10),
  })
}
