'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { parseResponse } from '@/lib/fetch-helpers'
import s from './admin.module.css'

// Pending community-link submissions (Discord/group-chat) awaiting approval.
// Hidden entirely when there's nothing to review.
function CommunityLinksAdmin() {
  const [pending, setPending] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  async function load() { try { const r = await fetch('/api/admin/community-links'); if (r.ok) setPending((await r.json()).pending || []) } catch { /* ignore */ } setLoaded(true) }
  useEffect(() => { load() }, [])
  async function act(id: string, action: 'approve' | 'reject') {
    setPending((p) => p.filter((x) => x.id !== id))
    try { await fetch('/api/admin/community-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) }) } catch { /* ignore */ }
  }
  if (loaded && pending.length === 0) return null
  return (
    <div style={{ background: '#fff', border: '2px solid #ff6a1f', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.2rem', marginBottom: '0.2rem' }}>💬 Community links — pending review ({pending.length})</div>
      <div style={{ fontSize: '0.8rem', color: '#6b6b76', marginBottom: '0.8rem' }}>Submitted Discord/group-chat links for City Pulse. Approve to publish, reject to drop.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {pending.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.7rem', background: '#faf7f3', borderRadius: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{l.title} <span style={{ fontWeight: 400, color: '#6b6b76', fontSize: '0.75rem' }}>· {l.kind}{l.metro ? ` · ${l.metro}` : ''}{l.is_test ? ' · TEST' : ''}</span></div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#2563ff', wordBreak: 'break-all' }}>{l.url}</a>
              {l.description && <div style={{ fontSize: '0.78rem', color: '#6b6b76' }}>{l.description}</div>}
            </div>
            <button onClick={() => act(l.id, 'approve')} style={{ background: '#2d7a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.85rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>approve</button>
            <button onClick={() => act(l.id, 'reject')} style={{ background: 'transparent', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 8, padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.78rem' }}>reject</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Scene moderation — review & DELETE friend-line events/posts that look off.
// Flagged items (e.g. legacy gender-targeted events) float to the top.
function SceneModerationAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [show, setShow] = useState(false)
  async function load() { try { const r = await fetch('/api/admin/friend-activities'); if (r.ok) setItems((await r.json()).activities || []) } catch { /* ignore */ } setLoaded(true) }
  useEffect(() => { load() }, [])
  async function del(id: string, title: string) {
    if (!confirm(`Delete this Scene post for everyone?\n\n"${title || 'untitled'}"`)) return
    setItems((p) => p.filter((x) => x.id !== id))
    try { await fetch('/api/admin/friend-activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) } catch { /* ignore */ }
  }
  if (!loaded) return null
  const flagged = items.filter((i) => i.flag).length
  const sorted = [...items].sort((a, b) => (b.flag ? 1 : 0) - (a.flag ? 1 : 0))
  return (
    <div style={{ background: '#fff', border: `2px solid ${flagged ? '#c0392b' : '#e6e6ea'}`, borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
      <div onClick={() => setShow((v) => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.2rem' }}>🚩 Scene moderation <span style={{ fontSize: '0.85rem', color: '#6b6b76' }}>· {items.length} recent{flagged ? `, ${flagged} flagged` : ''}</span></div>
        <span style={{ color: '#6b6b76', fontSize: '0.9rem' }}>{show ? '▲ hide' : '▼ review'}</span>
      </div>
      {show && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
          {sorted.length === 0 && <div style={{ fontSize: '0.82rem', color: '#6b6b76' }}>No Scene posts.</div>}
          {sorted.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.7rem', background: a.flag ? '#fdecea' : '#faf7f3', border: a.flag ? '1px solid #e8a99f' : '1px solid transparent', borderRadius: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  {a.flag && <span style={{ color: '#c0392b' }}>⚑ </span>}{a.kind === 'post' ? '💬' : '📅'} {a.title || '—'}
                  <span style={{ fontWeight: 400, color: '#6b6b76', fontSize: '0.75rem' }}> · {a.category}{a.area ? ` · ${a.area}` : ''}{a.isTest ? ' · TEST' : ''}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b6b76' }}>
                  by {a.author?.name}{a.author?.gender ? ` · ${a.author.gender}` : ''}{a.author?.age ? ` · ${a.author.age}` : ''}{a.author?.email ? ` · ${a.author.email}` : ''}
                  {a.audienceGender?.length > 0 && <span style={{ color: '#c0392b' }}> · targets {a.audienceGender.join('/')}</span>}
                  {a.capacity ? ` · cap ${a.capacity}` : ''}
                </div>
                {a.body && <div style={{ fontSize: '0.78rem', color: '#6b6b76', fontStyle: 'italic' }}>“{String(a.body).slice(0, 120)}”</div>}
              </div>
              <button onClick={() => del(a.id, a.title)} style={{ background: 'transparent', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 8, padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DailyActivityEmailPreviewAdmin() {
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/daily-activity-email')
      if (response.ok) setPreview(await response.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  if (!preview) return null
  return (
    <div style={{ background: '#fff', border: `2px solid ${preview.enabled ? '#2d7a4f' : '#e0b05c'}`, borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.2rem' }}>📬 Daily Love + Friend activity drop</div>
        <span className={`${s.chip} ${preview.enabled ? s.chipGold : ''}`}>{preview.enabled ? 'active' : 'approval-gated'}</span>
        <button onClick={load} disabled={loading} className={s.btn} style={{ marginLeft: 'auto' }}>{loading ? 'refreshing…' : 'refresh count'}</button>
      </div>
      <div className={s.chips} style={{ marginTop: '0.8rem' }}>
        <span className={s.chip}>Eligible now <b>{preview.candidates}</b></span>
        <span className={s.chip}>Love items <b>{preview.totals?.love || 0}</b></span>
        <span className={s.chip}>Friend items <b>{preview.totals?.friend || 0}</b></span>
        <span className={s.chip}>Plans <b>{preview.totals?.plans || 0}</b></span>
      </div>
      <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#faf7f3', borderRadius: 10, fontSize: '0.8rem', lineHeight: 1.55 }}>
        <div><b>Subject:</b> {preview.subject}</div>
        <div><b>Headline:</b> {preview.template?.headline}</div>
        <div><b>Body:</b> {preview.template?.intro}</div>
        <div><b>Sections:</b> {(preview.template?.dynamicSections || []).join(' · ')}</div>
        <div><b>CTA:</b> {preview.template?.primaryCta}</div>
        <div><b>Cadence:</b> {preview.template?.cadence}</div>
      </div>
      <p className={s.note} style={{ marginTop: '0.7rem' }}>Read-only preview. No manual send button: once separately approved, the cron sends at most one consolidated email per person per day and only when something is new or unread.</p>
    </div>
  )
}

export default function AdminClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<any>(null)
  const [liveEvents, setLiveEvents] = useState<any>(null)
  const [pools, setPools] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [metroHealth, setMetroHealth] = useState<any>(null)
  const [appFeedback, setAppFeedback] = useState<any>(null)
  const [reports, setReports] = useState<any>(null)
  const [experimentEmailDryRun, setExperimentEmailDryRun] = useState<any>(null)
  const [seedAccounts, setSeedAccounts] = useState<Array<{ name: string; email: string; loginUrl: string }> | null>(null)
  const [replyOpen, setReplyOpen] = useState<string | null>(null) // feedback id being replied to
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  async function loadFeedback() {
    try {
      const r = await fetch('/api/admin/feedback')
      if (!r.ok) {
        const b = await parseResponse<any>(r).catch(() => ({}))
        setAppFeedback({ __error: b?.error || `HTTP ${r.status}`, items: [] })
        return
      }
      setAppFeedback(await parseResponse<any>(r))
    } catch (e: any) {
      setAppFeedback({ __error: e?.message || 'network error', items: [] })
    }
  }

  async function sendFeedbackReply(feedbackId: string) {
    if (!replyText.trim() || replyBusy) return
    setReplyBusy(true)
    try {
      const r = await fetch('/api/admin/feedback/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, message: replyText.trim() }),
      })
      const d = await parseResponse<any>(r)
      if (!r.ok) { alert(d.error || 'Reply failed'); return }
      setReplyOpen(null); setReplyText('')
      loadFeedback()
    } finally {
      setReplyBusy(false)
    }
  }

  async function loadReports() {
    try {
      const r = await fetch('/api/admin/reports')
      if (!r.ok) { setReports({ __error: `HTTP ${r.status}`, items: [] }); return }
      setReports(await parseResponse<any>(r))
    } catch (e: any) { setReports({ __error: e?.message || 'network error', items: [] }) }
  }
  async function moderate(userId: string, action: 'block' | 'unblock') {
    if (!confirm(action === 'block' ? 'Block this user from all matching?' : 'Unblock this user?')) return
    await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action }) })
    loadReports()
  }

  useEffect(() => {
    fetch('/api/admin-stats')
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })

    fetch('/api/admin/date-feedback')
      .then(async (r) => {
        if (!r.ok) {
          const body = await parseResponse<any>(r).catch(() => ({}))
          return { __error: body?.error || `HTTP ${r.status}`, items: [], stats: null }
        }
        return parseResponse<any>(r)
      })
      .then(setFeedback)
      .catch((e) => setFeedback({ __error: e?.message || 'network error', items: [], stats: null }))

    refreshLiveEvents()
    refreshPools()

    fetch('/api/admin/pool-health')
      .then(async (r) => {
        if (!r.ok) {
          const body = await parseResponse<any>(r).catch(() => ({}))
          return { __error: body?.error || `HTTP ${r.status}` }
        }
        return parseResponse<any>(r)
      })
      .then(setHealth)
      .catch((e) => setHealth({ __error: e?.message || 'network error' }))

    fetch('/api/admin/metro-health')
      .then(async (r) => {
        if (!r.ok) { const body = await parseResponse<any>(r).catch(() => ({})); return { __error: body?.error || `HTTP ${r.status}` } }
        return parseResponse<any>(r)
      })
      .then(setMetroHealth)
      .catch((e) => setMetroHealth({ __error: e?.message || 'network error' }))

    loadFeedback()
  }, [])

  async function refreshPools() {
    try {
      const r = await fetch('/api/admin/pools')
      if (!r.ok) {
        const body = await parseResponse<any>(r).catch(() => ({}))
        setPools({ __error: body?.error || `HTTP ${r.status}` })
        return
      }
      setPools(await parseResponse<any>(r))
    } catch (e: any) {
      setPools({ __error: e?.message || 'network error' })
    }
  }

  async function poolAction(action: 'release_cooldown' | 'lift_ban', userId: string, name: string) {
    const label = action === 'release_cooldown' ? 'release this cooldown early' : 'lift this ban (resets ghost count)'
    if (!confirm(`Are you sure you want to ${label} for ${name}?`)) return
    await fetch('/api/admin/pools/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId }),
    })
    refreshPools()
  }

  async function refreshLiveEvents() {
    try {
      const r = await fetch('/api/admin/live-events')
      if (!r.ok) {
        const body = await parseResponse<any>(r).catch(() => ({}))
        setLiveEvents({ __error: body?.error || `HTTP ${r.status}`, grouped: {}, counts: {}, blacklist: [] })
        return
      }
      setLiveEvents(await parseResponse<any>(r))
    } catch (e: any) {
      setLiveEvents({ __error: e?.message || 'network error', grouped: {}, counts: {}, blacklist: [] })
    }
  }

  async function hideEvent(activityId: string) {
    if (!confirm('Hide this event from the date-vibes deck? You can unhide it later.')) return
    await fetch('/api/admin/live-events/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId }),
    })
    refreshLiveEvents()
  }

  async function unhideEvent(activityId: string) {
    await fetch('/api/admin/live-events/hide', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId }),
    })
    refreshLiveEvents()
  }

  if (loading) return (
    <div className={s.center}>
      <p className={s.note}>Loading dashboard…</p>
    </div>
  )
  if (error) return (
    <div className={s.center}>
      <p className={s.noteErr}>Error: {error}</p>
    </div>
  )

  const stats = data?.stats
  const days = data?.signupsPerDay ?? {}

  return (
    <>
      <Nav />
      <div className={s.page}>

        {/* sticky top bar */}
        <div className={s.topbar}>
          <div className={s.topbarInner}>
            <div className={s.brandRow}>
              <span className={s.kicker}>Admin</span>
              <h1 className={s.title}>MISSION CONTROL</h1>
            </div>
            <nav className={s.nav}>
              <a href="#bottlenecks" className={s.navLink}>Bottlenecks</a>
              <a href="#funnel" className={s.navLink}>Funnel</a>
              <a href="#monetization" className={s.navLink}>Revenue funnel</a>
              <a href="#love-usage" className={s.navLink}>Love usage</a>
              <a href="#love-campaign" className={s.navLink}>Love campaign</a>
              <a href="#acquisition" className={s.navLink}>Acquisition</a>
              <a href="#traffic" className={s.navLink}>Traffic</a>
              <a href="#friend" className={s.navLink}>Friend</a>
              <a href="#pool" className={s.navLink}>Pool</a>
              <a href="#health" className={s.navLink}>Health</a>
              <a href="#ops" className={s.navLink}>Ops</a>
              <a href="#signups" className={s.navLink}>Signups</a>
              <a href="#matches" className={s.navLink}>Matches</a>
              <a href="#feedback" className={s.navLink}>Dates</a>
              <a href="#app-feedback" className={s.navLink}>Feedback</a>
              <a href="#reports" className={s.navLink}>Reports</a>
              <a href="#events" className={s.navLink}>Events</a>
            </nav>
          </div>
        </div>

        <div className={s.wrap}>

          <CommunityLinksAdmin />
          <SceneModerationAdmin />
          <DailyActivityEmailPreviewAdmin />

          {/* KPI row */}
          <div className={s.kpis}>
            {([
              ['Total Users', stats?.totalUsers, '👥', null],
              ['Total Matches', stats?.totalMatches, '💘', null],
              ['Revenue', `$${stats?.totalRevenue}`, '💰', stats?.revenue ? `Love extras $${stats.revenue.loveConnections ?? '0.00'} · packs $${stats.revenue.packs}` : 'collected to date'],
              ['Pro subs', stats?.activeSubs ?? 0, '✦', stats?.mrr != null ? `$${stats.mrr}/mo recurring` : null],
              ['Both Accepted', stats?.bothAccepted, '✅', null],
              ['Pending', stats?.pendingMatches, '⏳', null],
              ['Passed', stats?.passed, '👋', stats?.passRate != null ? `${stats.passRate}% pass rate` : null],
              ['Waiting', stats?.waiting, '👀', null],
              ['M / F / other', `${stats?.men} / ${stats?.women} / ${stats?.other}`, '⚖️', null],
            ] as Array<[string, any, string, string | null]>).map(([label, val, icon, sub]) => (
              <div key={label} className={s.kpi}>
                <div className={s.kpiIcon}>{icon}</div>
                <div className={s.kpiVal}>{val}</div>
                <div className={s.kpiLabel}>{label}</div>
                {sub && <div className={s.kpiSub}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* ── PRODUCT BOTTLENECKS — deterministic diagnosis over every snapshot ── */}
          <div className={s.card} id="bottlenecks">
            <div className={s.cardHead}>
              <div>
                <p className={s.cardTitle}>Snapshot diagnosis — <b>where the product is leaking</b></p>
                <p className={s.note} style={{ margin: '0.35rem 0 0' }}>Ranked from aggregate behavior. Nothing here automatically changes matching or contacts a user.</p>
              </div>
              {data?.bottlenecks?.summary && (
                <div className={s.chips} style={{ margin: 0 }}>
                  <span className={`${s.chip} ${s.chipRed}`}>Critical <b>{data.bottlenecks.summary.critical}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>High <b>{data.bottlenecks.summary.high}</b></span>
                  <span className={s.chip}>Watch <b>{data.bottlenecks.summary.watch}</b></span>
                </div>
              )}
            </div>
            {!data?.bottlenecks ? (
              <p className={s.note}>Bottleneck analysis is unavailable.</p>
            ) : data.bottlenecks.items.length === 0 ? (
              <div className={s.bottleneckHealthy}>No threshold-level product leaks detected in this snapshot. Keep watching cohort outcomes.</div>
            ) : (
              <div className={s.bottleneckGrid}>
                {data.bottlenecks.items.map((item: any, index: number) => (
                  <article
                    key={item.id}
                    className={`${s.bottleneckItem} ${item.severity === 'critical' ? s.bottleneckCritical : item.severity === 'high' ? s.bottleneckHigh : s.bottleneckWatch}`}
                  >
                    <div className={s.bottleneckMeta}>
                      <span>#{index + 1} · {item.severity}</span>
                      <span>{item.area}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p><b>Evidence:</b> {item.evidence}</p>
                    <p><b>Diagnosis:</b> {item.diagnosis}</p>
                    <div className={s.bottleneckAction}><b>Next move:</b> {item.nextAction}</div>
                    <div className={s.bottleneckTarget}>Current {item.metric.value}{item.metric.unit === 'percent' ? '%' : item.metric.unit === 'milliseconds' ? 'ms' : ''} · target {item.metric.target}</div>
                  </article>
                ))}
              </div>
            )}
            {data?.bottlenecks?.method && <p className={s.note} style={{ margin: '0.9rem 0 0' }}>{data.bottlenecks.method}</p>}
          </div>

          {/* ── LOVE LINE PRODUCT USE — experiment participation is excluded ── */}
          <div className={s.card} id="love-usage">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Love Line usage — <b>real product behavior</b></p>
            </div>
            {!data?.loveUsage ? (
              <p className={s.note}>Love usage metrics are unavailable.</p>
            ) : (
              <>
                {([
                  ['Last 24 hours', data.loveUsage.last24h],
                  ['Last 7 days', data.loveUsage.last7d],
                ] as Array<[string, any]>).map(([label, usage]) => (
                  <div key={label} style={{ marginBottom: '1rem' }}>
                    <p className={s.note} style={{ marginBottom: '0.55rem' }}>{label.toUpperCase()}</p>
                    <div className={s.chips}>
                      <span className={s.chip}>App-active accounts <b>{usage.signedInAccounts}</b></span>
                      <span className={s.chip}>Love visit sessions <b>{usage.loveVisitSessions}</b></span>
                      <span className={s.chip}>Love page views <b>{usage.loveViews}</b></span>
                      <span className={s.chip}>Rosters composed (auto + opens) <b>{usage.rosterCompositionAccounts}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>People who picked <b>{usage.pickers}</b></span>
                      <span className={s.chip}>Picks <b>{usage.picks}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>People messaging <b>{usage.messageSenders}</b></span>
                      <span className={s.chip}>Messages <b>{usage.messages}</b></span>
                      <span className={s.chip}>Active chats <b>{usage.activeConversations}</b></span>
                      <span className={s.chip}>New matches now mutual <b>{usage.newlyCreatedMutuals}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Meaningful Love users <b>{usage.meaningfulLoveAccounts}</b></span>
                    </div>
                  </div>
                ))}
                <div className={s.divider} />
                <p className={s.note} style={{ marginBottom: '0.55rem' }}>LIFETIME — EXACT, PAGINATED TOTALS</p>
                <div className={s.chips}>
                  <span className={s.chip}>Matches <b>{data.loveUsage.lifetime.matches}</b></span>
                  <span className={s.chip}>Mutual matches <b>{data.loveUsage.lifetime.mutualMatches}</b></span>
                  <span className={s.chip}>Ever matched <b>{data.loveUsage.lifetime.everMatchedAccounts}</b></span>
                  <span className={s.chip}>Ever mutual <b>{data.loveUsage.lifetime.everMutualAccounts}</b></span>
                  <span className={s.chip}>Ever sent a message <b>{data.loveUsage.lifetime.everMessageSenders}</b></span>
                </div>
                {data.loveFunnel && (
                  <>
                    <div className={s.divider} />
                    <p className={s.note} style={{ marginBottom: '0.55rem' }}>LIVE DECISION FUNNEL</p>
                    <div className={s.chips}>
                      <span className={s.chip}>12d active pool <b>{data.loveFunnel.activePool}</b></span>
                      <span className={s.chip}>Fresh rosters 24h <b>{data.loveFunnel.freshRosters24h}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Waiting, no connection <b>{data.loveFunnel.activePoolWithoutLiveConnection}</b></span>
                      <span className={s.chip}>No pick in 7d <b>{data.loveFunnel.activePoolWithoutPick7d}</b></span>
                      <span className={s.chip}>Live connections <b>{data.loveFunnel.liveConnections}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>One-sided <b>{data.loveFunnel.oneSidedConnections}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>People need to answer <b>{data.loveFunnel.peopleNeedToAnswer}</b></span>
                      <span className={s.chip}>Awaiting an answer <b>{data.loveFunnel.peopleAwaitingAnswer}</b></span>
                      <span className={s.chip}>Unanswered 24h+ <b>{data.loveFunnel.unanswered24h}</b></span>
                      <span className={s.chip}>Unanswered 48h+ <b>{data.loveFunnel.unanswered48h}</b></span>
                      <span className={s.chip}>Mutual <b>{data.loveFunnel.mutualConnections}</b></span>
                      <span className={s.chip}>Mutual, no message <b>{data.loveFunnel.mutualWithoutMessage}</b></span>
                    </div>
                    <p className={s.note} style={{ margin: '0.8rem 0 0.5rem' }}>CONCIERGE EMAIL LEDGER</p>
                    <div className={s.chips}>
                      <span className={s.chip}>Immediate sent <b>{data.loveFunnel.notifications.immediateSent}</b></span>
                      <span className={s.chip}>24h sent <b>{data.loveFunnel.notifications.reminder24hSent}</b></span>
                      <span className={s.chip}>Final sent <b>{data.loveFunnel.notifications.finalSent}</b></span>
                      <span className={s.chip}>12h mutual nudge <b>{data.loveFunnel.notifications.mutualNoMessage12hSent}</b></span>
                      <span className={s.chip}>Delivered <b>{data.loveFunnel.notifications.delivered}</b></span>
                      <span className={s.chip}>Opened <b>{data.loveFunnel.notifications.opened}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Clicked <b>{data.loveFunnel.notifications.clicked}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Failed <b>{data.loveFunnel.notifications.failed}</b></span>
                      <span className={s.chip}>Accepted after notice <b>{data.loveFunnel.decisions.accepted}</b></span>
                      <span className={s.chip}>Passed after notice <b>{data.loveFunnel.decisions.passed}</b></span>
                      <span className={s.chip}>Expired unanswered <b>{data.loveFunnel.decisions.expired}</b></span>
                    </div>
                  </>
                )}
                {data.appExperience && (
                  <>
                    <div className={s.divider} />
                    <p className={s.note} style={{ marginBottom: '0.55rem' }}>AUTHENTICATED INTERACTION + PWA PERFORMANCE · LAST 24H</p>
                    <div className={s.chips}>
                      <span className={s.chip}>Dashboard opens <b>{data.appExperience.interactions.dashboardOpens}</b></span>
                      <span className={s.chip}>Roster views <b>{data.appExperience.interactions.rosterViews}</b></span>
                      <span className={s.chip}>Profile opens <b>{data.appExperience.interactions.profileOpens}</b></span>
                      <span className={s.chip}>AI read paywalls <b>{data.appExperience.interactions.compatibilityPaywalls}</b></span>
                      <span className={s.chip}>AI read requests <b>{data.appExperience.interactions.compatibilityReadRequests}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>AI reads opened <b>{data.appExperience.interactions.compatibilityReadOpens}</b></span>
                      <span className={s.chip}>Pick attempts <b>{data.appExperience.interactions.pickAttempts}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Pick successes <b>{data.appExperience.interactions.pickSuccesses}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Pick failures <b>{data.appExperience.interactions.pickFailures}</b></span>
                      <span className={s.chip}>No fit today <b>{data.appExperience.interactions.noSuitableChoice}</b></span>
                      <span className={s.chip}>First messages <b>{data.appExperience.interactions.firstMessages}</b></span>
                      <span className={s.chip}>First replies <b>{data.appExperience.interactions.replies}</b></span>
                      <span className={s.chip}>Coach requests <b>{data.appExperience.interactions.coachRequests}</b></span>
                      <span className={s.chip}>Roster API p75 <b>{data.appExperience.performance.rosterApiP75Ms ?? '—'}ms</b></span>
                      <span className={s.chip}>LCP p75 <b>{data.appExperience.performance.lcpP75Ms ?? '—'}ms</b></span>
                      <span className={s.chip}>INP p75 <b>{data.appExperience.performance.inpP75Ms ?? '—'}ms</b></span>
                      <span className={s.chip}>CLS p75 <b>{data.appExperience.performance.clsP75 ?? '—'}</b></span>
                      <span className={`${s.chip} ${data.appExperience.performance.clientErrors ? s.chipRed : ''}`}>Client errors <b>{data.appExperience.performance.clientErrors}</b></span>
                      <span className={`${s.chip} ${data.appExperience.performance.clientErrorSessions ? s.chipRed : ''}`}>Affected sessions <b>{data.appExperience.performance.clientErrorSessions ?? 0}</b></span>
                    </div>
                    {data.appExperience.performance.recentErrorGroups?.length > 0 && (
                      <div style={{ marginTop: '0.7rem' }}>
                        <p className={s.note} style={{ marginBottom: '0.4rem' }}>PRIVACY-SAFE ERROR GROUPS · PATH + CATEGORY, NO RAW MESSAGE OR STACK</p>
                        <div className={s.chips}>
                          {data.appExperience.performance.recentErrorGroups.map((group: any) => (
                            <span key={`${group.fingerprint}-${group.path}-${group.code}`} className={`${s.chip} ${s.chipRed}`}>
                              {group.path} · {group.code} <b>{group.count}</b>{group.phone ? ` · ${group.phone} phone` : ''}{group.installedPwa ? ` · ${group.installedPwa} PWA` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <p className={s.note} style={{ marginTop: '0.75rem', lineHeight: 1.6 }}>
                  Picks, mutual participants and message senders are signed-in, real-user actions. Roster composition includes scheduled rotation, so it is context rather than meaningful use. Love visits are anonymous browser/PWA sessions and stay separate. Dating Experiment entries and test accounts never count here.
                </p>
              </>
            )}
          </div>

          {/* ── LOVE LINE RELAUNCH CAMPAIGN ── */}
          <div className={s.card} id="love-campaign">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Dating Experiment comeback — <b>email engagement</b></p>
            </div>
            {!data?.loveCampaign ? (
              <p className={s.note}>Apply the email campaign migration to start the delivery ledger.</p>
            ) : (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Sent <b>{data.loveCampaign.sent}</b></span>
                  <span className={s.chip}>Delivered <b>{data.loveCampaign.delivered}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>CTA clicks <b>{data.loveCampaign.clicked}</b></span>
                  <span className={s.chip}>Directional opens <b>{data.loveCampaign.opened}</b></span>
                  <span className={s.chip}>Delivery rate <b>{data.loveCampaign.deliveryRatePct == null ? '—' : `${data.loveCampaign.deliveryRatePct}%`}</b></span>
                  <span className={s.chip}>Click / delivered <b>{data.loveCampaign.clickRatePct == null ? '—' : `${data.loveCampaign.clickRatePct}%`}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Bounced <b>{data.loveCampaign.bounced}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Complaints <b>{data.loveCampaign.complained}</b></span>
                  <span className={s.chip}>Failed <b>{data.loveCampaign.failed}</b></span>
                </div>
                <p className={s.note} style={{ marginTop: '0.75rem' }}>
                  CTA clicks are first-party. Opens are only directional because mailbox privacy tools can preload tracking pixels.
                </p>
                {data.eligibleReadyCampaign && (
                  <>
                    <div className={s.divider} />
                    <p className={s.note} style={{ marginBottom: '0.65rem' }}>Profile-ready reminder · one-time cohort</p>
                    <div className={s.chips}>
                      <span className={s.chip}>Sent <b>{data.eligibleReadyCampaign.sent}</b></span>
                      <span className={s.chip}>Delivered <b>{data.eligibleReadyCampaign.delivered}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>CTA clicks <b>{data.eligibleReadyCampaign.clicked}</b></span>
                      <span className={s.chip}>Directional opens <b>{data.eligibleReadyCampaign.opened}</b></span>
                      <span className={s.chip}>Experiment views <b>{data.eligibleReadyCampaign.experimentViewed}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Entries <b>{data.eligibleReadyCampaign.entrySubmitted}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Bounced <b>{data.eligibleReadyCampaign.bounced}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Complaints <b>{data.eligibleReadyCampaign.complained}</b></span>
                    </div>
                  </>
                )}
                {data.loveCampaign.funnel && (
                  <>
                    <div className={s.divider} />
                    <p className={s.note} style={{ marginBottom: '0.65rem' }}>
                      Recipient conversion funnel · unique people, first-party
                    </p>
                    <div className={s.chips}>
                      <span className={s.chip}>Email clicked <b>{data.loveCampaign.funnel.emailClicked}</b></span>
                      <span className={s.chip}>Profile CTA <b>{data.loveCampaign.funnel.profileCtaClicked}</b></span>
                      <span className={s.chip}>Profile started <b>{data.loveCampaign.funnel.profileStarted}</b></span>
                      <span className={s.chip}>Profile saved <b>{data.loveCampaign.funnel.profileSaved}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Became eligible <b>{data.loveCampaign.funnel.profileEligible}</b></span>
                      <span className={s.chip}>Eligible now <b>{data.loveCampaign.funnel.profileNowEligible}</b></span>
                      <span className={s.chip}>Experiment viewed <b>{data.loveCampaign.funnel.experimentViewed}</b></span>
                      <span className={s.chip}>Rules continued <b>{data.loveCampaign.funnel.rulesContinued}</b></span>
                      <span className={s.chip}>Preferences done <b>{data.loveCampaign.funnel.preferencesCompleted}</b></span>
                      <span className={s.chip}>Schedule picked <b>{data.loveCampaign.funnel.scheduleSelected}</b></span>
                      <span className={s.chip}>Questions done <b>{data.loveCampaign.funnel.questionnaireCompleted}</b></span>
                      <span className={s.chip}>Consent done <b>{data.loveCampaign.funnel.consentCompleted}</b></span>
                      <span className={s.chip}>Submit attempted <b>{data.loveCampaign.funnel.entrySubmitAttempted}</b></span>
                      <span className={`${s.chip} ${s.chipRed}`}>Submit failed <b>{data.loveCampaign.funnel.entrySubmitFailed}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Entries from campaign <b>{data.loveCampaign.funnel.entrySubmitted}</b></span>
                      <span className={s.chip}>All current entries <b>{data.loveCampaign.funnel.totalCurrentExperimentEntries}</b></span>
                      <span className={s.chip}>Profile click → eligible <b>{data.loveCampaign.funnel.profileClickToEligiblePct == null ? '—' : `${data.loveCampaign.funnel.profileClickToEligiblePct}%`}</b></span>
                      <span className={s.chip}>Eligible → entry <b>{data.loveCampaign.funnel.eligibleToEntryPct == null ? '—' : `${data.loveCampaign.funnel.eligibleToEntryPct}%`}</b></span>
                      <span className={s.chip}>Email click → entry <b>{data.loveCampaign.funnel.clickToEntryPct == null ? '—' : `${data.loveCampaign.funnel.clickToEntryPct}%`}</b></span>
                    </div>
                    {!data.loveCampaign.funnel.trackingReady && (
                      <p className={s.note} style={{ marginTop: '0.65rem' }}>Apply the campaign funnel migration to begin user-bound stage tracking.</p>
                    )}
                  </>
                )}
              </>
            )}
            {data?.traffic?.reactivation && (
              <>
                <div className={s.divider} />
                <p className={s.note} style={{ marginBottom: '0.65rem' }}>Welcome-back profile loop · last 7 days</p>
                <div className={s.chips}>
                  <span className={s.chip}>Welcome views <b>{data.traffic.reactivation.welcomeViews}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Profile starts <b>{data.traffic.reactivation.profileReviewStarts}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Profiles saved <b>{data.traffic.reactivation.profileSaves}</b></span>
                  <span className={s.chip}>Love retunes <b>{data.traffic.reactivation.loveAnswerStarts}</b></span>
                  <span className={s.chip}>Reactivated <b>{data.traffic.reactivation.loveReactivated}</b></span>
                  <span className={s.chip}>Used current <b>{data.traffic.reactivation.currentProfileUsed}</b></span>
                  <span className={s.chip}>Dismissed <b>{data.traffic.reactivation.dismissed}</b></span>
                </div>
              </>
            )}
          </div>

          {/* ── MONETIZATION FUNNEL (last 30 days) ── */}
          <div className={s.card} id="monetization">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Revenue funnel — <b>last 30 days</b></p>
            </div>
            {!data?.monetization ? (
              <p className={s.note}>tracking starts after the monetization migration is applied.</p>
            ) : (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Paywall viewers <b>{data.monetization.paywallViewers}</b></span>
                  <span className={s.chip}>Checkout starters <b>{data.monetization.checkoutStarters}</b></span>
                  <span className={s.chip}>Checkout failures <b>{data.monetization.checkoutFailures}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Purchases <b>{data.monetization.purchases}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Tracked revenue <b>${data.monetization.trackedRevenue}</b></span>
                  <span className={s.chip}>View → checkout <b>{data.monetization.viewToCheckoutPct == null ? '—' : `${data.monetization.viewToCheckoutPct}%`}</b></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.7rem', marginTop: '0.8rem' }}>
                  {([
                    ['love_connection', 'AI reads + Love connections'],
                    ['love_profile', 'Legacy profile unlocks'],
                    ['friend_pack', 'Friend packs'],
                    ['pro', 'Pro'],
                  ] as const).map(([key, label]) => {
                    const product = data.monetization.products?.[key]
                    return (
                      <div key={key} style={{ border: '1px solid #e6e6ea', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700 }}>{label}</div>
                        <div style={{ marginTop: '0.35rem', fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', lineHeight: 1.65, color: '#6b6b76' }}>
                          {product?.paywallViewers ?? 0} viewers · {product?.checkoutStarters ?? 0} started<br />
                          {product?.purchases ?? 0} bought · ${product?.trackedRevenue ?? '0.00'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── CONVERSION FUNNEL (the app's webflow) ── */}
          <div className={s.card} id="funnel">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Conversion funnel — <b>where users flow &amp; drop</b></p>
            </div>
            {!data?.funnel ? <p className={s.note}>loading…</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.5rem' }}>
                {data.funnel.map((stg: any, i: number) => {
                  const prev = i > 0 ? data.funnel[i - 1].count : null;
                  const dropPct = prev && prev > 0 ? Math.round(((prev - stg.count) / prev) * 100) : null;
                  return (
                    <div key={stg.label} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <span style={{ width: 148, flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0e0c1a' }}>{stg.label}</span>
                      <div style={{ flex: 1, background: 'rgba(37,99,255,0.1)', borderRadius: 6, height: 26, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ width: `${stg.pctOfTotal}%`, height: '100%', background: 'linear-gradient(90deg,#2563ff,#1b46c9)', borderRadius: 6, minWidth: stg.count > 0 ? 3 : 0 }} />
                        <span style={{ position: 'absolute', left: 9, top: 0, lineHeight: '26px', fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', fontWeight: 700, color: stg.pctOfTotal > 14 ? '#fff' : '#0e0c1a' }}>{stg.count}</span>
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: '#7a7590' }}>{stg.pctOfTotal}%</span>
                      <span style={{ width: 64, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', color: dropPct != null && dropPct >= 50 ? '#d94f3d' : '#a8a3b8' }} title="drop-off from previous stage">
                        {dropPct != null ? `−${dropPct}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── ONLY IN BOSTON ACQUISITION ── */}
          <div className={s.card} id="acquisition">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Only in Boston — <b>acquisition snapshot</b></p>
            </div>
            {!data?.onlyInBoston ? (
              <p className={s.note}>acquisition data is not available yet.</p>
            ) : (
              <>
                <p className={s.note} style={{ marginBottom: '0.65rem' }}>
                  Live-window measurement starts {data.onlyInBoston.launchLabel}. Tagged numbers are direct attribution; launch-window and social-referral numbers are directional and may include other traffic.
                </p>
                <div className={s.chips}>
                  <span className={`${s.chip} ${s.chipGold}`}>Tagged visits <b>{data.onlyInBoston.attributedSessions}</b></span>
                  <span className={s.chip}>Tagged Experiment visits <b>{data.onlyInBoston.attributedLandingSessions}</b></span>
                  <span className={s.chip}>Tagged signups <b>{data.onlyInBoston.attributedSignups}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Tagged entries <b>{data.onlyInBoston.attributedEntries}</b></span>
                  <span className={s.chip}>Visit → signup <b>{data.onlyInBoston.attributedVisitToSignupPct == null ? '—' : `${data.onlyInBoston.attributedVisitToSignupPct}%`}</b></span>
                  <span className={s.chip}>Visit → entry <b>{data.onlyInBoston.attributedVisitToEntryPct == null ? '—' : `${data.onlyInBoston.attributedVisitToEntryPct}%`}</b></span>
                  <span className={s.chip}>Instagram referrals <b>{data.onlyInBoston.instagramReferralSessions}</b></span>
                  <span className={s.chip}>Facebook referrals <b>{data.onlyInBoston.facebookReferralSessions}</b></span>
                  <span className={s.chip}>All sessions since launch <b>{data.onlyInBoston.launchWindowSessions}</b></span>
                  <span className={s.chip}>Experiment sessions since launch <b>{data.onlyInBoston.experimentSessions}</b></span>
                  <span className={s.chip}>New signups since launch <b>{data.onlyInBoston.launchWindowSignups}</b></span>
                  <span className={s.chip}>New entries since launch <b>{data.onlyInBoston.launchWindowEntries}</b></span>
                </div>
                <div className={s.divider} />
                {data.onlyInBoston.channels?.facebookStory && (
                  <>
                    <p className={s.note} style={{ marginBottom: '0.45rem' }}><b>Facebook story — direct attribution</b></p>
                    <div className={s.chips}>
                      <span className={`${s.chip} ${s.chipGold}`}>Visits <b>{data.onlyInBoston.channels.facebookStory.sessions}</b></span>
                      <span className={s.chip}>Experiment visits <b>{data.onlyInBoston.channels.facebookStory.landingSessions}</b></span>
                      <span className={s.chip}>Signups <b>{data.onlyInBoston.channels.facebookStory.signups}</b></span>
                      <span className={`${s.chip} ${s.chipGold}`}>Entries <b>{data.onlyInBoston.channels.facebookStory.entries}</b></span>
                    </div>
                    <p className={s.note} style={{ marginTop: '0.45rem' }}>
                      Facebook story link: <code>{data.onlyInBoston.channels.facebookStory.taggedUrl}</code>
                    </p>
                    <div className={s.divider} />
                  </>
                )}
                <p className={s.note}>
                  Instagram story link: <code>{data.onlyInBoston.taggedUrl}</code>
                </p>
                {!data.onlyInBoston.trackingReady && (
                  <p className={s.note} style={{ marginTop: '0.45rem' }}>Apply the acquisition migration to enable exact tagged conversion.</p>
                )}
              </>
            )}
          </div>

          {/* ── WEB TRAFFIC (pageview flow, last 7 days) ── */}
          <div className={s.card} id="traffic">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Web traffic — <b>last 7 days</b></p>
            </div>
            {!data?.traffic ? (
              <p className={s.note}>no traffic data yet — run the page_views migration, then give it a few visits.</p>
            ) : (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Pageviews <b>{data.traffic.totalViews}</b></span>
                  <span className={s.chip}>Unique sessions <b>{data.traffic.uniqueSessions}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Installed PWA views <b>{data.traffic.pwaViews}</b></span>
                  <span className={s.chip}>PWA sessions <b>{data.traffic.pwaSessions}</b></span>
                  <span className={s.chip}>Browser views <b>{data.traffic.browserViews}</b></span>
                  <span className={s.chip}>Phone views <b>{data.traffic.phoneViews}</b></span>
                  <span className={s.chip}>Phone landscape <b>{data.traffic.landscapePhoneViews}</b></span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: 60, margin: '0.75rem 0 1.25rem' }}>
                  {Object.entries(data.traffic.viewsByDay).map(([day, count]: any) => {
                    const max = Math.max(...Object.values(data.traffic.viewsByDay) as number[], 1);
                    const pct = (count / max) * 100;
                    return (
                      <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', color: '#7a7590' }}>{count}</div>
                        <div style={{ width: '100%', background: '#2563ff', height: `${Math.max(pct, 4)}%`, minHeight: 3, borderRadius: '2px 2px 0 0' }} />
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.42rem', color: '#a8a3b8' }}>{day.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a7590', marginBottom: '0.5rem' }}>top pages</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {data.traffic.topPaths.map((p: any) => {
                    const max = data.traffic.topPaths[0]?.count || 1;
                    return (
                      <div key={p.path} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <span style={{ width: 200, flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: '#0e0c1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
                        <div style={{ flex: 1, background: 'rgba(37,99,255,0.1)', borderRadius: 5, height: 18 }}>
                          <div style={{ width: `${Math.round((p.count / max) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#2563ff,#1b46c9)', borderRadius: 5, minWidth: 3 }} />
                        </div>
                        <span style={{ width: 40, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: '#7a7590' }}>{p.count}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── FRIEND MAXXIN ── */}
          <div className={s.card} id="friend">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Friend Line — <b>connection funnel</b></p>
            </div>
            {!data?.friend ? (
              <p className={s.note}>no friend data yet (run the friend migrations).</p>
            ) : (
              <div className={s.chips}>
                <span className={s.chip}>Opted in <b>{data.friend.optedIn}</b></span>
                <span className={`${s.chip} ${s.chipGold}`}>Chat unlocks <b>{data.friend.chatUnlocks}</b></span>
                <span className={s.chip}>Unlock rev <b>${data.friend.unlockRevenue}</b></span>
                <span className={s.chip}>Connections <b>{data.friend.connectionsMade}</b></span>
                <span className={s.chip}>Pending <b>{data.friend.connectionsPending}</b></span>
                <span className={s.chip}>Active crews <b>{data.friend.activeCircles}</b></span>
                <span className={s.chip}>Trips saved <b>{data.friend.scheduledTrips ?? 0}</b></span>
                <span className={s.chip}>Travelers now <b>{data.friend.activeTravelers ?? 0}</b></span>
                <span className={s.chip}>Travel matches <b>{data.friend.travelMatches ?? 0}</b></span>
                <span className={s.chip}>Travel metros <b>{data.friend.travelMetros ?? 0}</b></span>
                <span className={s.chip}>Chat msgs <b>{data.friend.messages}</b></span>
                <span className={s.chip}>Posts <b>{data.friend.posts}</b></span>
                <span className={s.chip}>Events <b>{data.friend.events}</b></span>
                <span className={`${s.chip} ${s.chipGold}`}>30d real actions <b>{data.friend.connectionActionUsers30d ?? 0}</b></span>
                <span className={s.chip}>Discovery users <b>{data.friend.discoveryUsers30d ?? 0}</b></span>
                <span className={s.chip}>Signals live <b>{data.friend.openIntents ?? 0}</b></span>
                <span className={s.chip}>Signal creators <b>{data.friend.intentCreators30d ?? 0}</b></span>
                <span className={s.chip}>Signal joiners <b>{data.friend.intentJoiners30d ?? 0}</b></span>
                <span className={s.chip}>Plan RSVPs <b>{data.friend.planRsvps30d ?? 0}</b></span>
                <span className={s.chip}>Community opens <b>{data.friend.communityOpeners30d ?? 0}</b></span>
                <span className={s.chip}>Clubs <b>{data.friend.clubs ?? 0}</b></span>
                <span className={s.chip}>Communities <b>{data.friend.communities ?? 0}</b></span>
              </div>
            )}
          </div>

          {/* ── DATING POOL ── */}
          <div className={s.card} id="pool">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Dating pool — <b>live segments</b></p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className={`${s.btn} ${s.btnGhost}`} onClick={refreshPools}>refresh</button>
              </div>
            </div>

            {!pools && <p className={s.note}>loading…</p>}
            {pools?.__error && <p className={s.noteErr}>couldn’t load: {pools.__error}</p>}

            {pools && !pools.__error && (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Pool eligible <b>{pools.summary?.active ?? 0}</b></span>
                  <span className={s.chip}>In a match <b>{pools.summary?.matched ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Cooldown <b>{pools.summary?.cooldown ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Banned <b>{pools.summary?.banned ?? 0}</b></span>
                </div>

                {pools.engagement && (
                  <div className={s.chips} style={{ marginTop: '-0.5rem' }}>
                    <span className={s.chip}>Logged in 24h <b>{pools.engagement.loggedIn24h ?? 0}</b></span>
                    <span className={s.chip}>48h <b>{pools.engagement.loggedIn48h ?? 0}</b></span>
                    <span className={s.chip}>7d <b>{pools.engagement.loggedIn7d ?? 0}</b></span>
                    <span className={`${s.chip} ${s.chipGold}`}>12d active <b>{pools.engagement.loggedIn12d ?? 0}</b></span>
                    <span className={s.chip}>Email reachable <b>{pools.engagement.emailReachable12d ?? 0}</b></span>
                    <span className={s.chip}>Push reachable <b>{pools.engagement.pushReachable12d ?? 0}</b></span>
                    <span className={s.chip}>Roster notified 7d <b>{pools.engagement.rosterNotified7d ?? 0}</b></span>
                    <span className={s.chip}>Fresh roster pending <b>{pools.engagement.pendingRosterChanges ?? 0}</b></span>
                  </div>
                )}

                {pools.byMetro && (
                  <div className={s.chips} style={{ marginTop: '-0.5rem' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7590', alignSelf: 'center' }}>area pools ·</span>
                    {Object.entries(pools.metroLabels || {}).map(([k, label]: any) => (
                      <span key={k} className={s.chip}>{label} <b>{pools.byMetro[k] ?? 0}</b></span>
                    ))}
                    {pools.byMetro.other > 0 && <span className={s.chip}>other <b>{pools.byMetro.other}</b></span>}
                  </div>
                )}

                <PoolHeatmap pools={pools} />

                <p className={s.heatNote}>
                  Tier A = active in last 2 days · B = within a week · next = queued for the next wave.
                  Matcher prefers same-intent, falls back across.
                </p>

                {(pools.penalty?.cooldown?.length > 0 || pools.penalty?.banned?.length > 0) && (
                  <div className={s.penalty}>
                    <div className={s.penaltyKind} style={{ color: '#d94f3d' }}>faulty actors</div>

                    {pools.penalty.cooldown.length > 0 && (
                      <div style={{ marginBottom: '0.8rem' }}>
                        <div className={`${s.penaltyKind} ${s.penaltyKindGold}`}>cooldown ({pools.penalty.cooldown.length}) — auto-releases</div>
                        {pools.penalty.cooldown.map((u: any) => (
                          <div key={u.id} className={`${s.penaltyRow} ${s.penaltyRowGold}`}>
                            <span><span className={s.penaltyName}>{u.name}</span> <span className={s.penaltyEmail}>· {u.email}</span></span>
                            <span className={s.penaltyRight}>
                              <span className={s.penaltyMeta}>{u.ghostReports} ghosts · until {u.cooldownUntil?.split('T')[0]}</span>
                              <button className={`${s.btn} ${s.btnTiny} ${s.btnRelease}`} onClick={() => poolAction('release_cooldown', u.id, u.name)}>release</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {pools.penalty.banned.length > 0 && (
                      <div>
                        <div className={`${s.penaltyKind} ${s.penaltyKindRed}`}>banned ({pools.penalty.banned.length}) — permanent</div>
                        {pools.penalty.banned.map((u: any) => (
                          <div key={u.id} className={`${s.penaltyRow} ${s.penaltyRowRed}`}>
                            <span><span className={s.penaltyName}>{u.name}</span> <span className={s.penaltyEmail}>· {u.email}</span></span>
                            <span className={s.penaltyRight}>
                              <span className={`${s.penaltyMeta} ${s.penaltyMetaRed}`}>{u.ghostReports} ghost reports</span>
                              <button className={`${s.btn} ${s.btnTiny} ${s.btnLift}`} onClick={() => poolAction('lift_ban', u.id, u.name)}>lift ban</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── POOL HEALTH ── */}
          <div className={s.card} id="health">
            <div className={s.cardHead}><p className={s.cardTitle}>Pool health — <b>the saturation read</b></p></div>

            {!health && <p className={s.note}>loading…</p>}
            {health?.__error && <p className={s.noteErr}>couldn’t load: {health.__error}</p>}

            {health && !health.__error && (
              <>
                {/* funnel */}
                <div className={s.funnel}>
                  {([
                    ['signed up', health.funnel?.signups],
                    ['quiz done', health.funnel?.quizComplete],
                    ['in pool', health.funnel?.inPool],
                    ['matched', health.funnel?.matched],
                    ['both accepted', health.funnel?.everBothAccepted],
                  ] as Array<[string, number]>).map(([label, val], i, arr) => (
                    <div key={label} className={s.funnelStep}>
                      <div className={s.funnelVal}>{val ?? 0}</div>
                      <div className={s.funnelLabel}>{label}</div>
                      {i < arr.length - 1 && <span className={s.funnelArrow}>→</span>}
                    </div>
                  ))}
                </div>

                {/* headline metrics */}
                <div className={s.healthRow}>
                  <div className={s.healthMetric}>
                    <div className={s.healthBig} style={{ color: convColor(health.conversion?.conversionPct) }}>
                      {health.conversion?.conversionPct != null ? `${health.conversion.conversionPct}%` : '—'}
                    </div>
                    <div className={s.healthLabel}>match → both accept</div>
                    <div className={s.healthSub}>{health.conversion?.bothAccepted ?? 0} of {(health.conversion?.created ?? 0) - (health.conversion?.pending ?? 0)} decided</div>
                  </div>
                  <div className={s.healthMetric}>
                    <div className={s.healthBig}>{health.wait?.medianDays ?? 0}<span className={s.healthUnit}>d</span></div>
                    <div className={s.healthLabel}>median wait</div>
                    <div className={s.healthSub}>p75 {health.wait?.p75Days ?? 0}d · max {health.wait?.maxDays ?? 0}d</div>
                  </div>
                  <div className={s.healthMetric}>
                    <div className={s.healthBig} style={{ color: (health.skew?.skewPct ?? 0) >= 65 ? '#d94f3d' : '#0e0c1a' }}>
                      {health.skew?.skewPct != null ? `${health.skew.skewPct}%` : '—'}
                    </div>
                    <div className={s.healthLabel}>pool skew{health.skew?.skewToward ? ` · ${health.skew.skewToward}` : ''}</div>
                    <div className={s.healthSub}>{health.skew?.m ?? 0}m / {health.skew?.f ?? 0}f / {health.skew?.other ?? 0}o</div>
                  </div>
                  <div className={s.healthMetric}>
                    <div className={s.healthBig}>{health.wait?.activeWaiting ?? 0}</div>
                    <div className={s.healthLabel}>waiting now</div>
                    <div className={s.healthSub}>{health.conversion?.pending ?? 0} matches pending</div>
                  </div>
                  <div className={s.healthMetric}>
                    <div className={s.healthBig} style={{ color: convColor(health.conversations90d?.mutualToBothMessagedPct) }}>
                      {health.conversations90d?.mutualToBothMessagedPct != null ? `${health.conversations90d.mutualToBothMessagedPct}%` : '—'}
                    </div>
                    <div className={s.healthLabel}>mutual → both message · 90d</div>
                    <div className={s.healthSub}>{health.conversations90d?.bothMessaged ?? 0} two-sided · {health.conversations90d?.fivePlusMessages ?? 0} with 5+ messages</div>
                  </div>
                </div>

                {/* outcome breakdown */}
                <div className={s.chips} style={{ marginTop: '1rem' }}>
                  <span className={s.chip}>Created <b>{health.conversion?.created ?? 0}</b></span>
                  <span className={s.chip}>Both accepted <b>{health.conversion?.bothAccepted ?? 0}</b></span>
                  <span className={s.chip}>Pending <b>{health.conversion?.pending ?? 0}</b></span>
                  <span className={s.chip}>Passed <b>{health.conversion?.passed ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Expired <b>{health.conversion?.expired ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Ghosted <b>{health.conversion?.ghosted ?? 0}</b></span>
                  <span className={s.chip}>Coach cards · 90d <b>{health.aiCoach90d?.cardsGenerated ?? 0}</b></span>
                  <span className={s.chip}>Coach users · 90d <b>{health.aiCoach90d?.users ?? 0}</b></span>
                  <span className={s.chip}>AI / fallback <b>{health.aiCoach90d?.ai ?? 0} / {health.aiCoach90d?.curated ?? 0}</b></span>
                </div>

                {/* two-up: stagnant + black holes */}
                <div className={s.healthLists}>
                  <div>
                    <div className={`${s.penaltyKind} ${s.penaltyKindRed}`}>stagnant residue ({health.stagnant?.length ?? 0})</div>
                    <p className={s.healthHint}>in pool, matched 3+ times, never a mutual yes — the people the pool keeps failing.</p>
                    {(health.stagnant?.length ?? 0) === 0
                      ? <p className={s.note}>none — pool is converting.</p>
                      : health.stagnant.map((u: any) => (
                        <div key={u.id} className={`${s.penaltyRow} ${s.penaltyRowRed}`}>
                          <span><span className={s.penaltyName}>{u.name}</span> <span className={s.penaltyEmail}>· {u.email}</span></span>
                          <span className={s.penaltyMeta}>{u.matches} matches · {u.accepts} they accepted</span>
                        </div>
                      ))}
                  </div>
                  <div>
                    <div className={`${s.penaltyKind} ${s.penaltyKindGold}`}>low acceptance ({health.blackHoles?.length ?? 0})</div>
                    <p className={s.healthHint}>in pool, lowest personal accept rate — chronic passers who burn match cycles.</p>
                    {(health.blackHoles?.length ?? 0) === 0
                      ? <p className={s.note}>not enough data yet.</p>
                      : health.blackHoles.map((u: any) => (
                        <div key={u.id} className={`${s.penaltyRow} ${s.penaltyRowGold}`}>
                          <span><span className={s.penaltyName}>{u.name}</span> <span className={s.penaltyEmail}>· {u.email}</span></span>
                          <span className={s.penaltyMeta}>{u.acceptRate}% accept · {u.matches} matches</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── METRO HEALTH ── */}
          <div className={s.card} id="metros">
            <div className={s.cardHead}><p className={s.cardTitle}>Metro health — <b>Northeast by city</b></p></div>
            {!metroHealth && <p className={s.note}>loading…</p>}
            {metroHealth?.__error && <p className={s.noteErr}>couldn’t load: {metroHealth.__error}</p>}
            {metroHealth && !metroHealth.__error && (
              <>
                <p className={s.note} style={{ marginBottom: '0.75rem' }}>
                  {metroHealth.totals?.total ?? 0} real members · {metroHealth.totals?.women ?? 0} women / {metroHealth.totals?.men ?? 0} men region-wide. Each metro is its own pool — watch the ratio (men per woman); 🔴 = needs women.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#6b6b76', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.4rem 0.5rem' }}>Metro</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Women</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Men</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>NB</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Women %</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Ratio (M/F)</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>In pool</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Friend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metroHealth.metros || []).map((m: any) => {
                        const ratioBad = m.ratio === null || m.ratio >= 2 // >=2 men per woman (or no women) = red
                        const ratioWarn = !ratioBad && m.ratio >= 1.5
                        const flag = ratioBad ? '🔴' : ratioWarn ? '🟡' : '🟢'
                        return (
                          <tr key={m.key} style={{ borderTop: '1px solid rgba(11,11,11,0.07)' }}>
                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{flag} {m.city}{m.state !== '—' ? <span style={{ color: '#9a96a8', fontWeight: 400 }}>, {m.state}</span> : ''}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>{m.total}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#2563ff', fontWeight: 600 }}>{m.women}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>{m.men}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#9a96a8' }}>{m.other}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>{m.womenPct}%</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: ratioBad ? '#d94f3d' : ratioWarn ? '#c97a0f' : '#3f7d57' }}>{m.ratio === null ? '∞' : m.ratio === 0 ? '—' : m.ratio}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>{m.active}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#d2530f' }}>{m.friends}</td>
                          </tr>
                        )
                      })}
                      {(metroHealth.metros || []).length === 0 && (
                        <tr><td colSpan={9} style={{ padding: '0.8rem 0.5rem', color: '#9a96a8', fontStyle: 'italic' }}>no members yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── OPS ── */}
          <div id="ops">
            <div className={`${s.actionsGrid} ${s.actions2}`} style={{ marginBottom: '0.75rem' }}>
              <a href="/api/admin/send-pending-matches" target="_blank" className={`${s.btn} ${s.btnInk}`}>📨 Preview pending Love decisions</a>
              <a href="/api/cron/rematch" target="_blank" className={`${s.btn} ${s.btnDeep}`}>🔄 Run rematch cron (raw)</a>
            </div>
            <div className={`${s.actionsGrid} ${s.actions2}`} style={{ marginBottom: '0.75rem' }}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={async () => {
                if (!confirm('Build the full TEST WORLD? 12 test accounts (log in as Test Alex): one live Love chat + a populated curated roster, a friend crew + a sealed pack to open, and a populated Scene with RSVPs. Re-running resets this isolated fixture namespace and retires obsolete test accounts.')) return;
                const res = await fetch('/api/admin/seed-test', { method: 'POST' });
                const d = await parseResponse<any>(res);
                if (!d.ok) { alert('Failed: ' + (d.error || 'unknown')); return; }
                setSeedAccounts(d.accounts || []);
              }}>🧪 Seed full test world + login links</button>
              <button className={`${s.btn} ${s.btnDeep}`} onClick={async () => {
                if (!confirm('Run the Dating Experiment shortlist now? This creates reciprocal private options for qualified entrants, can ultimately select up to two disjoint dinner pairs, and sends participating users a push notification.')) return;
                const res = await fetch('/api/admin/raffle-draw', { method: 'POST' });
                const d = await parseResponse<any>(res);
                if (!d.ok) { alert('Failed: ' + (d.error || d.message || 'unknown')); return; }
                alert(`Created/resolved ${d.drawn} pair(s) from ${d.entrants} entrant(s).${d.pairs?.length ? '\n\n' + d.pairs.map((p: any) => `${p.a} ✕ ${p.b} · ${p.score}`).join('\n') : (d.message ? '\n\n' + d.message : '')}`);
              }}>✦ Run experiment shortlist</button>
            </div>
            <div className={`${s.actionsGrid} ${s.actions3}`} style={{ marginBottom: '1.5rem' }}>
              <button className={`${s.btn} ${s.btnGold}`} onClick={async () => {
                const res = await fetch('/api/admin/fix-email-typos')
                const d = await parseResponse<any>(res)
                if ((d.count || 0) === 0) { alert('No typo\'d emails found. ✓'); return }
                const sample = (d.candidates || []).slice(0, 6).map((c: any) => `  ${c.email} → ${c.suggestion}`).join('\n')
                if (!confirm(`Found ${d.count} typo'd emails:\n\n${sample}${d.count > 6 ? `\n  …and ${d.count - 6} more` : ''}\n\nFix them all? (Already-blasted users will be re-queued.)`)) return
                const fixRes = await fetch('/api/admin/fix-email-typos', { method: 'POST' })
                const fixData = await parseResponse<any>(fixRes)
                alert(`Fixed ${fixData.fixed || 0} of ${fixData.targeted || 0}. Failed: ${fixData.failed || 0}${fixData.errors?.length ? '\n\n' + fixData.errors.slice(0, 5).join('\n') : ''}`)
              }}>⚠ Fix email typos</button>
              <button className={`${s.btn} ${s.btnGreen}`} onClick={async () => {
                if (!confirm('Pull Resend send history and mark users who already received the blast?')) return
                const res = await fetch('/api/admin/import-blast-history', { method: 'POST' })
                const d = await parseResponse<any>(res)
                alert(`Imported: marked ${d.marked || 0} users (found ${d.foundRecipients || 0} in Resend across ${d.pages || 0} pages). ${d.error ? '\nError: ' + d.error : ''}`)
              }}>⤓ Import blast history</button>
              <button className={`${s.btn} ${s.btnLav}`} onClick={async () => {
                if (!confirm('Send quiz-retake blast to all UNSENT users? (Idempotent — already-sent users skipped.)')) return
                const res = await fetch('/api/admin/send-quiz-blast', { method: 'POST' })
                const d = await parseResponse<any>(res)
                const note = d.remaining > 0 ? `\n\n${d.remaining} remaining. Click again to continue.` : ''
                alert(`Blast: sent ${d.sent || 0}, failed ${d.failed || 0}, candidates ${d.totalCandidates || 0}${note}`)
              }}>✨ Quiz-retake blast</button>
              <button className={`${s.btn} ${s.btnLav}`} onClick={async () => {
                window.open('/api/admin/send-love-relaunch?variant=ready', '_blank', 'noopener,noreferrer')
              }}>👀 Preview ready variant (no send)</button>
              <button className={`${s.btn} ${s.btnLav}`} onClick={async () => {
                window.open('/api/admin/send-love-relaunch?variant=profile', '_blank', 'noopener,noreferrer')
              }}>👀 Preview profile variant (no send)</button>
              <button className={`${s.btn} ${s.btnLav}`} onClick={async () => {
                window.open('/api/admin/send-love-relaunch?variant=live', '_blank', 'noopener,noreferrer')
              }}>👀 Preview live-match variant (no send)</button>
              <button className={`${s.btn} ${s.btnInk}`} onClick={async () => {
                setExperimentEmailDryRun(null)
                const dryRes = await fetch('/api/admin/send-love-relaunch?dry=1', { method: 'POST' })
                const dry = await parseResponse<any>(dryRes).catch(() => null)
                if (!dryRes.ok || !dry) { alert(`Dry run failed: ${dry?.error || dryRes.status}`); return }
                setExperimentEmailDryRun(dry)
              }}>📋 Experiment email audience (dry run)</button>
              <button className={`${s.btn} ${s.btnGold}`} onClick={async () => {
                const dryRes = await fetch('/api/admin/send-experiment-last-chance', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
                })
                const dry = await parseResponse<any>(dryRes).catch(() => null)
                if (!dryRes.ok || !dry) { alert(`Last-chance audit failed: ${dry?.error || dryRes.status}`); return }
                if (!confirm(`Send the approved last-chance email?\n\nRecipients now: ${dry.wouldSend} (approved maximum ${dry.expectedRecipients})\nSubject: ${dry.subject}\nBody: ${dry.body?.invitation}\nCTA: ${dry.body?.cta}`)) return
                const res = await fetch('/api/admin/send-experiment-last-chance', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ send: true, approvalVersion: dry.approvalVersion, recipientCount: dry.wouldSend }),
                })
                const result = await parseResponse<any>(res)
                alert(`Last chance: sent ${result.sent || 0}, failed ${result.failed || 0}, skipped after entry ${result.skippedEntered || 0}${result.error ? `\n\n${result.error}` : ''}`)
              }}>⏳ Send approved last-chance (max 3)</button>
              <button className={`${s.btn} ${s.btnGold}`} onClick={async () => {
                const dry = await fetch('/api/admin/send-friend-blast?dry=1', { method: 'POST' }).then(r => parseResponse<any>(r)).catch(() => null)
                const preview = dry ? `\n\n${dry.wouldSend} recipients (ALL users — links to /friends).` : ''
                if (!confirm(`Send the FRIEND LINE launch blast to all UNSENT users?${preview}\n\nIdempotent — already-sent users skipped.`)) return
                const res = await fetch('/api/admin/send-friend-blast', { method: 'POST' })
                const d = await parseResponse<any>(res)
                const note = d.remaining > 0 ? `\n\n${d.remaining} remaining. Click again to continue.` : ''
                alert(`Friend Line blast: sent ${d.sent || 0}, failed ${d.failed || 0}, candidates ${d.totalCandidates || 0}${note}${d.errors?.length ? '\n\n' + d.errors.slice(0,5).join('\n') : ''}`)
              }}>🟠 Friend Line launch blast</button>
              <button className={`${s.btn} ${s.btnInk}`} onClick={async () => {
                const dry = await fetch('/api/admin/send-press-invite?dry=1', { method: 'POST' }).then(r => parseResponse<any>(r)).catch(() => null)
                const preview = dry ? `\n\n${dry.wouldSend} recipients (people who left DATE feedback — optional, consent-based press story invite).` : ''
                if (!confirm(`Send the PRESS STORY invite to all UNSENT date-feedback users?${preview}\n\nIt only INVITES them to reply — signs nobody up. Idempotent — already-sent users skipped.`)) return
                const res = await fetch('/api/admin/send-press-invite', { method: 'POST' })
                const d = await parseResponse<any>(res)
                const note = d.remaining > 0 ? `\n\n${d.remaining} remaining. Click again to continue.` : ''
                alert(`Press invite: sent ${d.sent || 0}, failed ${d.failed || 0}, candidates ${d.totalCandidates || 0}${note}${d.errors?.length ? '\n\n' + d.errors.slice(0,5).join('\n') : ''}`)
              }}>📰 Press story invite</button>
            </div>
            {experimentEmailDryRun && (() => {
              const dry = experimentEmailDryRun
              const b = dry.breakdown || {}
              const links = dry.links || {}
              return (
                <div role="status" style={{ background: '#f4f8ff', border: '1px solid #b9cdfd', borderRadius: 12, padding: '1rem 1.1rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.65rem' }}>Dating Experiment email dry run — NOTHING SENT</div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.6, wordBreak: 'break-word' }}>
                    <b>Subject:</b> {dry.subject}<br />
                    <b>From:</b> {dry.sender}<br />
                    <b>Reply-to:</b> {dry.replyTo}<br />
                    <b>Send type:</b> {dry.sendType}<br /><br />
                    <b>Audience:</b> {dry.audienceDefinition}<br /><br />
                    <b>Current count:</b> {dry.wouldSend} would receive it · {dry.eligibleActiveBostonUsers} eligible Boston users ({dry.activeWindowDays}d activity) · {dry.excludedDormant || 0} dormant excluded · {dry.alreadySent} already handled<br />
                    <b>Variants:</b> {b.live || 0} live-match · {b.ready || 0} experiment-ready · {b.profile || 0} need profile work<br /><br />
                    <b>Ready CTA:</b> {links.primaryReady}<br />
                    <b>Incomplete-profile CTA:</b> {links.primaryNeedsProfile}<br />
                    <b>Incomplete-profile fix link:</b> {links.profileFix}<br />
                    <b>Love Line:</b> {links.loveLine}<br />
                    <b>FAQ:</b> {links.faq}<br />
                    <b>Rules:</b> {links.officialRules}<br />
                    <b>Unsubscribe:</b> {links.unsubscribe}<br /><br />
                    <b>Entries open:</b> {dry.entriesOpen ? 'yes' : 'no'} · <b>copy approval configured:</b> {dry.approvalConfigured ? 'yes' : 'no'} · <b>final send approval configured:</b> {dry.sendApprovalConfigured ? 'yes' : 'no'}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── SIGNUPS CHART ── */}
          <div className={s.card} id="signups">
            <div className={s.cardHead}><p className={s.cardTitle}>Signups — <b>last 7 days</b></p></div>
            <div className={s.bars}>
              {Object.entries(days).map(([day, count]) => {
                const max = Math.max(...Object.values(days) as number[], 1)
                const pct = ((count as number) / max) * 100
                return (
                  <div key={day} className={s.barCol}>
                    <div className={s.barNum}>{count as number}</div>
                    <div className={s.barFill} style={{ height: `${Math.max(pct, 4)}%` }} />
                    <div className={s.barDay}>{day.slice(5)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RECENT SIGNUPS ── */}
          <div className={s.card}>
            <div className={s.cardHead}><p className={s.cardTitle}>Recent signups</p></div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>{['Name', 'Email', 'Gender', 'Seeking', 'ZIP', 'Status', 'Signed up'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data?.recentUsers?.map((u: any, i: number) => (
                    <tr key={i}>
                      <td className={s.tName}>{u.name}</td>
                      <td className={s.tMuted}>{u.email}</td>
                      <td className={s.tMuted}>{u.gender === 'm' ? '♂' : u.gender === 'f' ? '♀' : '⚡'}</td>
                      <td className={s.tMuted}>{u.seeking === 'm' ? '♂' : u.seeking === 'f' ? '♀' : '⚡'}</td>
                      <td className={s.tMuted}>{u.zip}</td>
                      <td><span className={s.badge} style={{ background: u.status === 'matched' ? '#e8edff' : '#f0ede6', color: u.status === 'matched' ? '#1b46c9' : '#7a7590' }}>{u.status}</span></td>
                      <td className={s.tFaint}>{u.created_at?.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── RECENT MATCHES ── */}
          <div className={s.card} id="matches">
            <div className={s.cardHead}><p className={s.cardTitle}>Recent matches</p></div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>{['Score', 'Status', 'User 1', 'User 2', 'Created'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data?.recentMatches?.map((m: any, i: number) => (
                    <tr key={i}>
                      <td className={s.tScore}>{m.score}%</td>
                      <td>
                        <span className={s.badge} style={{
                          background: m.status === 'both_accepted' ? '#d4edda' : m.status === 'passed' ? '#f8d7da' : '#e8edff',
                          color: m.status === 'both_accepted' ? '#155724' : m.status === 'passed' ? '#721c24' : '#1b46c9',
                        }}>{m.status}</span>
                      </td>
                      <td style={{ color: m.user1_accepted ? '#2d7a4f' : '#c8c4dc' }}>{m.user1_accepted ? '✓ yes' : '– pending'}</td>
                      <td style={{ color: m.user2_accepted ? '#2d7a4f' : '#c8c4dc' }}>{m.user2_accepted ? '✓ yes' : '– pending'}</td>
                      <td className={s.tFaint}>{m.created_at?.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── DATE FEEDBACK ── */}
          <div className={s.card} id="feedback">
            <div className={s.cardHead}><p className={s.cardTitle}>Date feedback</p></div>

            {feedback?.stats && feedback.stats.total > 0 && (
              <div className={s.kpis} style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                {([
                  ['Responses', feedback.stats.total, '📝'],
                  ['Avg rating', feedback.stats.avgRating != null ? `${feedback.stats.avgRating} / 5` : '—', '⭐'],
                  ['Would do again', feedback.stats.wouldAgainPct != null ? `${feedback.stats.wouldAgainPct}%` : '—', '🔁'],
                  ['Yes / No', `${feedback.stats.wouldAgainYes} / ${feedback.stats.wouldAgainNo}`, '⚖️'],
                ] as Array<[string, any, string]>).map(([label, val, icon]) => (
                  <div key={label} className={s.kpi}>
                    <div className={s.kpiIcon}>{icon}</div>
                    <div className={s.kpiVal} style={{ fontSize: '1.6rem' }}>{val}</div>
                    <div className={s.kpiLabel}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {!feedback && <p className={s.note}>loading…</p>}
            {feedback?.__error && <p className={s.noteErr}>couldn’t load: {feedback.__error}</p>}
            {feedback && !feedback.__error && feedback.items?.length === 0 && <p className={s.note}>no date feedback yet</p>}

            {feedback?.items?.length > 0 && (
              <div className={s.tableWrap} style={{ marginTop: '1rem' }}>
                <table className={s.table}>
                  <thead>
                    <tr>{['Rating', 'Again?', 'Reviewer', 'About', 'Notes', 'Match %', 'Submitted'].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {feedback.items.map((f: any) => (
                      <tr key={f.id}>
                        <td style={{ color: '#d2530f', fontWeight: 700, whiteSpace: 'nowrap' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                        <td>
                          {f.would_again === true && <span className={s.badge} style={{ background: '#d4edda', color: '#155724' }}>yes</span>}
                          {f.would_again === false && <span className={s.badge} style={{ background: '#f8d7da', color: '#721c24' }}>no</span>}
                          {f.would_again == null && <span className={s.tFaint}>—</span>}
                        </td>
                        <td className={s.tName}>{f.reviewer?.name || '—'}{f.reviewer?.email && <div className={s.tMuted} style={{ fontSize: '.55rem', fontWeight: 400 }}>{f.reviewer.email}</div>}</td>
                        <td className={s.tName} style={{ fontWeight: 400 }}>{f.rated_user?.name || '—'}{f.rated_user?.email && <div className={s.tMuted} style={{ fontSize: '.55rem' }}>{f.rated_user.email}</div>}</td>
                        <td style={{ color: '#0e0c1a', maxWidth: 320, whiteSpace: 'normal', fontStyle: f.notes ? 'italic' : 'normal' }}>{f.notes ? `"${f.notes}"` : <span className={s.tFaint} style={{ fontStyle: 'normal' }}>—</span>}</td>
                        <td className={s.tScore} style={{ whiteSpace: 'nowrap' }}>{f.match?.score != null ? `${f.match.score}%` : '—'}</td>
                        <td className={s.tFaint} style={{ whiteSpace: 'nowrap' }}>{f.created_at?.split('T')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── APP FEEDBACK ── */}
          <div className={s.card} id="app-feedback">
            <div className={s.cardHead}><p className={s.cardTitle}>App feedback — <b>what users are telling you</b></p></div>

            {!appFeedback && <p className={s.note}>loading…</p>}
            {appFeedback?.__error && <p className={s.noteErr}>couldn’t load: {appFeedback.__error}</p>}
            {appFeedback && !appFeedback.__error && appFeedback.items?.length === 0 && <p className={s.note}>no feedback yet</p>}

            {appFeedback?.items?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {appFeedback.items.map((f: any) => (
                  <div key={f.id} style={{ background: '#f8f5ff', border: '1px solid rgba(14,12,26,0.06)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.9rem', color: '#0e0c1a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.body}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.08em', color: '#7a7590', textTransform: 'uppercase' }}>
                        {f.user ? `${f.user.name || 'user'} · ${f.user.email}` : 'anonymous'} · {f.created_at?.split('T')[0]}
                      </div>
                      {f.replied_at ? (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.08em', color: '#3a7a4f', textTransform: 'uppercase' }}>✓ replied {f.replied_at?.split('T')[0]}</span>
                      ) : f.user ? (
                        <button onClick={() => { setReplyOpen(replyOpen === f.id ? null : f.id); setReplyText('') }} style={{ background: '#0e0c1a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {replyOpen === f.id ? 'cancel' : '↩ reply'}
                        </button>
                      ) : (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', color: '#c8c4dc', textTransform: 'uppercase' }}>anonymous · no reply</span>
                      )}
                    </div>

                    {f.replied_at && f.reply_body && (
                      <div style={{ marginTop: '0.5rem', paddingLeft: '0.7rem', borderLeft: '2px solid #2563ff', fontFamily: 'Georgia, serif', fontSize: '0.82rem', color: '#1b46c9', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.reply_body}</div>
                    )}

                    {replyOpen === f.id && (
                      <div style={{ marginTop: '0.6rem' }}>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={3}
                          placeholder={`reply to ${f.user?.name || 'them'} — emails them directly`}
                          style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(14,12,26,0.15)', padding: '0.55rem 0.7rem', fontFamily: 'system-ui, sans-serif', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }}
                        />
                        <button onClick={() => sendFeedbackReply(f.id)} disabled={!replyText.trim() || replyBusy} style={{ marginTop: '0.4rem', background: '#2563ff', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: replyText.trim() && !replyBusy ? 'pointer' : 'not-allowed', opacity: replyText.trim() && !replyBusy ? 1 : 0.5 }}>
                          {replyBusy ? 'sending…' : 'send reply email →'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── REPORTS / MODERATION ── */}
          <div className={s.card} id="reports">
            <div className={s.cardHead}><p className={s.cardTitle}>Reports — <b>safety moderation</b></p></div>
            {!reports && <p className={s.note}>loading…</p>}
            {reports?.__error && <p className={s.noteErr}>couldn’t load: {reports.__error}</p>}
            {reports && !reports.__error && reports.items?.length === 0 && <p className={s.note}>no reports — clean so far ✓</p>}
            {reports?.items?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {reports.items.map((r: any) => (
                  <div key={r.id} style={{ background: '#fff1e8', border: '1px solid rgba(210,83,15,0.25)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: '#0e0c1a', fontWeight: 600, textTransform: 'capitalize' }}>
                        {(r.reason || '').replace(/_/g, ' ')}
                        {r.reported?.reportCount > 1 && <span style={{ color: '#c0392b', marginLeft: 6 }}>×{r.reported.reportCount}</span>}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', color: '#7a7590' }}>{r.created_at?.split('T')[0]}</div>
                    </div>
                    {r.detail && <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#0e0c1a', margin: '0.4rem 0', lineHeight: 1.5 }}>“{r.detail}”</div>}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', color: '#7a7590', marginTop: '0.4rem' }}>
                      <strong style={{ color: '#c0392b' }}>reported:</strong> {r.reported?.name || '—'} ({r.reported?.email || '—'}){r.reported?.is_blocked ? ' · BLOCKED' : ''}
                      {'  ·  '}<strong>by:</strong> {r.reporter?.name || '—'}
                    </div>
                    {r.reported && (
                      <button
                        onClick={() => moderate(r.reported.id, r.reported.is_blocked ? 'unblock' : 'block')}
                        style={{ marginTop: '0.5rem', background: r.reported.is_blocked ? 'transparent' : '#c0392b', color: r.reported.is_blocked ? '#7a7590' : '#fff', border: r.reported.is_blocked ? '1px solid rgba(14,12,26,0.13)' : 'none', borderRadius: 8, padding: '0.4rem 0.8rem', fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        {r.reported.is_blocked ? 'unblock' : 'block user'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── LIVE EVENTS QUEUE ── */}
          <div className={s.card} id="events">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Live events queue — <b>what users will see</b></p>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={refreshLiveEvents}>refresh</button>
            </div>

            {!liveEvents && <p className={s.note}>loading…</p>}
            {liveEvents?.__error && <p className={s.noteErr}>couldn’t load: {liveEvents.__error}</p>}

            {liveEvents && !liveEvents.__error && (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Ticketmaster <b>{liveEvents.counts?.ticketmaster ?? 0}</b></span>
                  <span className={s.chip}>Yelp <b>{liveEvents.counts?.yelp ?? 0}</b></span>
                  <span className={s.chip}>Boston Calendar <b>{liveEvents.counts?.['boston-calendar'] ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Hidden <b>{liveEvents.blacklist?.length ?? 0}</b></span>
                </div>

                {Object.entries(liveEvents.grouped || {}).map(([source, items]: any) => (
                  items.length > 0 && (
                    <div key={source} style={{ marginBottom: '1.25rem' }}>
                      <div className={s.sourceLabel}>{source} ({items.length})</div>
                      {items.map((it: any) => (
                        <div key={it.id} className={s.eventRow}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.imageUrl && <img src={it.imageUrl} alt="" className={s.eventImg} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={s.eventTitle}>{it.title}</div>
                            <div className={s.eventMeta}>{[it.category, it.venue, it.whenLabel].filter(Boolean).join(' · ')}</div>
                          </div>
                          <div className={s.eventRight}>
                            {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" className={s.eventLink}>view ↗</a>}
                            <button className={`${s.btn} ${s.btnTiny} ${s.btnHide}`} onClick={() => hideEvent(it.id)}>hide</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ))}

                {liveEvents.blacklist?.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(14,12,26,0.08)' }}>
                    <div className={`${s.penaltyKind} ${s.penaltyKindRed}`}>hidden ({liveEvents.blacklist.length})</div>
                    {liveEvents.blacklist.map((b: any) => (
                      <div key={b.activity_id} className={`${s.penaltyRow} ${s.penaltyRowRed}`}>
                        <span className={s.penaltyName} style={{ fontFamily: 'monospace', fontSize: '.6rem' }}>{b.activity_id}</span>
                        <button className={`${s.btn} ${s.btnTiny} ${s.btnGhost}`} onClick={() => unhideEvent(b.activity_id)}>unhide</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {seedAccounts && (
        <div
          onClick={() => setSeedAccounts(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(14,12,26,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 680, boxShadow: '0 24px 60px -20px rgba(14,12,26,0.5)' }}>
            <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.4rem', margin: '0 0 0.4rem' }}>Test accounts ready</h2>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.85rem', color: '#6b6975', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Open each link in a <b>separate incognito window</b>, then have one pick the other to test the full match → chat flow.
            </p>
            {seedAccounts.map((a) => (
              <div key={a.email} style={{ marginBottom: '1.1rem' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1b46c9', marginBottom: '0.35rem' }}>
                  {a.name} · {a.email}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <input
                    readOnly
                    value={a.loginUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{ flex: 1, fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', padding: '0.6rem 0.7rem', border: '1px solid #e5e1ec', borderRadius: 8, background: '#f8f7fb', color: '#0e0c1a', overflow: 'hidden' }}
                  />
                  <button
                    onClick={() => navigator.clipboard?.writeText(a.loginUrl)}
                    style={{ background: '#0b0b0b', color: '#fff', border: 'none', borderRadius: 8, padding: '0 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >copy</button>
                  <a
                    href={a.loginUrl} target="_blank" rel="noopener noreferrer"
                    style={{ background: '#2563ff', color: '#fff', borderRadius: 8, padding: '0.6rem 0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  >open ↗</a>
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
              <button onClick={() => setSeedAccounts(null)} style={{ background: 'none', border: '1px solid #e5e1ec', borderRadius: 999, padding: '0.55rem 1.25rem', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', color: '#6b6975' }}>close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Color the conversion metric: green healthy, gold so-so, red poor.
function convColor(pct: number | null | undefined): string {
  if (pct == null) return '#0e0c1a'
  if (pct >= 50) return '#2d7a4f'
  if (pct >= 30) return '#d2530f'
  return '#d94f3d'
}

// ── Heatmap sub-component ──────────────────────────────────────────
function PoolHeatmap({ pools }: { pools: any }) {
  const intents: string[] = pools.intents || []
  const tiers: string[] = pools.tiers || []

  // Max cell value for color scaling.
  let max = 1
  for (const intent of intents) {
    for (const t of tiers) {
      const v = pools.grid?.[intent]?.[t] || 0
      if (v > max) max = v
    }
  }

  const cellStyle = (count: number) => {
    if (count === 0) return { background: '#fafafa', color: '#c8c4dc', borderColor: 'rgba(14,12,26,0.05)' }
    const t = count / max
    const op = 0.14 + t * 0.76
    return {
      background: `rgba(37,99,255,${op.toFixed(2)})`,
      color: t > 0.5 ? '#fff' : '#0e0c1a',
      borderColor: 'rgba(37,99,255,0.25)',
    }
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.heat}>
        <thead>
          <tr>
            <th className={s.heatCorner}>intent ↓ / tier →</th>
            {tiers.map((t) => <th key={t} className={s.heatColHead}>{t}</th>)}
            <th className={s.heatColHead}>total</th>
          </tr>
        </thead>
        <tbody>
          {intents.map((intent) => {
            const row = pools.grid?.[intent] || {}
            const rowTotal = tiers.reduce((sum, t) => sum + (row[t] || 0), 0)
            return (
              <tr key={intent}>
                <td className={s.heatRowHead}>{intent}</td>
                {tiers.map((t) => {
                  const count = row[t] || 0
                  return <td key={t} className={s.heatCell} style={cellStyle(count)}>{count}</td>
                })}
                <td className={s.heatTotal}>{rowTotal}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
