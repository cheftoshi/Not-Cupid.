'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'

interface UserData {
  id: string
  name: string
  archetype: string
  score_honesty: number
  score_emotionality: number
  score_extraversion: number
  score_agreeableness: number
  score_conscientiousness: number
  score_openness: number
  status: string
  hexaco_unlocked: boolean
  email: string
  auto_rematch: boolean
}

interface MatchData {
  compatibility_score: number
  match_name: string
  status: string
}

function DashboardContent() {
  const params = useSearchParams()
  const userId = params.get('id')
  const [user, setUser] = useState<UserData | null>(null)
  const [match, setMatch] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetch(`/api/dashboard?id=${userId}`)
      .then(r => r.json())
      .then(data => {
        setUser(data.user)
        setMatch(data.match)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId])

  const MAX = 12
  const dims = user ? [
    { name: 'Honesty', val: user.score_honesty },
    { name: 'Openness', val: user.score_openness },
    { name: 'Emotionality', val: user.score_emotionality },
    { name: 'Extraversion', val: user.score_extraversion },
    { name: 'Agreeableness', val: user.score_agreeableness },
    { name: 'Conscientiousness', val: user.score_conscientiousness },
  ] : []

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <p style={{fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--ink2)'}}>
        loading your profile...
      </p>
    </div>
  )

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'3rem',color:'var(--ink)',marginBottom:'1rem'}}>Profile not found.</h1>
      <a href="/quiz" style={{fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--lav)'}}>Take the quiz →</a>
    </div>
  )

  return (
    <div style={{maxWidth:'580px',margin:'0 auto',padding:'7rem 1.5rem 4rem'}}>

      <div style={{marginBottom:'2rem'}}>
        <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--lav)',marginBottom:'.75rem'}}>
          your profile · {user.name}
        </p>
        <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,7vw,4.5rem)',lineHeight:.88,color:'var(--ink)',marginBottom:'.5rem'}}>
          YOU ARE<br/><span style={{color:'var(--lav)'}}>{user.archetype?.toUpperCase()}.</span>
        </h1>
      </div>

      <div style={{
        background: match ? 'var(--lav-pale)' : '#f0ede6',
        border: `1.5px solid ${match ? 'var(--lav)' : 'var(--border-md)'}`,
        padding:'1.5rem',marginBottom:'1.25rem'
      }}>
        {match ? (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--lav)',marginBottom:'.5rem'}}>
              ✦ you matched
            </p>
            <h2 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'1.8rem',color:'var(--ink)',marginBottom:'.5rem'}}>
              {match.match_name} · {match.compatibility_score}% compatible
            </h2>
            <p style={{fontSize:'.82rem',color:'var(--ink2)',lineHeight:1.65}}>
              Check your email — we sent both of you the details and a Boston spot to meet at. The algo has spoken.
            </p>
          </>
        ) : (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--ink2)',marginBottom:'.5rem'}}>
              pool status: active 👀
            </p>
            <h2 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'1.8rem',color:'var(--ink)',marginBottom:'.5rem'}}>
              The algo is watching.
            </h2>
            <p style={{fontSize:'.82rem',color:'var(--ink2)',lineHeight:1.65}}>
              You're in the pool. The second someone compatible signs up, you'll both get an email. One match. Show up.
            </p>
          </>
        )}
      </div>

      <div style={{background:'#fff',border:'1.5px solid var(--border-md)',padding:'1.5rem',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
          <span style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--ink)',fontWeight:500}}>
            Your HEXACO Profile
          </span>
          <span style={{fontFamily:'DM Mono,monospace',fontSize:'.52rem',letterSpacing:'.08em',color:'var(--ink3)',textTransform:'uppercase'}}>
            {user.hexaco_unlocked ? '✓ unlocked' : '🔒 $0.99 to unlock'}
          </span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'.9rem'}}>
          {dims.map((d, i) => {
            const pct = Math.round((d.val / MAX) * 100)
            const locked = !user.hexaco_unlocked && i > 1
            return (
              <div key={d.name} style={{display:'flex',alignItems:'center',gap:'.85rem',filter:locked?'blur(4px)':'none'}}>
                <span style={{fontFamily:'DM Mono,monospace',fontSize:'.5rem',letterSpacing:'.07em',textTransform:'uppercase',color:'var(--ink2)',width:'120px',flexShrink:0}}>
                  {d.name}
                </span>
                <div style={{flex:1,height:'2px',background:'rgba(14,12,26,0.13)'}}>
                  <div style={{height:'100%',background:'var(--lav)',width:`${pct}%`}} />
                </div>
                <span style={{fontFamily:'DM Mono,monospace',fontSize:'.52rem',color:'var(--ink2)',width:'30px',textAlign:'right'}}>
                  {locked ? '??' : `${pct}%`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {!user.hexaco_unlocked && (
        <div style={{background:'rgba(139,127,212,0.07)',border:'1.5px solid var(--lav)',padding:'1.25rem 1.5rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:'1.25rem'}}>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'2rem',color:'var(--lav)',lineHeight:1,marginBottom:'.3rem'}}>$0.99</div>
            <p style={{fontSize:'.78rem',color:'var(--ink2)',lineHeight:1.55}}>Full breakdown. All 6 scores. Why you matched who you matched.</p>
          </div>
          <button
            onClick={async () => {
              const res = await fetch('/api/stripe-checkout', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ userId: user.id, email: user.email })
              })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }}
            style={{background:'var(--ink)',color:'#f8f5ff',border:'none',padding:'.85rem 1.5rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.12em',textTransform:'uppercase',cursor:'pointer',flexShrink:0}}
          >
            Unlock →
          </button>
        </div>
      )}

      <div style={{background:'#fff',border:'1.5px solid var(--border-md)',padding:'1.25rem 1.5rem',marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.58rem',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--ink)',fontWeight:500}}>Auto rematch</p>
          <p style={{fontSize:'.75rem',color:'var(--ink2)',marginTop:'.25rem',lineHeight:1.5}}>If your match expires, automatically put you back in the pool.</p>
        </div>
        <button
          onClick={async () => {
            const newVal = !(user.auto_rematch ?? true)
            await fetch('/api/rematch-opt-out', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ userId: user.id, optOut: !newVal })
            })
            setUser({...user, auto_rematch: newVal})
          }}
          style={{
            background: (user.auto_rematch ?? true) ? 'var(--lav)' : 'rgba(14,12,26,0.13)',
            color: (user.auto_rematch ?? true) ? '#fff' : 'var(--ink2)',
            border: 'none', padding: '.5rem 1.25rem',
            fontFamily: 'DM Mono,monospace', fontSize: '.6rem',
            letterSpacing: '.1em', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0, transition: 'all .15s'
          }}
        >
          {(user.auto_rematch ?? true) ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{textAlign:'center',marginTop:'2rem'}}>
        <a href="/quiz" style={{fontFamily:'DM Mono,monospace',fontSize:'.6rem',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--ink3)',textDecoration:'none'}}>
          Retake the quiz
        </a>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--ink2)'}}>Loading...</p>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </>
  )
}
