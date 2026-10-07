import Link from 'next/link';

export const dynamic = 'force-static';

// "How NotCupid works" — the overall app flow (linked from the landing page).
// Covers the shared core quiz + the two lines (Love = blue, Friend = orange).
const INK = '#0a0a0a';
const BLUE = '#064c48';
const BLUE_DEEP = '#064c48';
const LAV = '#e5eee8';
const ORANGE = '#765600';
const ORANGE_DEEP = '#765600';

// Shared start, then a chapter per line.
const CORE_STEPS = [
  { n: '1', emoji: '📝', title: 'sign up', body: 'name, email, a 6-digit code to prove it’s you. born in Boston, now open across the Northeast — all of New England, the NYC metro, and North Jersey.' },
  { n: '2', emoji: '🧠', title: 'take the core quiz', body: 'a short, chaptered run — who you are (personality), the day-to-day (lifestyle), and a rapid-fire round. ~4 minutes, no photos, no performing.' },
  { n: '3', emoji: '🚉', title: 'choose your connections', body: 'choose friendship, dating, or both. Home shows real member invitations. Join a small-group plan or request a free two-person date; the date host chooses one guest. Your existing conversations stay available when you explore another city.' },
];

const LOVE_STEPS = [
  { emoji: '🧭', title: 'go deeper on love', body: 'a few more questions — what you’re looking for, how you connect (attachment style), and what matters most (values, kids, lifestyle, fitness). that’s what the matching actually weighs, not just vibes.' },
  { emoji: '🃏', title: 'your curated roster', body: 'the algo can hand you up to ten compatible people: three included connection picks plus seven browseable alternatives, ranked on values, attachment, personality and shared rapid-fire answers — no swiping, no endless feed.' },
  { emoji: '👉', title: 'you pick', body: 'every 24-hour roster includes three distinct connection picks. all ten profiles stay free to browse when enough compatible people are available. a one-time $0.99 AI Compatibility Read adds a private six-signal fit summary and one extra connection to that exact person—one purchase, never two. if the request is declined or expires before becoming mutual, its connection value returns as an in-app credit while the read stays open.' },
  { emoji: '💞', title: 'it’s a match', body: 'when you both accept, the chat opens and we email you both. set your match radius (5–75 mi) so you only see people you’d actually meet.' },
  { emoji: '🔓', title: 'profiles stay free', body: 'open any Love roster card to see their bio, interests and prompts before choosing. accepting, replying, blocking and reporting never cost anything. the optional AI + HEXACO tab interprets broad six-signal bands between you; raw answers and exact scores stay private, and it is never presented as a diagnosis or guarantee.' },
  { emoji: '🍽️', title: 'plan the date', body: 'once you’re talking, Date Vibes makes choosing what to do a game — a deck of curated local spots and live events; a mutual yes reveals the plan.' },
];

const FRIEND_STEPS = [
  { emoji: '🧡', title: 'join the friend line', body: 'a quick friend quiz — the activities you’re into, who you’re open to meeting, your age range. platonic only, its own separate pool.' },
  { emoji: '🎒', title: 'open a friendship pack', body: 'a pack is up to 5 people picked for you to meet. your first pack is free; more weekly packs are $0.99 (free on Pro). packs pace how many people you SEE — the connections themselves are unlimited.' },
  { emoji: '🤝', title: 'connect — your 1:1s', body: 'tap connect on anyone in a pack; they get a ping, and when they accept back you’re connected for good. connect with as many people as you like.' },
  { emoji: '💬', title: 'the group chat', body: 'choose the whole pack to open a group chat with everyone in it — the room you meet in. people who opt in are active; the rest show as invited.' },
  { emoji: '🪪', title: 'connections, added & dropped', body: 'click any connection to open their friend card — their interests, your match, and a button to connect or to drop the connection. drop one and you quietly leave the shared chat if they were your last tie there. only connections can message each other.' },
  { emoji: '🎟️', title: 'do something together', body: 'browse member plans, meet people through curated introductions, and come back to your chats. New social plans fit 2–10 people including the host; dates are always two people. Times are shown in the meeting city’s timezone. Clubs and communities are still available.' },
];

