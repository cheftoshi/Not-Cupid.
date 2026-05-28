import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ProfileShell from './profile-shell';
import styles from './profile.module.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <div className={styles.navBrand}>NOTCUPID</div>
          <div className={styles.navLinks}>
            <a href="/profile" className={`${styles.navLink} ${styles.navLinkActive}`}>Profile</a>
            <a href="/profile/preview" className={styles.navLink}>Preview</a>
            <a href="/dashboard" className={styles.navLink}>Matches</a>
            <a href="/quiz" className={styles.navLink}>Retake quiz</a>
          </div>
        </nav>
        <ProfileShell initialUser={user} />
      </div>
    </div>
  );
}
