'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'

function UnlockContent() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading')

  useEffect(() => {
const sessionId = params.get('session_id')
const userId = params.get('userId')
if (sessionId && userId) {
  window.location.href = `/dashboard?id=${userId}`
} else if (sessionId) {
  setStatus('success')
}
    else setStatus('error')
  }, [params])

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'2rem', textAlign:'center', paddingTop:'6rem'
    }}>
      {status === 'loading' && (
        <p style={{fontFamily:'DM Mono,monospace',fontSize:'.75rem',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--ink2)'}}>
          Verifying payment...
        </p>
      )}
      {status === 'success' && (
        <>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--lav)',marginBottom:'1.5rem'}}>
            Payment confirmed
          </p>
          <h1 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'clamp(2.5rem,6vw,5rem)',lineHeight:.9,color:'var(--ink)',marginBottom:'1rem'}}>
            YOUR PROFILE<br/>IS UNLOCKED.
          </h1>
          <p style={{fontSize:'.88rem',color:'var(--ink2)',lineHeight:1.75,maxWidth:'400px',marginBottom:'2.5rem'}}>
            Your full HEXACO breakdown has been unlocked. Check your email — we've sent you the complete breakdown of all 6 dimensions.
          </p>
          <a href="/quiz" style={{
            background:'var(--ink)',color:'var(--bg)',padding:'.9rem 2rem',
            fontFamily:'DM Mono,monospace',fontSize:'.65rem',letterSpacing:'.14em',
            textTransform:'uppercase',textDecoration:'none',display:'inline-block'
          }}>
            Back to NotCupid →
          </a>
        </>
      )}
      {status === 'error' && (
        <>
          <h2 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'2.5rem',color:'var(--ink)',marginBottom:'1rem'}}>
            Something went wrong
          </h2>
          <a href="/quiz" style={{color:'var(--lav)',fontFamily:'DM Mono,monospace',fontSize:'.7rem',letterSpacing:'.1em'}}>
            Go back →
          </a>
        </>
      )}
    </div>
  )
}

export default function UnlockPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <p style={{fontFamily:'DM Mono,monospace',fontSize:'.75rem',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--ink2)'}}>
            Loading...
          </p>
        </div>
      }>
        <UnlockContent />
      </Suspense>
    </>
  )
}
