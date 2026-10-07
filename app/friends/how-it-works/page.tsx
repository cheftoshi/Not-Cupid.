import Link from 'next/link';

export const dynamic = 'force-static';

const STEPS = [
  { n: '1', emoji: '📝', title: 'take a quick friend quiz', body: "Tell us how you like to spend time, what you enjoy, and who you are open to meeting. These preferences guide your suggestions; you decide what happens next." },
  { n: '2', emoji: '🤝', title: 'open a curated pack', body: 'we route up to five people onto your screen using shared interests, similar energy, and your metro. no swiping, no endless scroll.' },
  { n: '3', emoji: '🎒', title: 'choose who you want to know', body: 'connect with individuals who feel right, or invite the whole pack into a shared room. a pass stays quiet and private.' },
  { n: '4', emoji: '💬', title: 'talk and make a plan', body: 'mutual connections can message one-to-one, while pack and club rooms make group plans. conversations stay free.' },
  { n: '5', emoji: '📣', title: 'ride the scene', body: 'post what you want to do — "trivia thursday?", "anyone for the new A24 movie?" — RSVP to events, and see which neighborhoods are buzzing.' },
];

export default function HowItWorks() {
  return <main style={{maxWidth:760,margin:'0 auto',padding:'40px 20px 64px',color:'var(--h-text)',fontFamily:'var(--font-ui)'}}>
    <Link href="/friends" style={{color:'var(--h-accent)',display:'inline-block',minHeight:44}}>← Back to Friendship</Link>
    <p style={{fontSize:12,letterSpacing:'.08em',textTransform:'uppercase'}}>Friendship · how it works</p>
    <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(36px,8vw,56px)',lineHeight:1.1,letterSpacing:'-.045em',margin:'16px 0'}}>Find your next friend.</h1>
    <p style={{fontSize:17,lineHeight:1.6,color:'var(--h-text-dim)'}}>Meet people through shared interests. You choose who to connect with and what to do together.</p>
    <ol className="connectionJourney">{STEPS.map(step=><li key={step.n}><h2>{step.title}</h2><p>{step.body}</p></li>)}</ol>
    <section style={{padding:24,background:'var(--h-surface-3)',border:'1px solid var(--h-border)',borderRadius:16,margin:'28px 0'}}>
      <h2 style={{fontFamily:'var(--font-display)',fontSize:24}}>Included and optional</h2>
      <p style={{lineHeight:1.6}}>Your crews and group chats are free. An additional pack of up to five suggested people is a one-time $0.99, or included with Pro. Connecting remains your choice.</p>
      <Link href="/pro" style={{color:'var(--h-accent)'}}>See optional Pro benefits →</Link>
    </section>
    <Link href="/friends" style={{display:'inline-block',padding:'14px 22px',borderRadius:10,background:'#064c48',color:'#fff',textDecoration:'none',fontWeight:600}}>Explore Friendship →</Link>
  </main>;
}
