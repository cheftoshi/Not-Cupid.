import styles from './app-loading.module.css';

export default function AppLoading({ surface }: { surface: 'hub' | 'love' | 'friend' }) {
  const hub = surface === 'hub';
  return (
    <main className={`${styles.shell} ${hub ? styles.hub : ''}`} aria-busy="true" aria-label={`Loading ${surface}`}>
      <p role="status" className={styles.status}>Opening your {surface === 'love' ? 'Love Line' : surface}…</p>
      <div aria-hidden="true" className={styles.content}>
        <div className={styles.heading} />
        {hub ? <><div className={styles.brief} /><div className={styles.space} /><div className={styles.composer} /></> : (
          <><div className={styles.row} /><div className={styles.row} /><div className={styles.cards}>{[0, 1, 2].map(i => <div key={i} className={styles.card} />)}</div></>
        )}
      </div>
    </main>
  );
}