function Chapter({ tag, title, accent, accentLight, steps }: { tag: string; title: string; accent: string; accentLight: string; steps: { emoji: string; title: string; body: string }[] }) {
  return (
    <div style={{ margin: '2.5rem 0 0' }}>
      <div style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, marginBottom: '0.3rem', fontWeight: 700 }}>{tag}</div>
      <h2 style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'normal', fontSize: '2rem', lineHeight: 1, margin: '0 0 1rem', color: 'var(--h-text)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 22, top: 22, bottom: 22, width: 3, background: accentLight, borderRadius: 999, zIndex: 0 }} />
        {steps.map((s, i) => (
          <div key={i} style={{ position: 'relative', zIndex: 1, background: 'var(--h-surface)', border: `1px solid ${accentLight}`, borderRadius: 14, padding: '0.9rem 1.1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--h-surface-2)', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>{s.emoji}</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'normal', fontSize: '1.15rem' }}>{s.title}</div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--h-text-dim)' }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'DM Sans,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Space Grotesk', Georgia, ui-serif, serif", fontStyle: 'normal', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
            <span style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>how it works</span>
          </div>
          <Link href="/" style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none' }}>← back</Link>
        </div>

        <div style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.6rem' }}>a connection experiment</div>
        <h1 style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'normal', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: 'var(--h-text)', margin: '0 0 0.5rem' }}>
          A place to find <span style={{ color: BLUE }}>your people.</span>
        </h1>
        <p style={{ fontFamily: 'Space Grotesk, serif', fontStyle: 'normal', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          Dating and friendship, with more in common. Choose who to meet, start a conversation, and make a plan together.
        </p>

        {/* THE BASICS — shared start */}
        <div style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.3rem', fontWeight: 700 }}>the basics</div>
        <h2 style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'normal', fontSize: '2rem', lineHeight: 1, margin: '0 0 1rem', color: 'var(--h-text)' }}>everyone starts here.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 26, top: 22, bottom: 22, width: 4, background: 'var(--h-surface-2)', borderRadius: 999, zIndex: 0 }} />
          {CORE_STEPS.map((s) => (
            <div key={s.n} style={{ position: 'relative', zIndex: 1, background: 'var(--h-surface)', border: '1px solid rgba(6,76,72,0.18)', borderRadius: 16, boxShadow: '0 10px 30px -20px rgba(6,76,72,0.45)', padding: '1.1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--h-surface-2)', border: `3px solid ${BLUE}`, color: 'var(--h-accent)', fontFamily: "'DM Sans', monospace", fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, ui-serif, serif', fontStyle: 'normal', fontSize: '1.3rem' }}>{s.emoji} {s.title}</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem', lineHeight: 1.55, color: 'var(--h-text-dim)' }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CHAPTER ONE — Love · CHAPTER TWO — Friend */}
        <Chapter tag="chapter one · dating" title="💘 the love line" accent={BLUE_DEEP} accentLight="rgba(6,76,72,0.22)" steps={LOVE_STEPS} />
        <Chapter tag="chapter two · friends" title="🧡 the friend line" accent={ORANGE_DEEP} accentLight="rgba(255,106,31,0.24)" steps={FRIEND_STEPS} />

        <div style={{ height: '1.75rem' }}>
        </div>

        <div style={{ background: 'var(--h-surface)', border: `2px dashed ${BLUE}`, borderRadius: 16, padding: '1.25rem', margin: '0 0 1.75rem', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem' }}>🎟️ your fare</div>
          <p style={{ fontFamily: 'Space Grotesk, serif', fontStyle: 'normal', color: 'var(--h-accent)', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            the quiz and every Love profile are <b>free</b>. each roster includes <b>three connection picks</b>; each additional distinct pick is a one-time <b>$0.99</b> and includes chat if mutual. on Friend, your first <b>friendship pack</b> is free — additional packs are <b>$0.99</b> each, and group chats are always free.
          </p>
          <p style={{ fontFamily: 'Space Grotesk, serif', fontStyle: 'normal', color: 'var(--h-accent-2)', margin: '0.6rem 0 0', fontSize: '0.9rem' }}>
            or go <b>Pro</b> — AI Compatibility Reads, extra Love connection picks, and unlimited friendship packs for <b>$3.99/mo</b>. accepting and replying are always free.
          </p>
        </div>

        {/* Keep the completed round available without promoting expired entry details. */}
        <p style={{ color: 'var(--h-text-dim)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 1.75rem' }}>
          The August Dating Experiment is complete and entries are closed. <Link href="/dating-experiment" style={{ color: BLUE_DEEP, textDecoration: 'underline' }}>View the completed round</Link>.
        </p>

        <div style={{ textAlign: 'center' }}>
          <Link href="/quiz" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: INK, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)', textDecoration: 'none', display: 'inline-block' }}>
            Start connecting
          </Link>
        </div>
      </div>
    </div>
  );
}
