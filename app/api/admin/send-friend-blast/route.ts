// POST /api/admin/send-friend-blast
//
// Launch email for FRIEND MAXXIN — introduces "the Friend Line" to ALL users
// (not just opted-in). Links to /friends, where routing handles the quiz:
// dating-quiz users only do the short friend quiz; brand-new users do the full
// one. Batched, rate-limited, idempotent (friend_blast_sent_at), resumable.
// ?dry=1 previews, ?force=1 re-sends to everyone.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'
import { renderEmail, button, C } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 1100
const MAX_RUN_MS = 55_000
const MAX_RETRIES = 2

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function emailHtml(name: string, recipientId: string, baseUrl: string): string {
  const first = (name || 'there').split(' ')[0]
  return renderEmail({
    preheader: `Boston dating was just the first stop. ${first}, the Friend Line is now open.`,
    eyebrow: '🟠 the friend line is live',
    headline: `${first}, find your next friend.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">We started with dates. Turns out making real friends in this city is just as hard — so we built a second line. Meet <strong style="color:${C.ink};">the Friend Line</strong>: same algorithm energy, zero romance, all crew.</p>

      <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.18em;text-transform:uppercase;margin:0 0 8px 0;">how the friend line runs</div>
      <ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${C.muted};line-height:1.7;">
        <li><strong style="color:${C.ink};">5 of your vibe</strong> — matched on personality + how you actually like to hang.</li>
        <li><strong style="color:${C.ink};">A real crew</strong> — accept who you click with, share one group chat, make plans.</li>
        <li><strong style="color:${C.ink};">The scene</strong> — post "anyone for trivia?", see which neighborhoods are buzzing.</li>
        <li><strong style="color:${C.ink};">First crew's chat is free.</strong> No subscription, no swiping.</li>
      </ul>

      <p style="margin:0 0 22px 0;">Already have a NotCupid profile? You're halfway there — just a quick find-a-friend round and you're matched. New here? One quiz covers both lines.</p>

      ${button({ href: `${baseUrl}/friends`, label: 'board the friend line →' })}
    `,
    recipientId,
    footerNote: 'two algos. one city.',
  })
}

async function sendOne(
  user: { id: string; name: string | null; email: string },
  apiKey: string,
  baseUrl: string,
  retry = 0,
): Promise<{ ok: boolean; status?: number; err?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NotCupid <match@notcupid.com>',
        to: [user.email],
        subject: 'the Friend Line is live — find your next friend',
        html: emailHtml(user.name || '', user.id, baseUrl),
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
  const force = url.searchParams.get('force') === '1'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  // ALL users: not deleted, has email, opted into emails, not yet blasted.
  let query = supabaseAdmin
    .from('users')
    .select('id, name, email, friend_blast_sent_at, email_notifications')
    .is('deleted_at', null)
    .not('email', 'is', null)
    .neq('email_notifications', false)
  if (!force) query = query.is('friend_blast_sent_at', null)

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
  let sent = 0, failed = 0, processed = 0
  const errors: string[] = []

  for (let i = 0; i < (users || []).length; i += BATCH_SIZE) {
    if (Date.now() - start > MAX_RUN_MS) break
    const batch = (users || []).slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((u) => sendOne(u, apiKey, baseUrl)))
    const sentIds: string[] = []
    results.forEach((r, idx) => {
      processed++
      if (r.ok) { sent++; sentIds.push(batch[idx].id) }
      else { failed++; if (errors.length < 10) errors.push(`${batch[idx].email}: ${r.status ?? 'err'} ${r.err ?? ''}`.trim()) }
    })
    if (sentIds.length > 0) {
      await supabaseAdmin.from('users').update({ friend_blast_sent_at: new Date().toISOString() }).in('id', sentIds)
    }
    if (i + BATCH_SIZE < (users || []).length) await sleep(BATCH_DELAY_MS)
  }

  const remaining = (users?.length || 0) - processed
  return NextResponse.json({
    success: true,
    totalCandidates: users?.length || 0,
    processed, sent, failed, remaining, errors,
    note: remaining > 0 ? `Time-limited stop — re-click to continue with the remaining ${remaining}.` : undefined,
  })
}
