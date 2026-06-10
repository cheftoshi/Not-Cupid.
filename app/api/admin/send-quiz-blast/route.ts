import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Hobby plan cap

const BATCH_SIZE = 5         // parallel sends per batch
const BATCH_DELAY_MS = 1100  // ~4.5 sends/sec — under Resend's free 2/sec tier when accounting for slack
const MAX_RUN_MS = 55_000    // stop before Vercel kills us; safe to re-run
const MAX_RETRIES = 2

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function emailHtml(name: string, baseUrl: string) {
  const safeName = (name || 'there').split(' ')[0]
  return `
    <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:2rem;background:#f6f6f6;">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:1.5rem;font-weight:700;margin-bottom:2rem"><span style="color:#2563ff">Not</span><span style="color:#ff6a1f">Cupid</span></div>
      <p style="font-size:.75rem;color:#2563ff;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem">we upgraded the algorithm.</p>
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
        <a href="${baseUrl}/quiz?retake=1" style="display:inline-block;background:#0e0c1a;color:#f6f6f6;padding:1rem 1.75rem;font-family:monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none">retake the quiz →</a>
      </div>
      <div style="padding-top:1.5rem;border-top:1px solid #e8edff;font-size:.65rem;color:#c8c4dc;letter-spacing:.1em;text-transform:uppercase">
        new england + nyc · notcupid.com · the algo got upgraded
      </div>
    </div>
  `
}

async function sendOne(
  user: { id: string; name: string | null; email: string },
  apiKey: string,
  baseUrl: string,
  retry = 0
): Promise<{ ok: boolean; status?: number; err?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NotCupid <match@notcupid.com>',
        to: [user.email],
        subject: 'the algo got smarter — retake the quiz',
        html: emailHtml(user.name || '', baseUrl),
      }),
    })
    if (res.ok) return { ok: true }
    if (res.status === 429 && retry < MAX_RETRIES) {
      await sleep(2000 * (retry + 1))
      return sendOne(user, apiKey, baseUrl, retry + 1)
    }
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, err: text.slice(0, 120) }
  } catch (e: any) {
    return { ok: false, err: e.message }
  }
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  // ?force=1 ignores quiz_blast_sent_at and re-emails everyone
  const force = url.searchParams.get('force') === '1'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  let query = supabaseAdmin
    .from('users')
    .select('id, name, email, quiz_blast_sent_at')
    .is('deleted_at', null)
    .not('email', 'is', null)

  if (!force) query = query.is('quiz_blast_sent_at', null)

  const { data: users, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (dryRun) {
    return NextResponse.json({
      wouldSend: users?.length || 0,
      sample: users?.slice(0, 3).map((u) => u.email),
      mode: force ? 'force-all' : 'unsent-only',
    })
  }

  const start = Date.now()
  let sent = 0
  let failed = 0
  const errors: string[] = []
  let processed = 0

  for (let i = 0; i < (users || []).length; i += BATCH_SIZE) {
    if (Date.now() - start > MAX_RUN_MS) break

    const batch = (users || []).slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((u) => sendOne(u, apiKey, baseUrl)))

    const sentIds: string[] = []
    results.forEach((r, idx) => {
      processed++
      if (r.ok) {
        sent++
        sentIds.push(batch[idx].id)
      } else {
        failed++
        if (errors.length < 10) {
          errors.push(`${batch[idx].email}: ${r.status ?? 'err'} ${r.err ?? ''}`.trim())
        }
      }
    })

    if (sentIds.length > 0) {
      await supabaseAdmin
        .from('users')
        .update({ quiz_blast_sent_at: new Date().toISOString() })
        .in('id', sentIds)
    }

    if (i + BATCH_SIZE < (users || []).length) await sleep(BATCH_DELAY_MS)
  }

  const remaining = (users?.length || 0) - processed
  return NextResponse.json({
    success: true,
    totalCandidates: users?.length || 0,
    processed,
    sent,
    failed,
    remaining, // if > 0, just re-run the blast — idempotent
    errors,
    note: remaining > 0
      ? `Time-limited stop — re-click the button to continue with the remaining ${remaining}.`
      : undefined,
  })
}
