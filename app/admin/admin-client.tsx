'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import CorpFooter from '@/components/corp-footer'
import { parseResponse } from '@/lib/fetch-helpers'
import s from './admin.module.css'

export default function AdminClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<any>(null)
  const [liveEvents, setLiveEvents] = useState<any>(null)
  const [pools, setPools] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [appFeedback, setAppFeedback] = useState<any>(null)
  const [reports, setReports] = useState<any>(null)
  const [waveBusy, setWaveBusy] = useState(false)

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

    fetch('/api/admin/feedback')
      .then(async (r) => {
        if (!r.ok) {
          const body = await parseResponse<any>(r).catch(() => ({}))
          return { __error: body?.error || `HTTP ${r.status}`, items: [] }
        }
        return parseResponse<any>(r)
      })
      .then(setAppFeedback)
      .catch((e) => setAppFeedback({ __error: e?.message || 'network error', items: [] }))
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

  async function runWave() {
    if (!confirm('Run a full pool rotation now? This ejects inactive users, releases expired cooldowns, wakes the next wave, and re-matches eligible users.')) return
    setWaveBusy(true)
    try {
      const r = await fetch('/api/cron/rematch')
      const j = await parseResponse<any>(r)
      alert(
        r.ok
          ? `Pool rotation done.\n\nWoke: ${j.poolWaked ?? 0}\nEjected: ${j.poolEjected ?? 0}\nCooldowns released: ${j.cooldownReleased ?? 0}\nRematched: ${j.rematched ?? 0}`
          : `Failed: ${j.error || r.status}`
      )
      refreshPools()
    } catch (e: any) {
      alert(`Failed: ${e?.message || 'error'}`)
    } finally {
      setWaveBusy(false)
    }
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

          {/* KPI row */}
          <div className={s.kpis}>
            {([
              ['Total Users', stats?.totalUsers, '👥', null],
              ['Total Matches', stats?.totalMatches, '💘', null],
              ['Revenue', `$${stats?.totalRevenue}`, '💰', null],
              ['Both Accepted', stats?.bothAccepted, '✅', null],
              ['Pending', stats?.pendingMatches, '⏳', null],
              ['Passed', stats?.passed, '👋', stats?.passRate != null ? `${stats.passRate}% pass rate` : null],
              ['Waiting', stats?.waiting, '👀', null],
              ['M / F / Bi', `${stats?.men} / ${stats?.women} / ${stats?.bi}`, '⚖️', null],
            ] as Array<[string, any, string, string | null]>).map(([label, val, icon, sub]) => (
              <div key={label} className={s.kpi}>
                <div className={s.kpiIcon}>{icon}</div>
                <div className={s.kpiVal}>{val}</div>
                <div className={s.kpiLabel}>{label}</div>
                {sub && <div className={s.kpiSub}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* ── DATING POOL ── */}
          <div className={s.card} id="pool">
            <div className={s.cardHead}>
              <p className={s.cardTitle}>Dating pool — <b>live segments</b></p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className={`${s.btn} ${s.btnGhost}`} onClick={refreshPools}>refresh</button>
                <button className={`${s.btn} ${s.btnDeep}`} onClick={runWave} disabled={waveBusy}>
                  {waveBusy ? 'running…' : '🔄 run pool rotation'}
                </button>
              </div>
            </div>

            {!pools && <p className={s.note}>loading…</p>}
            {pools?.__error && <p className={s.noteErr}>couldn’t load: {pools.__error}</p>}

            {pools && !pools.__error && (
              <>
                <div className={s.chips}>
                  <span className={s.chip}>Active <b>{pools.summary?.active ?? 0}</b></span>
                  <span className={s.chip}>In a match <b>{pools.summary?.matched ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Cooldown <b>{pools.summary?.cooldown ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Banned <b>{pools.summary?.banned ?? 0}</b></span>
                </div>

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
                </div>

                {/* outcome breakdown */}
                <div className={s.chips} style={{ marginTop: '1rem' }}>
                  <span className={s.chip}>Created <b>{health.conversion?.created ?? 0}</b></span>
                  <span className={s.chip}>Both accepted <b>{health.conversion?.bothAccepted ?? 0}</b></span>
                  <span className={s.chip}>Pending <b>{health.conversion?.pending ?? 0}</b></span>
                  <span className={s.chip}>Passed <b>{health.conversion?.passed ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipGold}`}>Expired <b>{health.conversion?.expired ?? 0}</b></span>
                  <span className={`${s.chip} ${s.chipRed}`}>Ghosted <b>{health.conversion?.ghosted ?? 0}</b></span>
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

          {/* ── OPS ── */}
          <div id="ops">
            <div className={`${s.actionsGrid} ${s.actions2}`} style={{ marginBottom: '0.75rem' }}>
              <a href="/api/admin/send-pending-matches" target="_blank" className={`${s.btn} ${s.btnInk}`}>📨 Send pending match emails</a>
              <a href="/api/cron/rematch" target="_blank" className={`${s.btn} ${s.btnDeep}`}>🔄 Run rematch cron (raw)</a>
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
              <button className={`${s.btn} ${s.btnInk}`} onClick={async () => {
                const dry = await fetch('/api/admin/send-relaunch-blast?dry=1', { method: 'POST' }).then(r => parseResponse<any>(r)).catch(() => null)
                const preview = dry ? `\n\n${dry.wouldSend} recipients (${dry.withLiveMatch} have a live match → "see your match", rest → "retake quiz").` : ''
                if (!confirm(`Send the matching-RELAUNCH blast to all UNSENT users?${preview}\n\nIdempotent — already-sent users skipped.`)) return
                const res = await fetch('/api/admin/send-relaunch-blast', { method: 'POST' })
                const d = await parseResponse<any>(res)
                const note = d.remaining > 0 ? `\n\n${d.remaining} remaining. Click again to continue.` : ''
                alert(`Relaunch blast: sent ${d.sent || 0}, failed ${d.failed || 0}, candidates ${d.totalCandidates || 0}${note}${d.errors?.length ? '\n\n' + d.errors.slice(0,5).join('\n') : ''}`)
              }}>📣 Relaunch blast (pick-from-5)</button>
            </div>
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
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.08em', color: '#7a7590', marginTop: '0.5rem', textTransform: 'uppercase' }}>
                      {f.user ? `${f.user.name || 'user'} · ${f.user.email}` : 'anonymous'} · {f.created_at?.split('T')[0]}
                    </div>
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
      <CorpFooter />
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
