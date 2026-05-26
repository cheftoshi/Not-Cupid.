import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import styles from './preview.module.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePreviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  const heightFt = user.height_cm ? Math.floor(user.height_cm / 30.48) : null;
  const heightIn = user.height_cm ? Math.round((user.height_cm / 2.54) % 12) : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.banner}>
          <span><em>preview mode</em> — this is what your matches see</span>
          <Link href="/profile" className={styles.editLink}>← back to edit</Link>
        </div>

        <div className={styles.card}>
          <div className={styles.photoWrap}>
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className={styles.photo} />
            ) : (
              <div className={styles.photoEmpty}>no photo</div>
            )}
          </div>

          <h1 className={styles.name}>
            {user.name || 'No name yet'}
            {user.age ? <span className={styles.age}>, {user.age}</span> : null}
          </h1>

          {(user.zip || user.height_cm) && (
            <div className={styles.meta}>
              {user.zip && <span>📍 {user.zip}</span>}
              {user.height_cm && <span>{heightFt}'{heightIn}"</span>}
            </div>
          )}

          {user.archetype && (
            <div className={styles.archetype}>
              <div className={styles.archetypeLabel}>personality type</div>
              <div className={styles.archetypeName}>{user.archetype}</div>
            </div>
          )}

          {user.bio && <p className={styles.bio}>{user.bio}</p>}

          {(user.occupation || user.education) && (
            <div className={styles.workEdu}>
              {user.occupation && <div className={styles.workEduItem}><span>💼</span> {user.occupation}</div>}
              {user.education && <div className={styles.workEduItem}><span>🎓</span> {user.education}</div>}
            </div>
          )}

          {user.music && user.music.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Music</div>
              <div className={styles.tags}>
                {user.music.map((m: string) => <span key={m} className={styles.tag}>{m}</span>)}
              </div>
            </div>
          )}

          {user.food && user.food.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Food</div>
              <div className={styles.tags}>
                {user.food.map((f: string) => <span key={f} className={styles.tag}>{f}</span>)}
              </div>
            </div>
          )}

          {user.hobbies && user.hobbies.length > 0 && (
            <div className={styles.tagSection}>
              <div className={styles.tagLabel}>→ Hobbies & obsessions</div>
              <div className={styles.tags}>
                {user.hobbies.map((h: string) => <span key={h} className={styles.tag}>{h}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Link href="/profile" className={styles.backButton}>back to edit</Link>
        </div>
      </div>
    </div>
  );
}
