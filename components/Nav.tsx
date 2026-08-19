import styles from './Nav.module.css'

export default function Nav() {
  return (
    <nav className={styles.nav}>
      <a href="/" className={styles.logo}>NOT<span>CUPID</span></a>
      <div className={styles.navR}>
        <span className={styles.navTag}>connection, without the feed</span>
        <a href="/quiz" className={styles.navBtn}>Take the quiz →</a>
      </div>
    </nav>
  )
}
