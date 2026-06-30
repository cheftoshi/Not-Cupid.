import Link from 'next/link';
import { RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-static';

// "How NotCupid works" — the overall app flow (linked from the landing page).
// Covers the shared core quiz + the two lines (Love = blue, Friend = orange).
const INK = '#0a0a0a';
const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';
const LAV = '#e8edff';
const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';

// Shared start, then a chapter per line.
const CORE_STEPS = [
  { n: '1', emoji: '📝', title: 'sign up', body: 'name, email, a 6-digit code to prove it’s you. born in Boston, now open across the Northeast — all of New England, the NYC metro, and North Jersey.' },
  { n: '2', emoji: '🧠', title: 'take the core quiz', body: 'a short, chaptered run — who you are (personality), the day-to-day (lifestyle), and a rapid-fire round. ~4 minutes, no photos, no performing.' },
  { n: '3', emoji: '🚉', title: 'pick your line', body: 'board the Love Line (dating), the Friend Line (platonic), or both. your core quiz powers both sides — then each line asks a few questions of its own.' },
];

const LOVE_STEPS = [
  { emoji: '🧭', title: 'go deeper on love', body: 'a few more questions — what you’re looking for, how you connect (attachment style), and what matters most (values, kids, lifestyle, fitness). that’s what the matching actually weighs, not just vibes.' },
  { emoji: '🃏', title: 'your curated roster', body: 'the algo hands you a small set of your most compatible people, ranked on values, attachment, personality and shared rapid-fire answers — no swiping, no endless feed.' },
  { emoji: '👉', title: 'you pick', body: 'choose someone worth the first message. run up to two conversations at once; the rest of the roster stays browsable, and to start a new one past the cap you close one.' },
  { emoji: '💞', title: 'it’s a match', body: 'when you both accept, the chat opens and we email you both. set your match radius (5–75 mi) so you only see people you’d actually meet.' },
  { emoji: '🔓', title: 'unlock the full profile', body: 'the photos you share with a match are free; their bio, gallery and the rest unlock for a one-time $0.99 (free on Pro).' },
  { emoji: '🍽️', title: 'plan the date', body: 'once you’re talking, Date Vibes makes choosing what to do a game — a deck of curated local spots and live events; a mutual yes reveals the plan.' },
];

const FRIEND_STEPS = [
  { emoji: '🧡', title: 'join the friend line', body: 'a quick friend quiz — the activities you’re into, who you’re open to meeting, your age range. platonic only, its own separate pool.' },
  { emoji: '🎒', title: 'open a friendship pack', body: 'a pack is 7–8 people picked for you to meet. your first pack is free; more weekly packs are $0.99 (free on Pro). packs pace how many people you SEE — the connections themselves are unlimited.' },
  { emoji: '🤝', title: 'connect — your 1:1s', body: 'tap connect on anyone in a pack; they get a ping, and when they accept back you’re connected for good. connect with as many people as you like.' },
  { emoji: '💬', title: 'the group chat', body: 'choose the whole pack to open a group chat with everyone in it — the room you meet in. people who opt in are active; the rest show as invited.' },
  { emoji: '🪪', title: 'connections, added & dropped', body: 'click any connection to open their friend card — their interests, your match, and a button to connect or to drop the connection. drop one and you quietly leave the shared chat if they were your last tie there. only connections can message each other.' },
  { emoji: '🎟️', title: 'the scene & city pulse', body: 'post a plan or a thought, RSVP to what’s happening, star what you’re into, and see which neighborhoods are buzzing — real plans (pickleball, a run club, movie night) with your whole city.' },
];

function Chapter({ tag, title, accent, accentLight, steps }: { tag: string; title: string; accent: string; accentLight: string; steps: { emoji: string; title: string; body: string }[] }) {
  return (
    <div style={{ margin: '2.5rem 0 0' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, marginBottom: '0.3rem', fontWeight: 700 }}>{tag}</div>
      <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '2rem', lineHeight: 1, margin: '0 0 1rem', color: 'var(--h-text)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 22, top: 22, bottom: 22, width: 3, background: accentLight, borderRadius: 999, zIndex: 0 }} />
        {steps.map((s, i) => (
          <div key={i} style={{ position: 'relative', zIndex: 1, background: 'var(--h-surface)', border: `1px solid ${accentLight}`, borderRadius: 14, padding: '0.9rem 1.1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--h-surface-2)', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>{s.emoji}</div>
            <div>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.15rem' }}>{s.title}</div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--h-text-dim)' }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The Summer of Connection raffle — every point, for the featured slide below.
const RAFFLE_POINTS = [
  { e: '✅', t: 'how to enter', b: `be in ${RAFFLE.city} with a complete profile (photo, quiz, bio, a few interests), set your match basics (who you’re into + your age range), and add a 15–30s intro video — that’s your contest entry. entering is free.` },
  { e: '🎲', t: 'how we pick', b: 'a weighted-random draw — it’s luck, but the odds scale with compatibility. every eligible pair can win; better-matched pairs (shared hobbies, music, food, plus personality and values) just win more often. no human picks.' },
  { e: '⚖️', t: 'kept fair', b: 'the entrant pool is balanced by gender so it can’t skew, anyone who already won a past round sits out the next, and if your match passes you get re-drawn — up to two shots.' },
  { e: '🤝', t: 'drawn? accept or reject', b: `you and your match each say yes or no. both yes and your $${RAFFLE.budget} dinner is locked — we send the spot and the time. turn on notifications so you know the second you’re picked.` },
];

export default function HowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>how it works</span>
          </div>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none' }}>← back</Link>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.6rem' }}>a connection experiment</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: 'var(--h-text)', margin: '0 0 0.5rem' }}>
          meet people. <span style={{ color: BLUE }}>not profiles.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          one quiz, two lines, real connection — the algo does the heavy lifting.
        </p>

        {/* THE BASICS — shared start */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.3rem', fontWeight: 700 }}>the basics</div>
        <h2 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '2rem', lineHeight: 1, margin: '0 0 1rem', color: 'var(--h-text)' }}>everyone starts here.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 26, top: 22, bottom: 22, width: 4, background: 'var(--h-surface-2)', borderRadius: 999, zIndex: 0 }} />
          {CORE_STEPS.map((s) => (
            <div key={s.n} style={{ position: 'relative', zIndex: 1, background: 'var(--h-surface)', border: '1px solid rgba(37,99,255,0.18)', borderRadius: 16, boxShadow: '0 10px 30px -20px rgba(27,70,201,0.45)', padding: '1.1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--h-surface-2)', border: `3px solid ${BLUE}`, color: 'var(--h-accent)', fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.3rem' }}>{s.emoji} {s.title}</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem', lineHeight: 1.55, color: 'var(--h-text-dim)' }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CHAPTER ONE — Love · CHAPTER TWO — Friend */}
        <Chapter tag="chapter one · dating" title="💘 the love line" accent={BLUE_DEEP} accentLight="rgba(37,99,255,0.22)" steps={LOVE_STEPS} />
        <Chapter tag="chapter two · friends" title="🧡 the friend line" accent={ORANGE_DEEP} accentLight="rgba(255,106,31,0.24)" steps={FRIEND_STEPS} />

        <div style={{ height: '1.75rem' }}>
        </div>

        <div style={{ background: 'var(--h-surface)', border: `2px dashed ${BLUE}`, borderRadius: 16, padding: '1.25rem', margin: '0 0 1.75rem', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem' }}>🎟️ your fare</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-accent)', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            the quiz and your matches are <b>free</b>. on Love, unlock a match’s full profile for a one-time <b>$0.99</b>. on Friend, your first <b>friendship pack</b> (7–8 people) is free — more weekly packs are <b>$0.99</b> each, and group chats are always free.
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-accent-2)', margin: '0.6rem 0 0', fontSize: '0.9rem' }}>
            or go <b>Pro</b> — every love unlock, unlimited friendship packs, and events, all for <b>$3.99/mo</b>. no swiping, ever.
          </p>
        </div>

        {/* featured: the Summer of Connection raffle */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,106,31,0.13), var(--h-surface))', border: `2px solid ${ORANGE}`, borderRadius: 18, padding: '1.4rem 1.4rem 1.5rem', margin: '0 0 1.75rem', boxShadow: '0 18px 50px -30px rgba(255,106,31,0.55)' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>🎟️ now live · {RAFFLE.city}</div>
          <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.75rem', color: 'var(--h-text)', margin: '0.3rem 0 0.2rem' }}>{RAFFLE.series}</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
            {RAFFLE.tagline} each round raffles <b>one fully-covered date</b> — up to <b>${RAFFLE.budget}</b> at a {RAFFLE.city} restaurant — and entering is <b>free</b>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {RAFFLE_POINTS.map((p) => (
              <div key={p.t} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.05rem', flexShrink: 0, lineHeight: 1.4 }}>{p.e}</span>
                <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--h-text-dim)' }}><b style={{ color: 'var(--h-text)' }}>{p.t}</b> — {p.b}</p>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', color: ORANGE_DEEP, marginTop: '1rem', fontWeight: 700 }}>
            capped at {RAFFLE.cap} entrants · entry closes {RAFFLE.entryCloseLabel} · dinner {RAFFLE.dateLabel}
          </div>
          <Link href="/raffle" style={{ display: 'inline-block', marginTop: '0.9rem', background: ORANGE, color: '#fff', borderRadius: 999, padding: '0.65rem 1.7rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.04em', textDecoration: 'none' }}>enter the raffle →</Link>
          <p style={{ fontSize: '0.66rem', lineHeight: 1.5, color: 'var(--h-text-faint)', margin: '0.85rem 0 0' }}>
            * No purchase necessary. Open to {RAFFLE.city}-area residents 21+. Winner selected by chance; odds depend on entries. Void where prohibited. <Link href="/raffle/rules" style={{ color: ORANGE_DEEP, textDecoration: 'underline' }}>Official Rules</Link>.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/quiz" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: INK, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)', textDecoration: 'none', display: 'inline-block' }}>
            get started →
          </Link>
        </div>
      </div>
    </div>
  );
}
