import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

/**
 * Pulls the recent send log from Resend, finds emails matching the quiz-blast
 * subject that were delivered (or sent without error), and marks those users
 * with quiz_blast_sent_at so the next blast skips them.
 *
 * Resend's list-emails endpoint is paged with `limit` (max 100) + cursor.
 * We page through up to MAX_PAGES pages to cover several hundred emails.
 */

const MAX_PAGES = 10
const PAGE_LIMIT = 100
const SUBJECT_NEEDLE = 'algo got smarter'

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  // Pull recent emails from Resend
  const recipients = new Set<string>()
  let cursor: string | undefined
  let pages = 0
  let resendErr: string | null = null

  for (let p = 0; p < MAX_PAGES; p++) {
    const u = new URL('https://api.resend.com/emails')
    u.searchParams.set('limit', String(PAGE_LIMIT))
    if (cursor) u.searchParams.set('after', cursor)
    const r = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      resendErr = `${r.status} ${text.slice(0, 200)}`
      break
    }
    const data: any = await r.json().catch(() => ({}))
    const items: any[] = data?.data ?? data ?? []
    if (!Array.isArray(items) || items.length === 0) break

    for (const item of items) {
      // Match the blast by subject + delivered/sent status
      const subject: string = item.subject || ''
      if (!subject.toLowerCase().includes(SUBJECT_NEEDLE)) continue
      const status: string = (item.last_event || item.status || '').toLowerCase()
      if (status && ['bounced', 'failed', 'complained'].includes(status)) continue
      const to = Array.isArray(item.to) ? item.to[0] : item.to
      if (typeof to === 'string') recipients.add(to.toLowerCase())
    }

    pages++
    cursor = data?.next_cursor || data?.cursor
    if (!cursor || items.length < PAGE_LIMIT) break
  }

  if (resendErr) {
    return NextResponse.json({
      error: 'Resend list emails failed',
      detail: resendErr,
      note: "If Resend doesn't expose listing on your tier, mark users manually via the SQL editor.",
    }, { status: 502 })
  }

  if (recipients.size === 0) {
    return NextResponse.json({ marked: 0, foundRecipients: 0, pages })
  }

  // Match recipients to users and mark
  const emails = Array.from(recipients)
  // Postgres .in() can handle hundreds — fine for this scale
  const { data: matched } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .in('email', emails)

  const ids = (matched || []).map((u) => u.id)
  if (ids.length === 0) {
    return NextResponse.json({ marked: 0, foundRecipients: emails.length, pages })
  }

  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ quiz_blast_sent_at: new Date().toISOString() })
    .in('id', ids)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    marked: ids.length,
    foundRecipients: emails.length,
    pages,
  })
}
