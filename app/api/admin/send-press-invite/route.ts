// POST /api/admin/send-press-invite
//
// PRESS-STORY INVITE — emails everyone who has left DATE feedback, asking (with
// consent) if they'd be open to sharing their NotCupid dating experience with a
// publication/press. This is purely an INVITATION: it signs nobody up for
// anything. Interested people reply / email press@notcupid.com.
//
// Recipients = distinct user_ids from `date_feedback`, then those users
// (excluding is_test, email_notifications=false, no email, and — unless
// ?force=1 — anyone already marked sent via users.press_invite_at).
//
// Batched, rate-limited, idempotent (press_invite_at), resumable. Graceful if
// the press_invite_at column hasn't been migrated yet (won't 500).
// ?dry=1 previews (sends nothing), ?force=1 re-sends to everyone.

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

const PRESS_EMAIL = 'press@notcupid.com'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function emailHtml(name: string, recipientId: string): string {
  const first = (name || 'there').split(' ')[0]
  return renderEmail({
    preheader: `${first}, a few people are sharing their NotCupid date stories with press — totally optional.`,
    eyebrow: '📰 a small, optional ask',
    headline: `${first}, would you share your date story?`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">You went on a date through NotCupid — and that's exactly the kind of real story a publication has asked us about. We're collecting a few honest accounts of what it's like to meet someone here instead of swiping.</p>

      <p style="margin:0 0 16px 0;"><strong style="color:${C.ink};">This is completely optional</strong>, and replying does <em>not</em> sign you up for anything. If you're open to it, you'd just chat with us (and possibly a journalist) about your experience — on your terms, and only with your say-so on anything that's shared.</p>

      <p style="margin:0 0 16px 0;">No pressure at all if it's not your thing — your matches and account are unaffected either way. But if a few minutes sharing your story sounds good, we'd love to hear from you.</p>

      <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.18em;text-transform:uppercase;margin:0 0 8px 0;">if you're in</div>
      <p style="margin:0 0 22px 0;">Just reply to this email, or reach us at <a href="mailto:${PRESS_EMAIL}" style="color:${C.lav};text-decoration:underline;">${PRESS_EMAIL}</a>. We'll take it from there — and we won't share a single word without your okay.</p>

      ${button({ href: `mailto:${PRESS_EMAIL}?subject=${encodeURIComponent('my NotCupid date story')}`, label: `i'm open to it →` })}
    `,
    recipientId,
    footerNote: 'real people. real dates. only your story, only if you want.',
  })
}

async function sendOne(
  user: { id: string; name: string | null; email: string },
  apiKey: string,
  retry = 0,
): Promise<{ ok: boolean; status?: number; err?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NotCupid <match@notcupid.com>',
        to: [user.email],
        reply_to: PRESS_EMAIL,
        subject: 'would you share your NotCupid date story?',
        html: emailHtml(user.name || '', user.id),
      }),
    })
    if (res.ok) return { ok: true }
    if (res.status === 429 && retry < MAX_RETRIES) {
      await sleep(2000 * (retry + 1))
      return sendOne(user, apiKey, retry + 1)
    }
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, err: text.slice(0, 120) }
  } catch (e: any) {
    return { ok: false, err: e.message }
  }
}

interface Recipient { id: string; name: string | null; email: string; press_invite_at?: string | null }

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1'

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  // 1) Distinct user_ids that have left date feedback.
  const { data: fbRows, error: fbErr } = await supabaseAdmin
    .from('date_feedback')
    .select('user_id')
  if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 })

  const feedbackUserIds = Array.from(
    new Set((fbRows || []).map((r: any) => r.user_id).filter(Boolean) as string[]),
  )
  if (feedbackUserIds.length === 0) {
    return NextResponse.json(dryRun ? { wouldSend: 0, sample: [], mode: 'no-feedback' } : { success: true, totalCandidates: 0, processed: 0, sent: 0, failed: 0, remaining: 0, errors: [] })
  }

  // 2) Load those users. Try to select the idempotency marker; if the column
  //    isn't migrated yet, fall back to a select without it (graceful — the
  //    marker read/write is then a no-op and force-mode behavior applies).
  let columnPresent = true
  let users: Recipient[] | null = null

  let res = await supabaseAdmin
    .from('users')
    .select('id, name, email, is_test, email_notifications, press_invite_at')
    .in('id', feedbackUserIds)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .neq('is_test', true)
    .neq('email_notifications', false)

  if (res.error && /press_invite_at/.test(res.error.message || '')) {
    columnPresent = false
    const fb = await supabaseAdmin
      .from('users')
      .select('id, name, email, is_test, email_notifications')
      .in('id', feedbackUserIds)
      .is('deleted_at', null)
      .not('email', 'is', null)
      .neq('is_test', true)
      .neq('email_notifications', false)
    if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 500 })
    users = fb.data as Recipient[]
  } else if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 })
  } else {
    users = res.data as Recipient[]
  }

  // Idempotency: skip already-sent unless forcing (only meaningful if the
  // column exists; pre-migration we can't dedupe, so we honor force/normal alike).
  let recipients = users || []
  if (columnPresent && !force) {
    recipients = recipients.filter((u) => !u.press_invite_at)
  }

  if (dryRun) {
    return NextResponse.json({
      wouldSend: recipients.length,
      feedbackUsers: feedbackUserIds.length,
      sample: recipients.slice(0, 3).map((u) => u.email),
      mode: force ? 'force-all' : 'unsent-only',
      columnMigrated: columnPresent,
    })
  }

  const start = Date.now()
  let sent = 0, failed = 0, processed = 0
  const errors: string[] = []

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    if (Date.now() - start > MAX_RUN_MS) break
    const batch = recipients.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((u) => sendOne(u, apiKey)))
    const sentIds: string[] = []
    results.forEach((r, idx) => {
      processed++
      if (r.ok) { sent++; sentIds.push(batch[idx].id) }
      else { failed++; if (errors.length < 10) errors.push(`${batch[idx].email}: ${r.status ?? 'err'} ${r.err ?? ''}`.trim()) }
    })
    if (sentIds.length > 0 && columnPresent) {
      const upd = await supabaseAdmin.from('users').update({ press_invite_at: new Date().toISOString() }).in('id', sentIds)
      // Graceful: if the column vanished mid-run, don't blow up the send.
      if (upd.error && /press_invite_at/.test(upd.error.message || '')) columnPresent = false
    }
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS)
  }

  const remaining = recipients.length - processed
  return NextResponse.json({
    success: true,
    totalCandidates: recipients.length,
    processed, sent, failed, remaining, errors,
    columnMigrated: columnPresent,
    note: !columnPresent
      ? 'press_invite_at column not migrated — sends went out but cannot be de-duplicated on re-run. Run 20260624_press_invite.sql.'
      : remaining > 0 ? `Time-limited stop — re-click to continue with the remaining ${remaining}.` : undefined,
  })
}
