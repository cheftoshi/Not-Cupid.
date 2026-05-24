'use client'
import styles from './Nav.module.css'

export default function Nav() {
  return (
    <nav className={styles.nav}>
      <a href="/" className={styles.logo}>
        Not<span>Cupid</span>
      </a>
      <div className={styles.tag}>Boston Only · 02116</div>
    </nav>
  )
}
