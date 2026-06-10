'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './profile.module.css';
import { ARCHETYPES, VIBE_HEADS, vibeLabel, relationshipStyleLabel } from '@/lib/quiz-data';
import type { VibeKey } from '@/lib/quiz-data';

export default function ProfileDashboard({ user, onEdit, onLogout }: {
  user: any;
  onEdit: () => void;
  onLogout: () => void;
}) {
  const [stats, setStats] = useState<{ total: number; accepted: number; active: number; live: number; matched: number; pending: number } | null>(null);
  useEffect(() => {
    fetch('/api/profile/stats').then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, []);

  const archetypeMeta = ARCHETYPES.find(a => a.name === user.archetype);
  const firstName = (user.name || 'friend').split(' ')[0];
  const heightFt = user.height_cm ? Math.floor(user.height_cm / 30.48) : null;
  const heightIn = user.height_cm ? Math.round((user.height_cm / 2.54) % 12) : null;
  // typeof check, NOT falsy: with the 12-question quiz (2/dim) a legit 0 on a
  // dimension is common — `!user.score_honesty` told quiz-finishers to retake.
  const needsQuiz = !user.archetype || typeof user.score_honesty !== 'number';

  const tags: Array<{ label: string; items: string[]; variant: 'lav' | 'accent' }> = [
    { label: 'Music', items: user.music || [], variant: 'lav' },
    { label: 'Food', items: user.food || [], variant: 'accent' },
    { label: 'Obsessions', items: user.hobbies || [], variant: 'lav' },
  ];

  const seekingLabel = user.seeking === 'm' ? 'men' : user.seeking === 'f' ? 'women' : user.seeking === 'both' ? 'anyone' : '—';
  const genderLabel = user.gender === 'm' ? 'man' : user.gender === 'f' ? 'woman' : user.gender === 'nb' ? 'non-binary' : user.gender === 'o' ? 'other' : '—';

  // HEXACO dimension bars — raw scores are 0–16 (4 questions × 4pts). Show as
  // a percentage fill so users see their personality breakdown, not just the
  // archetype label.
  const HEXACO_MAX = 8;
  const hexaco: Array<{ label: string; score: number }> = [
    { label: 'Honesty', score: user.score_honesty },
    { label: 'Emotionality', score: user.score_emotionality },
    { label: 'Extraversion', score: user.score_extraversion },
    { label: 'Agreeableness', score: user.score_agreeableness },
    { label: 'Conscientiousness', score: user.score_conscientiousness },
    { label: 'Openness', score: user.score_openness },
  ].filter((d) => typeof d.score === 'number');

  return (
    <div className={styles.dash}>
      {/* HERO */}
      <div className={styles.dashHero}>
        <div className={styles.dashHeroLeft}>
          <div className={styles.dashGreet}>hi <em>{firstName.toLowerCase()}.</em></div>
          <div className={styles.dashEyebrow}>your profile · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()}</div>
          {user.archetype && (
            <div className={styles.dashArchetype}>
              <span className={styles.dashArchetypeKick}>you are the</span>
              <span className={styles.dashArchetypeName}>{user.archetype}</span>
              {archetypeMeta?.tag && <span className={styles.dashArchetypeTag}>{archetypeMeta.tag}</span>}
              {archetypeMeta?.desc && <span className={styles.dashArchetypeDesc}>{archetypeMeta.desc}</span>}
            </div>
          )}
        </div>
        <div className={styles.dashHeroRight}>
          <div className={styles.dashPhotoWrap}>
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className={styles.dashPhoto} />
            ) : (
              <button type="button" onClick={onEdit} className={styles.dashPhotoEmpty} aria-label="Add a photo">
                <span>add a photo →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {needsQuiz && (
        <div className={styles.dashBanner}>
          <span><em>finish the quiz</em> to unlock matching</span>
          <Link href="/quiz?retake=1" className={styles.dashBannerBtn}>take the quiz</Link>
        </div>
      )}

      {/* QUICK STATS GRID */}
      <div className={styles.dashStats}>
        <Link href="/dashboard" className={styles.dashStatCard}>
          <div className={styles.dashStatIcon}>💘</div>
          <div className={styles.dashStatLabel}>your matches</div>
          {stats !== null ? (
            <div className={styles.dashStatNum}>
              {stats.live > 0
                ? <><strong>{stats.live}</strong> active chat{stats.live > 1 ? 's' : ''}</>
                : stats.matched > 0
                  ? <><strong>{stats.matched}</strong> new match — say hi →</>
                  : stats.pending > 0
                    ? <><strong>{stats.pending}</strong> waiting on you</>
                    : <>in the queue · <em>searching</em> →</>}
            </div>
          ) : <div className={styles.dashStatHint}>view →</div>}
        </Link>
        <Link href="/profile/preview" className={styles.dashStatCard}>
          <div className={styles.dashStatIcon}>👁</div>
          <div className={styles.dashStatLabel}>preview</div>
          <div className={styles.dashStatHint}>what others see →</div>
        </Link>
        <button type="button" onClick={onEdit} className={`${styles.dashStatCard} ${styles.dashStatCardCta}`}>
          <div className={styles.dashStatIcon}>✎</div>
          <div className={styles.dashStatLabel}>edit profile</div>
          <div className={styles.dashStatHint}>update →</div>
        </button>
      </div>

      {/* BIO PULLQUOTE */}
      {user.bio ? (
        <div className={styles.dashBioCard}>
          <div className={styles.dashSectionLabel}>about you</div>
          <p className={styles.dashBio}>
            <span className={styles.dashBioQuote}>“</span>
            {user.bio}
            <span className={styles.dashBioQuote}>”</span>
          </p>
        </div>
      ) : (
        <div className={styles.dashEmpty} onClick={onEdit}>
          <div className={styles.dashSectionLabel}>about you</div>
          <p className={styles.dashEmptyText}>no bio yet — <em>click to add one</em></p>
        </div>
      )}

      {/* BASICS STRIP */}
      <div className={styles.dashBasics}>
        <div className={styles.dashSectionLabel}>the basics</div>
        <div className={styles.dashBasicsGrid}>
          {user.age && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>age</span><span className={styles.dashBasicV}>{user.age}</span></div>}
          {user.height_cm && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>height</span><span className={styles.dashBasicV}>{heightFt}'{heightIn}"</span></div>}
          {user.zip && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>zip</span><span className={styles.dashBasicV}>{user.zip}</span></div>}
          {user.gender && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>identity</span><span className={styles.dashBasicV}>{genderLabel}</span></div>}
          {user.seeking && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>seeking</span><span className={styles.dashBasicV}>{seekingLabel}</span></div>}
          {user.relationship_style && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>style</span><span className={styles.dashBasicV}>{relationshipStyleLabel(user.relationship_style)}</span></div>}
          {user.occupation && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>work</span><span className={styles.dashBasicV}>{user.occupation}</span></div>}
          {user.education && <div className={styles.dashBasicItem}><span className={styles.dashBasicK}>school</span><span className={styles.dashBasicV}>{user.education}</span></div>}
        </div>
      </div>

      {/* QUIZ VIBES (lifestyle compat dimensions) */}
      {user.vibes && typeof user.vibes === 'object' && Object.keys(user.vibes).length > 0 && (
        <div className={styles.dashVibes}>
          <div className={styles.dashSectionLabel}>your rhythm</div>
          <div className={styles.dashTagList}>
            {(Object.keys(VIBE_HEADS) as VibeKey[]).map((k) => {
              const score = user.vibes[k];
              const label = vibeLabel(k, score);
              if (!label) return null;
              return (
                <span
                  key={k}
                  className={styles.dashTag}
                  style={{ background: 'rgba(37,99,255,0.13)', color: '#1b46c9', borderColor: 'rgba(37,99,255,0.35)' }}
                >
                  <span style={{ opacity: 0.55, marginRight: '0.4rem', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{VIBE_HEADS[k]}</span>
                  {label}
                </span>
              );
            })}
          </div>
          {Object.keys(user.vibes).length < 6 && (
            <p style={{fontFamily:"Georgia,ui-serif,serif",fontStyle:"italic",fontSize:".82rem",color:"#2563ff",marginTop:".75rem"}}>
              <a href="/quiz?retake=1" style={{color:"#1b46c9",textDecoration:"underline",textUnderlineOffset:"3px"}}>finish the vibes section →</a>
            </p>
          )}
        </div>
      )}

      {!user.vibes && (
        <div className={styles.dashEmpty} onClick={() => (window.location.href = '/quiz?retake=1')}>
          <div className={styles.dashSectionLabel}>your rhythm</div>
          <p className={styles.dashEmptyText}>
            we upgraded the algo — <em>take the new 6-question vibes round</em> to get re-matched.
          </p>
        </div>
      )}

      {/* HEXACO PERSONALITY BARS */}
      {hexaco.length > 0 && (
        <div className={styles.dashVibes}>
          <div className={styles.dashSectionLabel}>your personality</div>
          <div className={styles.hexacoList}>
            {hexaco.map((d) => {
              const pct = Math.round((d.score / HEXACO_MAX) * 100);
              return (
                <div key={d.label} className={styles.hexacoRow}>
                  <span className={styles.hexacoLabel}>{d.label}</span>
                  <span className={styles.hexacoTrack}>
                    <span className={styles.hexacoFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.hexacoPct}>{pct}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INTEREST TAGS (music / food / hobbies) */}
      {tags.some(t => t.items.length > 0) && (
        <div className={styles.dashVibes}>
          <div className={styles.dashSectionLabel}>your vibes</div>
          {tags.map(t => t.items.length > 0 && (
            <div key={t.label} className={styles.dashTagRow}>
              <div className={styles.dashTagHead}>{t.label.toLowerCase()}</div>
              <div className={styles.dashTagList}>
                {t.items.map((item, i) => (
                  <span
                    key={`${item}-${i}`}
                    className={styles.dashTag}
                    style={
                      t.variant === 'lav'
                        ? { background: 'rgba(37,99,255,0.13)', color: '#1b46c9', borderColor: 'rgba(37,99,255,0.35)' }
                        : { background: '#e8edff', color: '#0e0c1a', borderColor: 'rgba(14,12,26,0.13)' }
                    }
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MATCH PREFERENCES */}
      <div className={styles.dashPrefs}>
        <div className={styles.dashSectionLabel}>match preferences</div>
        <div className={styles.dashPrefRow}>
          <span>age range</span>
          <span className={styles.dashPrefVal}>{user.age_min || '—'} → {user.age_max || '—'}</span>
        </div>
      </div>

      {/* ACCOUNT FOOTER */}
      <div className={styles.dashFooter}>
        <button type="button" onClick={onEdit} className={styles.dashEditBtn}>edit profile</button>
        <button type="button" onClick={onLogout} className={styles.dashLogout}>log out</button>
      </div>
    </div>
  );
}
