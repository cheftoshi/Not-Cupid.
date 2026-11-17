import Link from 'next/link';
import Wordmark from './wordmark';
import styles from './public-header.module.css';

export default function PublicHeader({ focused = false }: { focused?: boolean }) {
  return <header className={`${styles.header} ${focused ? styles.fixed : ''}`}>
    <Wordmark href={focused ? undefined : "/"} size={1.6} />
    {!focused && <nav aria-label="Main navigation" className={styles.links}>
      <Link className={styles.secondary} prefetch={false} href="/friend-line">Friendship</Link>
      <Link className={styles.secondary} prefetch={false} href="/how-it-works">How it works</Link>
      <Link className={styles.login} prefetch={false} href="/login">Log in ↗</Link>
    </nav>}
  </header>;
}
