import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ARCHETYPES } from '@/lib/quiz-data';
import Link from 'next/link';
import styles from './preview.module.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePreviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  const heightFt = user.height_cm ? Math.floor(user.height_cm / 30.48) : null;
  const heightIn = user.height_cm ? Math.round((user.height_cm / 2.54) % 12) : null;
  const arche = ARCHETYPES.find((a) => a.name === user.archetype);

  const tagRows: Array<{ label: string; items: string[]; variant: 'lav' | 'accent' }> = [
    { label: 'sounds like', items: user.music || [], variant: 'lav' },
    { label: 'tastes like', items: user.food || [], variant: 'accent' },
    { label: 'obsessions', items: user.hobbies || [], variant: 'lav' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.banner}>
          <span><em>preview mode</em> — this is what your matches see</span>
          <Link href="/profile" className={styles.editLink}>← back</Link>
        </div>

        <article className={styles.mag}>
          {/* COVER */}
          <header className={styles.cover}>
            <div className={styles.coverEyebrow}>
              <span>notcupid · issue {String(user.id || '').slice(0, 4).toUpperCase() || '0001'}</span>
              <span>boston · ma</span>
            </div>
            <h1 className={styles.coverName}>
              {user.name || 'No name yet'}
              {user.age && <span className={styles.coverAge}>, {user.age}</span>}
            </h1>
            {(user.zip || user.height_cm) && (
              <div className={styles.coverMeta}>
                {user.zip && <span>📍 {user.zip}</span>}
                {user.height_cm && <span>{heightFt}'{heightIn}"</span>}
              </div>
            )}
          </header>

          {/* PHOTO */}
          <div className={styles.photoWrap}>
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className={styles.photo} />
            ) : (
              <div className={styles.photoEmpty}>no photo</div>
            )}
          </div>

          {/* ARCHETYPE BAND */}
          {user.archetype && (
            <section className={styles.archeBand}>
              <div className={styles.archeKick}>they are the</div>
              <div className={styles.archeName}>{user.archetype}</div>
              {arche?.tag && <div className={styles.archeTag}>{arche.tag}</div>}
              {arche?.desc && <p className={styles.archeDesc}>{arche.desc}</p>}
            </section>
          )}

          {/* BIO PULLQUOTE */}
          {user.bio && (
            <section className={styles.bioBlock}>
              <span className={styles.bioQ}>“</span>
              <p className={styles.bioText}>{user.bio}</p>
              <span className={styles.bioQEnd}>”</span>
            </section>
          )}

          {/* WORK / EDU */}
          {(user.occupation || user.education) && (
            <section className={styles.workRow}>
              {user.occupation && (
                <div className={styles.workItem}>
                  <span className={styles.workK}>does</span>
                  <span className={styles.workV}>{user.occupation}</span>
                </div>
              )}
              {user.education && (
                <div className={styles.workItem}>
                  <span className={styles.workK}>studied at</span>
                  <span className={styles.workV}>{user.education}</span>
                </div>
              )}
            </section>
          )}

          {/* VIBES */}
          {tagRows.some((r) => r.items.length > 0) && (
            <section className={styles.vibeSection}>
              <div className={styles.vibeHead}>· vibes ·</div>
              {tagRows.map(
                (r) =>
                  r.items.length > 0 && (
                    <div key={r.label} className={styles.vibeRow}>
                      <div className={styles.vibeLabel}>{r.label}</div>
                      <div className={styles.vibeTags}>
                        {r.items.map((v, i) => (
                          <span
                            key={`${v}-${i}`}
                            className={styles.vibeTag}
                            style={
                              r.variant === 'lav'
                                ? { background: 'rgba(139,127,212,0.13)', color: '#5b4fa0', borderColor: 'rgba(139,127,212,0.35)' }
                                : { background: '#ede9ff', color: '#0e0c1a', borderColor: 'rgba(14,12,26,0.13)' }
                            }
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </section>
          )}

          <footer className={styles.colophon}>
            <span>notcupid.com</span>
            <span>the algo decided.</span>
          </footer>
        </article>

        <div className={styles.footer}>
          <Link href="/profile" className={styles.backButton}>back to dashboard →</Link>
        </div>
      </div>
    </div>
  );
}
