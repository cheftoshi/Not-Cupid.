import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/public-header';
import styles from './friend-line.module.css';

export const metadata: Metadata = {
  title: 'Friend Line | NotCupid',
  description: 'A city-first way to make friends through curated packs, real plans, and low-pressure group chat.',
};

// Example ideas only. Never present these as live availability or real members.
const plans = [
  { tag: 'Tonight', title: 'Coffee walk in the neighborhood', meta: 'Example idea · low-pressure' },
  { tag: 'Weekend', title: 'Beginner tennis and smoothies', meta: 'Example idea · active afternoon' },
  { tag: 'Talk', title: 'New here, who wants to grab food?', meta: 'Example idea · new faces' },
];

const prompts = ['Two truths', 'Plan vote', 'City recs', 'Weekend check'];

export default function FriendLinePreviewPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <PublicHeader />

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Friend Line</p>
            <h1 className={styles.h1}>Make friends in your city, <em>for real.</em></h1>
            <p className={styles.lede}>
              A small, curated way into your city: people you might get along with,
              member-created plans, and a pack chat that makes the first message easier.
            </p>
            <div className={styles.actions}>
              <Link href="/quiz?next=friends" className={styles.primary}>Join Friend Line <span aria-hidden>→</span></Link>
              <Link href="/login?next=/friends" className={styles.secondary}>Log in</Link>
            </div>
          </div>

          <div className={styles.preview} aria-label="Friend Line preview">
            <p className={styles.previewLabel}>Illustrative preview. These examples are ideas, not live availability.</p>
            {plans.map((p) => (
              <div key={p.title} className={styles.card}>
                <div className={styles.cardTag}>{p.tag}</div>
                <div className={styles.cardTitle}>{p.title}</div>
                <div className={styles.cardMeta}>{p.meta}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.columns}>
          <article className={styles.column}>
            <p className={styles.eyebrow}>Packs</p>
            <h2 className={styles.h2}>A few people, picked for you.</h2>
            <p className={styles.body}>
              Each pack is up to five people matched on personality and what you like to do.
              Connect with anyone in it, as many as you like.
            </p>
          </article>

          <article className={styles.column}>
            <p className={styles.eyebrow}>Pack chat</p>
            <h2 className={styles.h2}>A warmer way to start talking.</h2>
            <div className={styles.chat} aria-label="Example pack chat">
              <div className={styles.bubble}>Plan vote: coffee, food, or something active?</div>
              <div className={`${styles.bubble} ${styles.bubbleMe}`}>Coffee walk feels easy</div>
              <div className={styles.chips}>
                {prompts.map((p) => <span key={p}>{p}</span>)}
              </div>
            </div>
          </article>

          <article className={styles.column}>
            <p className={styles.eyebrow}>Your city, your pace</p>
            <h2 className={styles.h2}>Find people through shared plans.</h2>
            <p className={styles.body}>
              Explore member invitations, meet people, or find a community. Availability depends on your city and the people taking part.
            </p>
            <Link href="/quiz?next=friends" className={styles.textLink}>Set up friendship preferences</Link>
          </article>
        </section>

        <section className={styles.close}>
          <div>
            <h2 className={styles.h2}>Not a follower feed. Not cold browsing.</h2>
            <p className={styles.body}>Curated packs, small plans and gentle prompts, so friendship has somewhere to begin.</p>
          </div>
          <Link href="/quiz?next=friends" className={styles.closeAction}>Start with the friend quiz <span aria-hidden>→</span></Link>
        </section>
      </div>
    </main>
  );
}
