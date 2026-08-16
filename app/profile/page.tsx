import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ProfileShell from './profile-shell';
import Wordmark from '@/components/wordmark';
import styles from './profile.module.css';
import { withPrivateVideoPreview } from '@/lib/private-media';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; from?: string }>;
}) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
  const user = currentUser ? await withPrivateVideoPreview(currentUser) : null;
  if (!user) redirect('/login?next=/profile');
  if (!user.archetype) redirect('/quiz');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <Wordmark size={1.15} href="/hub" />
          <div className={styles.navLinks}>
            <a href="/profile" className={`${styles.navLink} ${styles.navLinkActive}`}>Profile</a>
            <a href="/profile/preview" className={styles.navLink}>Preview</a>
            <a href="/dashboard" className={styles.navLink}>Matches</a>
            <a href="/quiz?retake=1" className={styles.navLink}>Retake quiz</a>
          </div>
        </nav>
        <ProfileShell
          initialUser={user}
          startEditing={params.mode === 'edit' || params.from === 'dating-experiment-comeback'}
          relaunchMode={params.from === 'welcome-back'}
          experimentMode={params.from === 'dating-experiment-comeback'}
        />
      </div>
    </div>
  );
}
