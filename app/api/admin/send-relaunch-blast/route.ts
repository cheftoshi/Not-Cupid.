// POST /api/admin/send-relaunch-blast
//
// Announces the matching relaunch (roster-first: pick from 5) + what's new to
// existing users, and nudges anyone WITHOUT a live match to retake the quiz.
// Batched, rate-limited, idempotent (relaunch_blast_sent_at), resumable
// (time-boxed; just re-run to continue). ?dry=1 previews, ?force=1 re-sends.

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

function emailHtml(name: string, hasLiveMatch: boolean, recipientId: string, baseUrl: string): string {
  const first = (name || 'there').split(' ')[0]

  // CTA differs: matched users → see their match; unmatched → retake quiz to
  // refresh their roster.
  const ctaHref = hasLiveMatch ? `${baseUrl}/dashboard` : `${baseUrl}/quiz?retake=1`
  const ctaLabel = hasLiveMatch ? 'see your match →' : 'retake the quiz →'
  const closer = hasLiveMatch
    ? `You've already got someone — open the app to keep it moving, and try the new <strong style="color:${C.ink};">date vibes</strong> game with them.`
    : `Haven't clicked with anyone yet? Retake the 5-minute quiz and we'll rebuild your roster with the smarter algorithm. You'll see your five right away.`

  return renderEmail({
    preheader: `We rebuilt matching — now you pick from your 5 most compatible. Here's what's new, ${first}.`,
    eyebrow: 'we rebuilt matching',
    headline: `${first}, you choose now.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">Big change: NotCupid no longer assigns you one match and hopes. The algorithm now hands you your <strong style="color:${C.ink};">5 most compatible people</strong> and <strong style="color:${C.ink};">you pick</strong> who to talk to. No swiping — just your best matches, your call.</p>

      <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.18em;text-transform:uppercase;margin:0 0 8px 0;">what's new</div>
      <ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${C.muted};line-height:1.7;">
        <li><strong style="color:${C.ink};">Pick from 5</strong> — your most compatible, scored on personality + lifestyle.</li>
        <li><strong style="color:${C.ink};">Tighter, local matches</strong> — greater Boston, 15 miles, widen anytime.</li>
        <li><strong style="color:${C.ink};">Date Vibes</strong> — a private game with your match to plan what to actually do.</li>
        <li><strong style="color:${C.ink};">Safer</strong> — block &amp; report built in, your exact location never shown.</li>
      </ul>

      <p style="margin:0 0 22px 0;">${closer}</p>

      ${button({ href: ctaHref, label: ctaLabel })}
    `,
    recipientId,
    footerNote: 'meet people. not profiles.',
  })
}

async function sendOne(
  payload: { user: { id: string; name: string | null; email: string }; hasLiveMatch: boolean },
  apiKey: string,
  baseUrl: string,
  retry = 0,
): Promise<{ ok: boolean; status?: number; err?: string }> {
  const { user, hasLiveMatch } = payload
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NotCupid <match@notcupid.com>',
        to: [user.email],
        subject: 'we rebuilt matching — now you pick',
        html: emailHtml(user.name || '', hasLiveMatch, user.id, baseUrl),
      }),
    })
    if (res.ok) return { ok: true }
    if (res.status === 429 && retry < MAX_RETRIES) {
      await sleep(2000 * (retry + 1))
      return sendOne(payload, apiKey, baseUrl, retry + 1)
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

  // Recipients: not deleted, has email, opted into emails, not yet blasted.
  let query = supabaseAdmin
    .from('users')
    .select('id, name, email, relaunch_blast_sent_at, email_notifications')
    .is('deleted_at', null)
    .not('email', 'is', null)
    .neq('email_notifications', false)
  if (!force) query = query.is('relaunch_blast_sent_at', null)

  const { data: users, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Who currently has a live (both-accepted, not-ended) match? Drives the CTA.
  const { data: liveMatches } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id')
    .eq('user_1_accepted', true)
    .eq('user_2_accepted', true)
    .is('ended_at', null)
  const liveSet = new Set<string>()
  for (const m of liveMatches ?? []) { liveSet.add(m.user_1_id); liveSet.add(m.user_2_id) }

  if (dryRun) {
    return NextResponse.json({
      wouldSend: users?.length || 0,
      withLiveMatch: (users || []).filter((u) => liveSet.has(u.id)).length,
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
    const results = await Promise.all(
      batch.map((u) => sendOne({ user: u, hasLiveMatch: liveSet.has(u.id) }, apiKey, baseUrl)),
    )
    const sentIds: string[] = []
    results.forEach((r, idx) => {
      processed++
      if (r.ok) { sent++; sentIds.push(batch[idx].id) }
      else { failed++; if (errors.length < 10) errors.push(`${batch[idx].email}: ${r.status ?? 'err'} ${r.err ?? ''}`.trim()) }
    })
    if (sentIds.length > 0) {
      await supabaseAdmin.from('users').update({ relaunch_blast_sent_at: new Date().toISOString() }).in('id', sentIds)
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
