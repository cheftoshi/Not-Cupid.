import Link from 'next/link';
import type { Metadata } from 'next';
import Wordmark from '@/components/wordmark';

export const metadata: Metadata = {
  title: 'Friend Line | NotCupid',
  description: 'A city-first way to make friends through curated packs, real plans, and low-pressure group chat.',
};

const plans = [
  { tag: 'tonight', title: 'coffee walk in the neighborhood', meta: '3 interested · low-pressure' },
  { tag: 'weekend', title: 'beginner tennis + smoothies', meta: 'needs 2 more · active crowd' },
  { tag: 'talk', title: 'new here, who wants to grab food?', meta: 'open invite · new faces' },
];

const prompts = ['two truths', 'plan vote', 'city recs', 'weekend check'];

export default function FriendLinePreviewPage() {
  return (
    <main className="friendPreview">
      <header className="friendPreviewTop">
        <Wordmark size={1.35} />
        <nav>
          <Link href="/how-it-works">how it works</Link>
          <Link href="/login">log in</Link>
        </nav>
      </header>

      <section className="friendPreviewHero">
        <div className="friendPreviewCopy">
          <div className="friendPreviewKicker"><span /> friend line</div>
          <h1>Make one real social move today.</h1>
          <p>
            Friend Line gives you a small, curated way into your city: people you might vibe with,
            plans that are already forming, and a pack chat that makes the first message easier.
          </p>
          <div className="friendPreviewActions">
            <Link href="/quiz?next=friends" className="primary">join the Friend Line</Link>
            <Link href="/login?next=/friends" className="ghost">open my account</Link>
          </div>
        </div>

        <div className="friendPreviewBoard" aria-label="Friend Line preview">
          <div className="moveCard">
            <small>best move today</small>
            <h2>join a plan that already has momentum.</h2>
            <p>Tonight · coffee walk · 3 interested</p>
            <button>ask to join</button>
          </div>
          <div className="miniGrid">
            <div><b>open plans</b><strong>12</strong></div>
            <div><b>nearby people</b><strong>8</strong></div>
            <div><b>in circle</b><strong>3</strong></div>
            <div><b>your plans</b><strong>2</strong></div>
          </div>
        </div>
      </section>

      <section className="friendPreviewColumns">
        <article>
          <small>today</small>
          <h2>Plans that fit your vibe.</h2>
          <div className="planStack">
            {plans.map((p) => (
              <div key={p.title} className="planCard">
                <span>{p.tag}</span>
                <h3>{p.title}</h3>
                <p>{p.meta}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <small>pack chat</small>
          <h2>A warmer way to start talking.</h2>
          <div className="chatBox">
            <div className="bubble other">plan vote: coffee, food, or something active?</div>
            <div className="bubble me">coffee walk feels easy</div>
            <div className="promptRow">
              {prompts.map((p) => <span key={p}>{p}</span>)}
            </div>
          </div>
        </article>

        <article>
          <small>city pulse</small>
          <h2>See where people are actually gathering.</h2>
          <div className="pulseList">
            {['Somerville', 'Cambridge', 'Back Bay'].map((area, i) => (
              <div key={area}>
                <b>{area}</b>
                <span>{i === 0 ? '2 plans · 44 people' : i === 1 ? '1 plan · 31 people' : '3 plans · 28 people'}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="friendPreviewClose">
        <h2>Not a follower feed. Not cold browsing.</h2>
        <p>Curated packs, small plans, and gentle prompts so friendship has somewhere to begin.</p>
        <Link href="/quiz?next=friends">start with the friend quiz →</Link>
      </section>

      <style>{`
        .friendPreview { min-height: 100vh; color: var(--h-text); background:
          radial-gradient(circle at 82% 8%, rgba(255,106,31,0.14), transparent 30%),
          radial-gradient(circle at 6% 72%, rgba(37,99,255,0.09), transparent 30%),
          var(--h-bg); padding: 1rem; }
        .friendPreviewTop { max-width: 1120px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .friendPreviewTop nav { display: flex; gap: 0.55rem; flex-wrap: wrap; justify-content: flex-end; }
        .friendPreviewTop a { color: var(--h-text); text-decoration: none; border: 1px solid var(--h-border); border-radius: 999px; padding: 0.48rem 0.85rem; font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; background: color-mix(in srgb, var(--h-surface) 86%, transparent); }
        .friendPreviewHero { max-width: 1120px; margin: 4.5rem auto 1.3rem; display: grid; grid-template-columns: minmax(0,1fr) minmax(310px,420px); gap: 1.2rem; align-items: stretch; }
        .friendPreviewCopy, .friendPreviewBoard, .friendPreviewColumns article, .friendPreviewClose { border: 1px solid var(--h-border); border-radius: 28px; background: color-mix(in srgb, var(--h-surface) 94%, transparent); box-shadow: var(--shadow-md); }
        .friendPreviewCopy { padding: clamp(1.25rem, 4vw, 2.4rem); }
        .friendPreviewKicker { display: flex; align-items: center; gap: 0.55rem; font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: #d2530f; font-weight: 700; }
        .friendPreviewKicker span { width: 8px; height: 8px; border-radius: 50%; background: #ff6a1f; }
        .friendPreview h1 { margin: 0.75rem 0 0; max-width: 10ch; font-family: Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: 0; font-size: clamp(2.25rem, 8vw, 5.1rem); line-height: 0.95; }
        .friendPreview p { color: var(--h-text-dim); font-family: Georgia, serif; font-style: italic; line-height: 1.55; }
        .friendPreviewCopy p { max-width: 58ch; font-size: 1.03rem; }
        .friendPreviewActions { display: flex; gap: 0.65rem; flex-wrap: wrap; margin-top: 1.3rem; }
        .friendPreviewActions a, .friendPreviewClose a { border-radius: 999px; padding: 0.72rem 1.1rem; text-decoration: none; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.04em; font-size: 1.08rem; border: 1px solid var(--h-border); }
        .friendPreviewActions .primary, .friendPreviewClose a { color: #fff; background: #ff6a1f; }
        .friendPreviewActions .ghost { color: var(--h-text); background: var(--h-surface); }
        .friendPreviewBoard { padding: 1rem; display: grid; gap: 0.85rem; align-content: end; background: linear-gradient(145deg, #101010, #201712); color: #fff; }
        .moveCard { border: 1px solid rgba(255,255,255,0.12); border-radius: 22px; padding: 1rem; background: rgba(255,255,255,0.06); }
        .friendPreview small, .moveCard small { font-family: 'DM Mono', monospace; font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: #d2530f; font-weight: 700; }
        .moveCard small { color: rgba(255,255,255,0.68); }
        .friendPreview h2 { font-family: Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: 0; font-size: 1.55rem; line-height: 1.05; margin: 0.45rem 0 0.65rem; }
        .moveCard button { border: 0; border-radius: 999px; background: #ff6a1f; color: #fff; padding: 0.62rem 1rem; font-family: 'Bebas Neue', sans-serif; font-size: 1rem; letter-spacing: 0.05em; }
        .miniGrid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0.55rem; }
        .miniGrid div { border: 1px solid rgba(255,255,255,0.11); border-radius: 16px; padding: 0.8rem; background: rgba(255,255,255,0.05); }
        .miniGrid b { display: block; font-family: 'DM Mono', monospace; font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.66); }
        .miniGrid strong { display: block; margin-top: 0.45rem; font-family: 'Bebas Neue', sans-serif; font-size: 2rem; line-height: 0.9; color: #ffb27e; }
        .friendPreviewColumns { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1rem; }
        .friendPreviewColumns article { padding: 1rem; border-radius: 24px; }
        .planStack, .pulseList { display: grid; gap: 0.55rem; }
        .planCard, .pulseList div { border: 1px solid var(--h-border); border-radius: 16px; background: var(--h-surface-2); padding: 0.75rem; }
        .planCard span { font-family: 'DM Mono', monospace; font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; color: #d2530f; }
        .planCard h3 { margin: 0.32rem 0 0.2rem; font-family: 'Bebas Neue', sans-serif; font-size: 1.35rem; line-height: 1; letter-spacing: 0.02em; }
        .planCard p { margin: 0; font-size: 0.82rem; }
        .chatBox { display: grid; gap: 0.55rem; }
        .bubble { max-width: 86%; border: 1px solid var(--h-border); border-radius: 18px; padding: 0.65rem 0.8rem; font-size: 0.9rem; line-height: 1.35; background: var(--h-surface-2); }
        .bubble.me { margin-left: auto; background: #ff6a1f; color: #fff; border-color: #ff6a1f; }
        .promptRow { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; }
        .promptRow span { border: 1px solid var(--h-border); border-radius: 999px; padding: 0.28rem 0.55rem; background: var(--h-surface); font-family: 'DM Mono', monospace; font-size: 0.54rem; letter-spacing: 0.06em; color: var(--h-text-dim); }
        .pulseList b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 1.28rem; letter-spacing: 0.02em; }
        .pulseList span { color: var(--h-text-dim); font-family: 'DM Mono', monospace; font-size: 0.58rem; letter-spacing: 0.04em; }
        .friendPreviewClose { max-width: 1120px; margin: 1rem auto 0; padding: 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .friendPreviewClose h2 { margin: 0; }
        .friendPreviewClose p { margin: 0; flex: 1; }
        @media (max-width: 860px) {
          .friendPreviewHero, .friendPreviewColumns { grid-template-columns: 1fr; }
          .friendPreviewHero { margin-top: 2rem; }
          .friendPreviewClose { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 520px) {
          .friendPreview { padding: 0.75rem; }
          .friendPreviewTop { align-items: flex-start; }
          .friendPreviewTop nav a { padding: 0.4rem 0.65rem; }
          .friendPreviewActions { flex-direction: column; }
          .friendPreviewActions a, .friendPreviewClose a { width: 100%; text-align: center; }
          .miniGrid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
