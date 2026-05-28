'use client'

import { useState } from 'react'
import Nav from '@/components/Nav'
import CorpFooter from '@/components/corp-footer'

export default function OutOfRange() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!email) return
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    setSubmitted(true)
  }

  return (
    <>
      <Nav />
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'2rem', textAlign:'center', paddingTop:'6rem',
        maxWidth:'520px', margin:'0 auto'
      }}>
        {!submitted ? (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--lav)',marginBottom:'1.5rem'}}>
              Not in Boston yet
            </p>
            <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,7vw,5rem)',lineHeight:.9,color:'var(--ink)',marginBottom:'1rem'}}>
              THE ALGO IS<br/>COMING TO<br/>YOUR CITY.
            </h1>
            <p style={{fontSize:'.88rem',color:'var(--ink2)',lineHeight:1.75,maxWidth:'380px',margin:'0 auto 2.5rem'}}>
              We're Boston-only for now. Drop your email and city — you'll be first when we expand.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem',width:'100%',maxWidth:'360px'}}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  background:'#fff',border:'1.5px solid var(--border-md)',
                  color:'var(--ink)',padding:'.85rem 1rem',
                  fontFamily:'Inter,sans-serif',fontSize:'.88rem',outline:'none',
                  borderRadius:'0'
                }}
              />
              <input
                type="text"
                placeholder="Your city"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  background:'#fff',border:'1.5px solid var(--border-md)',
                  color:'var(--ink)',padding:'.85rem 1rem',
                  fontFamily:'Inter,sans-serif',fontSize:'.88rem',outline:'none',
                  borderRadius:'0'
                }}
              />
              <button
                onClick={submit}
                disabled={!email}
                style={{
                  background:'var(--ink)',color:'var(--bg)',border:'none',
                  padding:'.9rem',fontFamily:'DM Mono,monospace',
                  fontSize:'.65rem',letterSpacing:'.14em',textTransform:'uppercase',
                  cursor:'pointer',opacity:email?1:.3
                }}>
                Notify me →
              </button>
            </div>
            <a href="/" style={{
              marginTop:'2rem',fontFamily:'DM Mono,monospace',fontSize:'.62rem',
              letterSpacing:'.1em',textTransform:'uppercase',color:'var(--ink3)',
              textDecoration:'none'
            }}>
              ← Back to NotCupid
            </a>
          </>
        ) : (
          <>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:'.62rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--lav)',marginBottom:'1.5rem'}}>
              You're on the list
            </p>
            <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,7vw,5rem)',lineHeight:.9,color:'var(--ink)',marginBottom:'1rem'}}>
              THE ALGO<br/>WILL FIND YOU.
            </h1>
            <p style={{fontSize:'.88rem',color:'var(--ink2)',lineHeight:1.75,maxWidth:'380px',margin:'0 auto 2rem'}}>
              We'll hit you when NotCupid lands in {city || 'your city'}. The algorithm is patient.
            </p>
            <a href="/" style={{
              background:'var(--ink)',color:'var(--bg)',padding:'.9rem 2rem',
              fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.14em',
              textTransform:'uppercase',textDecoration:'none',display:'inline-block'
            }}>
              Back to NotCupid →
            </a>
          </>
        )}
      </div>
      <CorpFooter />
    </>
  )
}
