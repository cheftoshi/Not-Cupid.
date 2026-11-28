import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import styles from './how-it-works.module.css';

export const dynamic = 'force-static';

// "How NotCupid works": the overall flow, linked from the landing page.
// Shares the public brand tokens and header with the landing page so a
// shared link reads as one product from the first screen to this one.

const JOURNEY = [
  { title: 'Choose your intent', body: 'Dating, friendship, or both. Set your preferences explicitly.' },
  { title: 'Meet people', body: 'Explore your dating roster or local friendship invitations.' },
  { title: 'Decide together', body: 'You choose who to connect with. Dating chat opens after mutual acceptance.' },
  { title: 'Talk and make a plan', body: 'Start a conversation, agree on details, and choose what works for you.' },
];

const BASICS = [
  { title: 'Sign up', body: 'Your name, your email and a 6-digit code to confirm it’s you. Born in Boston, now open across New England, the NYC metro and North Jersey.' },
  { title: 'Take the core quiz', body: 'About four minutes across personality, day-to-day lifestyle and a rapid-fire round. No photos, no performing.' },
  { title: 'Choose your connections', body: 'Pick friendship, dating or both. Join a small-group plan or request a free two-person date. Your conversations stay with you when you explore another city.' },
];

const DATING = [
  { title: 'Go deeper', body: 'A few more questions on what you’re looking for, how you connect and what matters most: values, kids, lifestyle and fitness. That’s what the matching weighs.' },
  { title: 'A curated roster', body: 'Up to ten compatible people every 24 hours, ranked on values, attachment, personality and shared answers. No swiping and no endless feed.' },
  { title: 'You pick', body: 'Each roster includes three connection picks. An optional one-time $0.99 Compatibility Read adds a private fit summary and one extra pick for that person. If it doesn’t become mutual, its connection value returns as an in-app credit.' },
  { title: 'It’s a match', body: 'When you both accept, the chat opens and we email you both. Set a match radius of 5 to 75 miles so you only see people you’d actually meet.' },
  { title: 'Profiles stay free', body: 'Open any roster card to read their bio, interests and prompts before choosing. Viewing is free, and accepting, replying, blocking and reporting never cost anything. Raw answers and exact scores stay private.' },
  { title: 'Plan the date', body: 'Once you’re talking, Date Vibes suggests local spots and live events. A mutual yes reveals the plan.' },
];

const FRIENDS = [
  { title: 'Join Friend Line', body: 'A short friend quiz: the activities you’re into, who you’re open to meeting and your age range. Platonic only, in its own separate pool.' },
  { title: 'Open a friendship pack', body: 'Up to five people picked for you to meet. Your first pack is free; more weekly packs are $0.99, or included with Pro.' },
  { title: 'Connect one to one', body: 'Tap connect on anyone in a pack. When they accept, you’re connected, and you can connect with as many people as you like.' },
  { title: 'Group chat', body: 'Open a group chat with your whole pack, the room you meet in. People who opt in show as active; the rest show as invited.' },
  { title: 'Manage connections', body: 'Open any connection to see their interests and your match, or to drop the connection. Only connections can message each other.' },
  { title: 'Do something together', body: 'Browse member plans for 2 to 10 people, meet through curated introductions and come back to your chats. Times show in the meeting city’s time zone.' },
];

function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ul className={styles.steps}>
      {steps.map((s) => (
        <li key={s.title}>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function HowItWorks() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <PublicHeader />

        <section className={styles.hero}>
          <p className={styles.eyebrow}>How it works</p>
          <h1 className={styles.h1}>A place to find your people.</h1>
          <p className={styles.lede}>
            Dating and friendship, with more in common. Choose who to meet, start a conversation, and make a plan together.
          </p>
        </section>

        <ol className={styles.journey} aria-label="How connection works">
          {JOURNEY.map((s) => (
            <li key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>

        <section className={styles.section} aria-labelledby="basics">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Getting started</p>
            <h2 id="basics" className={styles.h2}>Everyone starts here.</h2>
            <p>One account and one quiz power both dating and friendship.</p>
          </div>
          <StepList steps={BASICS} />
        </section>

        <section className={styles.section} aria-labelledby="dating">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Love Line</p>
            <h2 id="dating" className={styles.h2}>Dating, matched on who you are.</h2>
            <p>A short roster of compatible people instead of an endless feed.</p>
          </div>
          <StepList steps={DATING} />
        </section>

        <section className={styles.section} aria-labelledby="friends">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Friend Line</p>
            <h2 id="friends" className={styles.h2}>Friendship that has somewhere to begin.</h2>
            <p>Small packs, real plans and a group chat to break the ice.</p>
          </div>
          <StepList steps={FRIENDS} />
        </section>

        <section className={styles.section} aria-labelledby="pricing">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Pricing</p>
            <h2 id="pricing" className={styles.h2}>Free to start. Pay only for extras.</h2>
            <p>Accepting and replying are always free.</p>
          </div>
          <div>
            <div className={styles.pricing}>
              <div className={styles.plan}>
                <div className={styles.planName}>Free</div>
                <div className={styles.planPrice}>$0</div>
                <ul>
                  <li>The quiz and every Love profile</li>
                  <li>Three connection picks per roster</li>
                  <li>Your first friendship pack</li>
                  <li>Group chats</li>
                </ul>
              </div>
              <div className={styles.plan}>
                <div className={styles.planName}>One-time extras</div>
                <div className={styles.planPrice}>$0.99 <small>each</small></div>
                <ul>
                  <li>An extra Love connection pick, with chat if mutual</li>
                  <li>An additional friendship pack</li>
                </ul>
              </div>
              <div className={`${styles.plan} ${styles.planFeatured}`}>
                <div className={styles.planName}>Pro</div>
                <div className={styles.planPrice}>$3.99 <small>/ month</small></div>
                <ul>
                  <li>AI Compatibility Reads</li>
                  <li>Extra Love connection picks</li>
                  <li>Unlimited friendship packs</li>
                </ul>
              </div>
            </div>
            {/* Keep the completed round available without promoting expired entry details. */}
            <p className={styles.note}>
              The August Dating Experiment is complete and entries are closed. <Link href="/dating-experiment">View the completed round</Link>.
            </p>
          </div>
        </section>

        <section className={styles.cta}>
          <div>
            <h2>Ready to meet your people?</h2>
            <p>12 personality questions to start. Go at your own pace.</p>
          </div>
          <Link href="/quiz" className={styles.button}>Start connecting <span aria-hidden>→</span></Link>
        </section>
      </div>
    </main>
  );
}
