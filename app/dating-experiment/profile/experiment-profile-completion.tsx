'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChipInput from '@/app/profile/chip-input';
import { compressImage } from '@/lib/compress-image';
import { experimentProfileReadiness, type ExperimentProfileInput } from '@/lib/experiment-profile';
import styles from './experiment-profile.module.css';

type Profile = ExperimentProfileInput & {
  age: number | null;
  photo_url: string | null;
  archetype: string | null;
  score_honesty: number | null;
  bio: string;
  hobbies: string[];
  music: string[];
  food: string[];
  sports: string[];
};

export default function ExperimentProfileCompletion({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fieldsShown = useMemo(
    () => new Set(experimentProfileReadiness(initialProfile).missing.map((item) => item.key)),
    [initialProfile],
  );
  const readiness = experimentProfileReadiness(profile);
  const existingOtherInterests = profile.music.length + profile.food.length + profile.sports.length;

  useEffect(() => {
    fetch('/api/campaign/dating-experiment-funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'profile_started' }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setUploading(true);
    setMessage('');
    try {
      const file = await compressImage(picked);
      if (file.size > 4 * 1024 * 1024) throw new Error('That photo is still over 4MB. Try a different photo.');
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/profile/photo', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Photo upload failed.');
      setProfile((current) => ({ ...current, photo_url: data.url }));
      setMessage('Photo added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function saveAndContinue(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updates: Record<string, unknown> = {
        bio: profile.bio,
        hobbies: profile.hobbies,
      };
      if (typeof profile.age === 'number' && Number.isInteger(profile.age)) updates.age = profile.age;
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-NotCupid-Funnel': 'dating-experiment-comeback',
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');

      const saved = data.user as Profile;
      setProfile(saved);
      const next = experimentProfileReadiness(saved);
      if (next.complete) {
        setMessage('Profile ready. Opening the Dating Experiment…');
        router.push('/dating-experiment?from=profile-complete');
        return;
      }
      if (next.missing.length === 1 && next.missing[0].key === 'quiz') {
        setMessage('Profile saved. One quick quiz next…');
        router.push('/quiz?next=experiment');
        return;
      }
      setMessage(`Saved. Still add ${next.missing.map((item) => item.label).join(', ')}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/hub" className={styles.wordmark}><span>Not</span>Cupid</Link>
          <Link href="/dating-experiment" className={styles.back}>not now</Link>
        </nav>

        <header className={styles.hero}>
          <div className={styles.eyebrow}>🎟️ Dating Experiment · quick profile finish</div>
          <h1>only add what’s <em>missing.</em></h1>
          <p>We’re keeping your current NotCupid profile. Finish these few basics, then you’ll go straight to dinner preferences and entry.</p>
          <div className={styles.progress} aria-label={`${readiness.requirements.filter((item) => item.ready).length} of ${readiness.requirements.length} profile requirements complete`}>
            {readiness.requirements.map((item) => (
              <span key={item.key} className={item.ready ? styles.progressDone : ''}>{item.ready ? '✓' : '·'} {item.key}</span>
            ))}
          </div>
        </header>

        <form onSubmit={saveAndContinue} className={styles.form}>
          {fieldsShown.has('photo') && (
            <section className={styles.card}>
              <div className={styles.cardTop}><span>01</span><b>one clear profile photo</b>{profile.photo_url && <i>✓ added</i>}</div>
              <p>This is the first photo a private shortlist sees.</p>
              <div className={styles.photoRow}>
                {profile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photo_url} alt="Your profile" className={styles.photo} />
                ) : <div className={styles.photoEmpty} aria-hidden>✦</div>}
                <label className={styles.uploadButton}>
                  {uploading ? 'preparing photo…' : profile.photo_url ? 'change photo' : 'choose photo'}
                  <input type="file" accept="image/*" onChange={uploadPhoto} disabled={uploading} />
                </label>
              </div>
            </section>
          )}

          {fieldsShown.has('bio') && (
            <section className={styles.card}>
              <label htmlFor="experiment-bio" className={styles.cardTop}><span>02</span><b>a short bio</b>{profile.bio.trim() && <i>✓ ready</i>}</label>
              <p>One or two specific sentences are enough. Give someone an easy reason to ask a question.</p>
              <textarea
                id="experiment-bio"
                value={profile.bio}
                maxLength={500}
                rows={4}
                onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                placeholder="I know the best dumpling spot in Boston, and I’m always planning my next weekend trip…"
              />
              <small>{profile.bio.length}/500</small>
            </section>
          )}

          {fieldsShown.has('interests') && (
            <section className={styles.card}>
              <div className={styles.cardTop}><span>03</span><b>three things you’re into</b>{readiness.interests >= 3 && <i>✓ ready</i>}</div>
              <p>Add hobbies, places, food, music—anything that makes conversation easier. Press Enter after each one.</p>
              {existingOtherInterests > 0 && <div className={styles.already}>You already have {existingOtherInterests} saved elsewhere on your profile.</div>}
              <ChipInput
                value={profile.hobbies}
                onChange={(hobbies) => setProfile((current) => ({ ...current, hobbies }))}
                placeholder="run clubs, ramen, live music"
                maxItems={12}
                variant="mix"
              />
              <small>{Math.min(readiness.interests, 3)}/3 ready</small>
            </section>
          )}

          {fieldsShown.has('age') && (
            <section className={styles.card}>
              <label htmlFor="experiment-age" className={styles.cardTop}><span>04</span><b>confirm you’re 21+</b>{typeof profile.age === 'number' && profile.age >= 21 && <i>✓ ready</i>}</label>
              <p>This Boston dinner round is for people age 21 and over.</p>
              <input
                id="experiment-age"
                className={styles.ageInput}
                type="number"
                inputMode="numeric"
                min={21}
                max={100}
                value={profile.age ?? ''}
                onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value ? Number(event.target.value) : null }))}
                placeholder="age"
              />
            </section>
          )}

          {fieldsShown.has('quiz') && (
            <section className={styles.card}>
              <div className={styles.cardTop}><span>05</span><b>personality quiz</b></div>
              <p>This is the core compatibility signal. Your other updates will stay saved while you finish it.</p>
              <Link href="/quiz?next=experiment" className={styles.quizButton}>take the quiz →</Link>
            </section>
          )}

          {message && <div role="status" className={styles.message}>{message}</div>}
          <div className={styles.stickyAction}>
            <button type="submit" disabled={saving || uploading}>
              {saving ? 'saving…' : readiness.complete ? 'continue to the experiment →' : 'save & continue →'}
            </button>
            <span>No video or paid upgrade is required.</span>
          </div>
        </form>
      </div>
    </main>
  );
}
