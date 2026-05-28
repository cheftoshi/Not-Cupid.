'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './profile.module.css';
import ChipInput from './chip-input';

type Props = {
  initialUser: any;
  onSaved?: (user: any) => void;
  onCancel?: () => void;
};

export default function ProfileForm({ initialUser, onSaved, onCancel }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const needsQuiz = !user.archetype || !user.score_honesty;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      const data = await res.json();
      setUser(data.user);
      setMessage('✓ saved');
      if (onSaved) {
        // Brief flash of confirmation, then back to the dashboard.
        setTimeout(() => onSaved(data.user), 400);
      } else {
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setMessage(err.message || 'error saving');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/profile/photo', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      setUser({ ...user, photo_url: data.url });
      setMessage('✓ photo updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete your account? Active matches will end. This cannot be undone.')) return;
    if (!confirm('Really sure? This removes you from NotCupid permanently.')) return;
    await fetch('/api/profile/delete', { method: 'POST' });
    router.push('/');
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <form onSubmit={handleSave}>
      <div className={styles.editTop}>
        <div>
          <div className={styles.editEyebrow}>edit profile</div>
          <div className={styles.editTitle}>tune your <em>vibe.</em></div>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className={styles.editClose} aria-label="back to dashboard">
            ← back
          </button>
        )}
      </div>

      {needsQuiz && (
        <div className={styles.quizBanner}>
          <div className={styles.quizBannerText}>
            Take the personality quiz to find your match — it's how the algo decides.
          </div>
          <a href="/quiz" className={styles.quizBannerButton}>Take the quiz</a>
        </div>
      )}

      {/* PHOTO */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>01 — Your face</div>
        <div className={styles.photoSection}>
          <div className={styles.photoFrame}>
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className={styles.photo} />
            ) : (
              <div className={styles.photoPlaceholder}>no photo yet</div>
            )}
          </div>
          <label className={styles.uploadButton}>
            {uploadingPhoto ? 'uploading...' : (user.photo_url ? 'change photo' : 'upload photo')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      {/* BASICS */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>02 — The basics</div>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input className={styles.input} type="text" value={user.name || ''} onChange={e => setUser({ ...user, name: e.target.value })} placeholder="what to call you" />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input className={styles.input} type="email" value={user.email || ''} disabled />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Age</label>
            <input className={styles.input} type="number" min={18} max={100} value={user.age || ''} onChange={e => setUser({ ...user, age: parseInt(e.target.value) || null })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Height</label>
            <div className={styles.heightRow}>
              <div className={styles.heightField}>
                <input
                  className={styles.input}
                  type="number"
                  min={3}
                  max={8}
                  placeholder="ft"
                  value={user.height_cm ? Math.floor(user.height_cm / 30.48) : ''}
                  onChange={(e) => {
                    const ft = parseInt(e.target.value) || 0;
                    const inches = user.height_cm ? Math.round((user.height_cm / 2.54) % 12) : 0;
                    setUser({ ...user, height_cm: ft || inches ? Math.round((ft * 12 + inches) * 2.54) : null });
                  }}
                />
                <span className={styles.heightUnit}>ft</span>
              </div>
              <div className={styles.heightField}>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={11}
                  placeholder="in"
                  value={user.height_cm ? Math.round((user.height_cm / 2.54) % 12) : ''}
                  onChange={(e) => {
                    let inches = parseInt(e.target.value) || 0;
                    if (inches > 11) inches = 11;
                    if (inches < 0) inches = 0;
                    const ft = user.height_cm ? Math.floor(user.height_cm / 30.48) : 0;
                    setUser({ ...user, height_cm: ft || inches ? Math.round((ft * 12 + inches) * 2.54) : null });
                  }}
                />
                <span className={styles.heightUnit}>in</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Gender</label>
            <select className={styles.select} value={user.gender || ''} onChange={e => setUser({ ...user, gender: e.target.value })}>
              <option value="">—</option>
              <option value="m">Man</option>
              <option value="f">Woman</option>
              <option value="nb">Non-binary</option>
              <option value="o">Other</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Seeking</label>
            <select className={styles.select} value={user.seeking || ''} onChange={e => setUser({ ...user, seeking: e.target.value })}>
              <option value="">—</option>
              <option value="m">Men</option>
              <option value="f">Women</option>
              <option value="both">Anyone</option>
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>ZIP code</label>
          <input className={styles.input} type="text" value={user.zip || ''} onChange={e => setUser({ ...user, zip: e.target.value })} />
        </div>
      </div>

      {/* ABOUT */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>03 — About you</div>
        <div className={styles.field}>
          <label className={styles.label}>Bio · <span className={styles.labelHint}>the interesting stuff</span></label>
          <textarea
            className={`${styles.textarea} ${styles.textareaArt}`}
            value={user.bio || ''}
            onChange={e => setUser({ ...user, bio: e.target.value })}
            rows={5}
            maxLength={500}
            placeholder="what's the most interesting thing about you that isn't obvious from a photo?"
          />
          <div className={styles.charCount}>{(user.bio || '').length}/500</div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Occupation</label>
            <input className={styles.input} type="text" value={user.occupation || ''} onChange={e => setUser({ ...user, occupation: e.target.value })} placeholder="what you do" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Education</label>
            <input className={styles.input} type="text" value={user.education || ''} onChange={e => setUser({ ...user, education: e.target.value })} placeholder="where you studied" />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Music you love · <span className={styles.labelHint}>press enter or comma to add</span></label>
          <ChipInput value={user.music || []} onChange={(arr) => setUser({ ...user, music: arr })} placeholder="indie rock, jazz, taylor swift" variant="lav" />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Food you crave · <span className={styles.labelHint}>press enter or comma to add</span></label>
          <ChipInput value={user.food || []} onChange={(arr) => setUser({ ...user, food: arr })} placeholder="thai, pizza, sushi" variant="accent" />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Hobbies & obsessions · <span className={styles.labelHint}>press enter or comma to add</span></label>
          <ChipInput value={user.hobbies || []} onChange={(arr) => setUser({ ...user, hobbies: arr })} placeholder="hiking, pottery, conspiracy theories" variant="mix" />
        </div>
      </div>

      {/* PERSONALITY */}
      {user.archetype && (
        <div className={styles.personalityCard}>
          <div className={styles.personalityLabel}>Your personality archetype</div>
          <div className={styles.personalityType}>{user.archetype}</div>
        </div>
      )}

      {/* PREFERENCES */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>04 — Match preferences</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Min age</label>
            <input className={styles.input} type="number" min={18} max={100} value={user.age_min || ''} onChange={e => setUser({ ...user, age_min: parseInt(e.target.value) || null })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Max age</label>
            <input className={styles.input} type="number" min={18} max={100} value={user.age_max || ''} onChange={e => setUser({ ...user, age_max: parseInt(e.target.value) || null })} />
          </div>
        </div>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={user.auto_rematch || false} onChange={e => setUser({ ...user, auto_rematch: e.target.checked })} />
          <span>Auto-rematch me when a match ends</span>
        </label>
      </div>

      {/* SAVE BAR */}
      <div className={styles.saveBar}>
        <button type="submit" disabled={saving} className={styles.saveButton}>
          {saving ? 'saving...' : (onSaved ? 'save & done →' : 'save changes')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={styles.cancelButton} disabled={saving}>
            cancel
          </button>
        )}
        {message && <span className={styles.message}>{message}</span>}
      </div>

      {/* ACCOUNT */}
      <div className={styles.accountSection}>
        <div className={styles.accountTitle}>Account</div>
        <button type="button" onClick={handleLogout} className={styles.linkButton}>Log out</button>
        <button type="button" onClick={handleDelete} className={`${styles.linkButton} ${styles.linkButtonDanger}`}>Delete account</button>
      </div>
    </form>
  );
}
