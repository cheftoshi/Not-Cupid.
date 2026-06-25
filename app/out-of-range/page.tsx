'use client'

import { useState } from 'react'
import Nav from '@/components/Nav'

export default function OutOfRange() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!email) return
    // Server-side: the team gets the signup via the server RESEND key. (Never
    // call Resend from the browser — that would expose the secret.)
    await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, city }),
    }).catch(() => {})
    setSubmitted(true)
  }

  return (
    <>
      <Nav />
      <div style={{
        minHeight:'100vh', background:'var(--h-bg)', color:'var(--h-text)', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'2rem', textAlign:'center', paddingTop:'6rem',
        maxWidth:'520px', margin:'0 auto'
      }}>
        {!submitted ? (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--h-accent)',marginBottom:'1.5rem'}}>
              Outside the Northeast — for now
            </p>
            <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,7vw,5rem)',lineHeight:.9,color:'var(--h-text)',marginBottom:'1rem'}}>
              THE ALGO IS<br/>COMING TO<br/>YOUR CITY.
            </h1>
            <p style={{fontSize:'.88rem',color:'var(--h-text-dim)',lineHeight:1.75,maxWidth:'380px',margin:'0 auto 2.5rem'}}>
              We're across New England + New York City now — but not your area yet. Drop your email and city and you'll be first when we expand.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem',width:'100%',maxWidth:'360px'}}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  background:'var(--h-surface)',border:'1px solid var(--h-border)',
                  color:'var(--h-text)',padding:'.85rem 1rem',
                  fontFamily:'Inter,sans-serif',fontSize:'.88rem',outline:'none',
                  borderRadius:'12px'
                }}
              />
              <input
                type="text"
                placeholder="Your city"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  background:'var(--h-surface)',border:'1px solid var(--h-border)',
                  color:'var(--h-text)',padding:'.85rem 1rem',
                  fontFamily:'Inter,sans-serif',fontSize:'.88rem',outline:'none',
                  borderRadius:'12px'
                }}
              />
              <button
                onClick={submit}
                disabled={!email}
                style={{
                  background:'var(--h-text)',color:'var(--h-bg)',border:'none',
                  padding:'.9rem',fontFamily:'DM Mono,monospace',
                  fontSize:'.65rem',letterSpacing:'.14em',textTransform:'uppercase',
                  cursor:'pointer',opacity:email?1:.3
                }}>
                Notify me →
              </button>
            </div>
            <a href="/" style={{
              marginTop:'2rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',
              letterSpacing:'.1em',textTransform:'uppercase',color:'var(--h-text-faint)',
              textDecoration:'none'
            }}>
              ← Back to NotCupid
            </a>
          </>
        ) : (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--h-accent)',marginBottom:'1.5rem'}}>
              You're on the list
            </p>
            <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,7vw,5rem)',lineHeight:.9,color:'var(--h-text)',marginBottom:'1rem'}}>
              THE ALGO<br/>WILL FIND YOU.
            </h1>
            <p style={{fontSize:'.88rem',color:'var(--h-text-dim)',lineHeight:1.75,maxWidth:'380px',margin:'0 auto 2rem'}}>
              We'll hit you when NotCupid lands in {city || 'your city'}. The algorithm is patient.
            </p>
            <a href="/" style={{
              background:'var(--h-text)',color:'var(--h-bg)',padding:'.9rem 2rem',
              fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.14em',
              textTransform:'uppercase',textDecoration:'none',display:'inline-block'
            }}>
              Back to NotCupid →
            </a>
          </>
        )}
      </div>
    </>
  )
}
