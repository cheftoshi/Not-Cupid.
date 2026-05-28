'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import CorpFooter from '@/components/corp-footer'

export default function AdminClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin-stats')
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f5ff'}}>
      <p style={{fontFamily:'DM Mono,monospace',fontSize:'.75rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#7a7590'}}>Loading dashboard...</p>
    </div>
  )

  if (error) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f5ff'}}>
      <p style={{fontFamily:'DM Mono,monospace',fontSize:'.75rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#d94f3d'}}>Error: {error}</p>
    </div>
  )

  const s = data?.stats
  const days = data?.signupsPerDay ?? {}

  return (
    <>
      <Nav />
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'7rem 1.5rem 4rem'}}>

        <div style={{marginBottom:'2rem'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.2em',textTransform:'uppercase',color:'#8b7fd4',marginBottom:'.5rem'}}>Admin · NotCupid</p>
          <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'3rem',color:'#0e0c1a',lineHeight:.9}}>MISSION CONTROL</h1>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'rgba(14,12,26,0.1)',border:'1px solid rgba(14,12,26,0.1)',marginBottom:'1.5rem'}}>
          {([
            ['Total Users', s?.totalUsers, '👥', null],
            ['Total Matches', s?.totalMatches, '💘', null],
            ['Revenue', `$${s?.totalRevenue}`, '💰', null],
            ['Both Accepted', s?.bothAccepted, '✅', null],
            ['Pending', s?.pendingMatches, '⏳', null],
            ['Passed', s?.passed, '👋', s?.passRate !== null && s?.passRate !== undefined ? `${s.passRate}% pass rate` : null],
            ['Waiting', s?.waiting, '👀', null],
            ['M / F / Bi', `${s?.men} / ${s?.women} / ${s?.bi}`, '⚖️', null],
          ] as Array<[string, any, string, string | null]>).map(([label, val, icon, sub]) => (
            <div key={label} style={{background:'#fff',padding:'1.25rem',textAlign:'center'}}>
              <div style={{fontSize:'1.5rem',marginBottom:'.25rem'}}>{icon}</div>
              <div style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'2rem',color:'#0e0c1a',lineHeight:1}}>{val}</div>
              <div style={{fontFamily:'DM Mono,monospace',fontSize:'.48rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#7a7590',marginTop:'.25rem'}}>{label}</div>
              {sub && (
                <div style={{fontFamily:'DM Mono,monospace',fontSize:'.45rem',letterSpacing:'.08em',textTransform:'uppercase',color:'#8b7fd4',marginTop:'.15rem'}}>{sub}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'1px solid rgba(14,12,26,0.1)',padding:'1.5rem',marginBottom:'1.5rem'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#0e0c1a',marginBottom:'1.25rem',fontWeight:500}}>Signups — last 7 days</p>
          <div style={{display:'flex',gap:'8px',alignItems:'flex-end',height:'80px'}}>
            {Object.entries(days).map(([day, count]) => {
              const max = Math.max(...Object.values(days) as number[], 1)
              const pct = ((count as number) / max) * 100
              return (
                <div key={day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:'.5rem',color:'#7a7590'}}>{count as number}</div>
                  <div style={{width:'100%',background:'#8b7fd4',height:`${Math.max(pct,4)}%`,minHeight:'4px',borderRadius:'2px 2px 0 0'}} />
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:'.42rem',color:'#c8c4dc',textAlign:'center'}}>{day.slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'.75rem'}}>
          <a href="/api/admin/send-pending-matches" target="_blank" style={{display:'block',background:'#0e0c1a',color:'#f8f5ff',padding:'1rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',textDecoration:'none',textAlign:'center'}}>
            📨 Send pending match emails
          </a>
          <a href="/api/cron/rematch" target="_blank" style={{display:'block',background:'#5b4fa0',color:'#f8f5ff',padding:'1rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',textDecoration:'none',textAlign:'center'}}>
            🔄 Run rematch cron
          </a>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem',marginBottom:'1.5rem'}}>
          <button
            onClick={async () => {
              const res = await fetch('/api/admin/fix-email-typos')
              const data = await res.json()
              if ((data.count || 0) === 0) { alert('No typo\'d emails found. ✓'); return }
              const sample = (data.candidates || []).slice(0, 6).map((c: any) => `  ${c.email} → ${c.suggestion}`).join('\n')
              if (!confirm(`Found ${data.count} typo'd emails:\n\n${sample}${data.count > 6 ? `\n  …and ${data.count - 6} more` : ''}\n\nFix them all? (Already-blasted users will be re-queued.)`)) return
              const fixRes = await fetch('/api/admin/fix-email-typos', { method: 'POST' })
              const fixData = await fixRes.json()
              alert(`Fixed ${fixData.fixed || 0} of ${fixData.targeted || 0}. Failed: ${fixData.failed || 0}${fixData.errors?.length ? '\n\n' + fixData.errors.slice(0,5).join('\n') : ''}`)
            }}
            style={{display:'block',background:'#c39418',color:'#fff',padding:'1rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',border:'none',cursor:'pointer',textAlign:'center'}}>
            ⚠ Fix email typos
          </button>
          <button
            onClick={async () => {
              if (!confirm('Pull Resend send history and mark users who already received the blast?')) return
              const res = await fetch('/api/admin/import-blast-history', { method: 'POST' })
              const data = await res.json()
              alert(`Imported: marked ${data.marked || 0} users (found ${data.foundRecipients || 0} in Resend across ${data.pages || 0} pages). ${data.error ? '\nError: ' + data.error : ''}`)
            }}
            style={{display:'block',background:'#3a7a4f',color:'#fff',padding:'1rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',border:'none',cursor:'pointer',textAlign:'center'}}>
            ⤓ Import blast history from Resend
          </button>
          <button
            onClick={async () => {
              if (!confirm('Send quiz-retake blast to all UNSENT users? (Idempotent — already-sent users skipped.)')) return
              const res = await fetch('/api/admin/send-quiz-blast', { method: 'POST' })
              const data = await res.json()
              const note = data.remaining > 0
                ? `\n\n${data.remaining} remaining. Click again to continue.`
                : ''
              alert(`Blast: sent ${data.sent || 0}, failed ${data.failed || 0}, candidates ${data.totalCandidates || 0}${note}`)
            }}
            style={{display:'block',background:'#8b7fd4',color:'#fff',padding:'1rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',border:'none',cursor:'pointer',textAlign:'center'}}>
            ✨ Send quiz-retake blast (unsent only)
          </button>
        </div>

        <div style={{background:'#fff',border:'1px solid rgba(14,12,26,0.1)',padding:'1.5rem',marginBottom:'1.5rem'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#0e0c1a',marginBottom:'1rem',fontWeight:500}}>Recent signups</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.7rem',fontFamily:'DM Mono,monospace'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(14,12,26,0.1)'}}>
                  {['Name','Email','Gender','Seeking','ZIP','Status','Signed up'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'.5rem .75rem',color:'#7a7590',letterSpacing:'.08em',textTransform:'uppercase',fontSize:'.48rem',fontWeight:400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.recentUsers?.map((u: any, i: number) => (
                  <tr key={i} style={{borderBottom:'1px solid rgba(14,12,26,0.05)'}}>
                    <td style={{padding:'.5rem .75rem',color:'#0e0c1a',fontWeight:500}}>{u.name}</td>
                    <td style={{padding:'.5rem .75rem',color:'#7a7590'}}>{u.email}</td>
                    <td style={{padding:'.5rem .75rem',color:'#7a7590'}}>{u.gender === 'm' ? '♂' : u.gender === 'f' ? '♀' : '⚡'}</td>
                    <td style={{padding:'.5rem .75rem',color:'#7a7590'}}>{u.seeking === 'm' ? '♂' : u.seeking === 'f' ? '♀' : '⚡'}</td>
                    <td style={{padding:'.5rem .75rem',color:'#7a7590'}}>{u.zip}</td>
                    <td style={{padding:'.5rem .75rem'}}>
                      <span style={{background:u.status==='matched'?'#ede9ff':'#f0ede6',color:u.status==='matched'?'#5b4fa0':'#7a7590',padding:'.2rem .5rem',fontSize:'.48rem',letterSpacing:'.08em',textTransform:'uppercase'}}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{padding:'.5rem .75rem',color:'#c8c4dc'}}>{u.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{background:'#fff',border:'1px solid rgba(14,12,26,0.1)',padding:'1.5rem'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#0e0c1a',marginBottom:'1rem',fontWeight:500}}>Recent matches</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.7rem',fontFamily:'DM Mono,monospace'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(14,12,26,0.1)'}}>
                  {['Score','Status','User 1','User 2','Created'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'.5rem .75rem',color:'#7a7590',letterSpacing:'.08em',textTransform:'uppercase',fontSize:'.48rem',fontWeight:400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.recentMatches?.map((m: any, i: number) => (
                  <tr key={i} style={{borderBottom:'1px solid rgba(14,12,26,0.05)'}}>
                    <td style={{padding:'.5rem .75rem',color:'#8b7fd4',fontWeight:700}}>{m.score}%</td>
                    <td style={{padding:'.5rem .75rem'}}>
                      <span style={{
                        background:m.status==='both_accepted'?'#d4edda':m.status==='passed'?'#f8d7da':'#ede9ff',
                        color:m.status==='both_accepted'?'#155724':m.status==='passed'?'#721c24':'#5b4fa0',
                        padding:'.2rem .5rem',fontSize:'.48rem',letterSpacing:'.08em',textTransform:'uppercase'
                      }}>{m.status}</span>
                    </td>
                    <td style={{padding:'.5rem .75rem',color:m.user1_accepted?'#2d7a4f':'#c8c4dc'}}>{m.user1_accepted?'✓ yes':'– pending'}</td>
                    <td style={{padding:'.5rem .75rem',color:m.user2_accepted?'#2d7a4f':'#c8c4dc'}}>{m.user2_accepted?'✓ yes':'– pending'}</td>
                    <td style={{padding:'.5rem .75rem',color:'#c8c4dc'}}>{m.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <CorpFooter />
    </>
  )
}
