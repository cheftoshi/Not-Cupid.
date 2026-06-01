import styles from './preview.module.css';

// STATIC STYLE MOCK for the Friend Maxxin dashboard (poppy / anime).
// Hardcoded sample data — no auth, no real matches. For design review only.
export const dynamic = 'force-static';

const CREW = [
  { name: 'Maya', age: 28, arch: 'The Honest Eccentric', score: 94, img: 'https://i.pravatar.cc/300?img=5', chips: ['run club', 'coffee & deep talks', 'concerts'] },
  { name: 'Devin', age: 31, arch: 'The Deliberate Charmer', score: 91, img: 'https://i.pravatar.cc/300?img=12', chips: ['food & restaurants', 'nightlife'] },
  { name: 'Priya', age: 27, arch: 'The Curious Realist', score: 89, img: 'https://i.pravatar.cc/300?img=45', chips: ['outdoors & hikes', 'creative & art', 'coffee'] },
  { name: 'Sam', age: 30, arch: 'The Grounded Optimist', score: 86, img: 'https://i.pravatar.cc/300?img=33', chips: ['gaming', 'shows', 'food'] },
  { name: 'Jordan', age: 29, arch: 'The Warm Skeptic', score: 84, img: 'https://i.pravatar.cc/300?img=15', chips: ['sports', 'run club'] },
];

const MSGS = [
  { who: 'Maya', img: 'https://i.pravatar.cc/100?img=5', text: 'wait who else is down for trivia thursday at trident??', me: false },
  { who: 'you', img: 'https://i.pravatar.cc/100?img=8', text: 'me!! i will absolutely carry the music round', me: true },
  { who: 'Devin', img: 'https://i.pravatar.cc/100?img=12', text: 'lol bold claim. i\'m in', me: false },
];

export default function FriendDashboardMock() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <div className={styles.brand}>FRIEND<span>LINE</span></div>
          <div className={styles.mockTag}>style mock</div>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroKick}>✦ your crew is here</div>
          <h1 className={styles.heroTitle}>5 PEOPLE<em>your speed.</em></h1>
          <p className={styles.heroSub}>the algo found your people in boston. say you&apos;re in — then it&apos;s group-chat o&apos;clock.</p>
        </div>

        <div className={styles.joinWrap}>
          <button className={styles.joinBtn}>I&apos;M IN — OPEN THE GROUP CHAT →</button>
        </div>

        <h2 className={styles.sectionLabel}>🎒 your crew</h2>
        <div className={styles.grid}>
          {CREW.map((c) => (
            <div key={c.name} className={styles.card}>
              <button className={styles.optOut} aria-label="opt out">✕</button>
              <div style={{ position: 'relative' }}>
                <img src={c.img} alt="" className={styles.photo} />
                <span className={styles.scoreBadge}>{c.score}%</span>
              </div>
              <div className={styles.cardName}>{c.name} <span>· {c.age}</span></div>
              <div className={styles.cardArch}>{c.arch}</div>
              <div className={styles.chips}>
                {c.chips.map((ch) => <span key={ch} className={styles.chip}>{ch}</span>)}
              </div>
            </div>
          ))}
        </div>

        <h2 className={styles.sectionLabel}>💬 the group chat</h2>
        <div className={styles.chat}>
          <div className={styles.chatHead}>your crew · 5 people</div>
          <div className={styles.chatBody}>
            {MSGS.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.me ? styles.msgMe : ''}`}>
                <img src={m.img} alt="" className={styles.avatar} />
                <div className={styles.bubble}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className={styles.chatInput}>
            <input placeholder="say something to the crew…" readOnly />
            <button>→</button>
          </div>
        </div>

        <div className={styles.endRow}>
          <button className={styles.endBtn}>exit chat / end matches</button>
        </div>
      </div>
    </div>
  );
}
