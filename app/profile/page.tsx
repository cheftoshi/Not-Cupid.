import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ProfileForm from './profile-form';
import styles from './profile.module.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const firstName = (user.name || 'friend').split(' ')[0];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <div className={styles.navBrand}>not<span>cupid.</span></div>
          <a href="/profile" className={`${styles.navLink} ${styles.navLinkActive}`}>Profile</a>
          <a href="/quiz" className={styles.navLink}>Quiz</a>
          <a href="/dashboard" className={styles.navLink}>Matches</a>
        </nav>
        <h1 className={styles.title}>
          Hi <span className={styles.titleAccent}>{firstName}</span>.
        </h1>
        <p className={styles.subtitle}>This is what your matches will see.</p>
        <ProfileForm initialUser={user} />
      </div>
    </div>
  );
}
