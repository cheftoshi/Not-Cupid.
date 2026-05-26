'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileForm({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const arrayToString = (arr: string[] | null | undefined) => arr?.join(', ') || '';
  const stringToArray = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

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
      setMessage('✓ Saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Error saving');
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
      setMessage('✓ Photo updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete your account? This will end all active matches and cannot be undone.')) return;
    if (!confirm('Really sure? Type-check: this will remove you from NotCupid permanently.')) return;
    try {
      await fetch('/api/profile/delete', { method: 'POST' });
      router.push('/');
    } catch {
      setMessage('Delete failed');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const inputClass = "w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-white transition";
  const labelClass = "block text-sm mb-1 text-gray-300";

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* PHOTO */}
      <section className="space-y-3">
        <div className="flex items-center gap-4">
          {user.photo_url ? (
            <img src={user.photo_url} alt="Profile" className="w-28 h-28 rounded-full object-cover border-2 border-gray-700" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-gray-500 text-sm">
              No photo
            </div>
          )}
          <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-full text-sm hover:bg-gray-200 transition font-medium">
            {uploadingPhoto ? 'Uploading...' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
      </section>

      {/* BASICS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Basics</h2>
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} type="text" value={user.name || ''} onChange={e => setUser({ ...user, name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Email (locked)</label>
          <input className={`${inputClass} opacity-50`} type="email" value={user.email || ''} disabled />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Age</label>
            <input className={inputClass} type="number" min={18} max={100} value={user.age || ''} onChange={e => setUser({ ...user, age: parseInt(e.target.value) || null })} />
          </div>
          <div>
            <label className={labelClass}>Height (cm)</label>
            <input className={inputClass} type="number" min={120} max={250} value={user.height_cm || ''} onChange={e => setUser({ ...user, height_cm: parseInt(e.target.value) || null })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Gender</label>
            <select className={inputClass} value={user.gender || ''} onChange={e => setUser({ ...user, gender: e.target.value })}>
              <option value="">Select</option>
              <option value="m">Man</option>
              <option value="f">Woman</option>
              <option value="nb">Non-binary</option>
              <option value="o">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Seeking</label>
            <select className={inputClass} value={user.seeking || ''} onChange={e => setUser({ ...user, seeking: e.target.value })}>
              <option value="">Select</option>
              <option value="m">Men</option>
              <option value="f">Women</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>ZIP code</label>
          <input className={inputClass} type="text" value={user.zip || ''} onChange={e => setUser({ ...user, zip: e.target.value })} />
        </div>
      </section>

      {/* ABOUT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">About You</h2>
        <div>
          <label className={labelClass}>Bio</label>
          <textarea className={inputClass} value={user.bio || ''} onChange={e => setUser({ ...user, bio: e.target.value })} rows={4} maxLength={500} placeholder="Tell people what makes you, you." />
          <div className="text-xs text-gray-500 mt-1">{(user.bio || '').length}/500</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Occupation</label>
            <input className={inputClass} type="text" value={user.occupation || ''} onChange={e => setUser({ ...user, occupation: e.target.value })} placeholder="What you do" />
          </div>
          <div>
            <label className={labelClass}>Education</label>
            <input className={inputClass} type="text" value={user.education || ''} onChange={e => setUser({ ...user, education: e.target.value })} placeholder="Where you studied" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Music (comma-separated)</label>
          <input className={inputClass} type="text" value={arrayToString(user.music)} onChange={e => setUser({ ...user, music: stringToArray(e.target.value) })} placeholder="indie rock, jazz, taylor swift" />
        </div>
        <div>
          <label className={labelClass}>Food (comma-separated)</label>
          <input className={inputClass} type="text" value={arrayToString(user.food)} onChange={e => setUser({ ...user, food: stringToArray(e.target.value) })} placeholder="thai, pizza, sushi" />
        </div>
        <div>
          <label className={labelClass}>Hobbies (comma-separated)</label>
          <input className={inputClass} type="text" value={arrayToString(user.hobbies)} onChange={e => setUser({ ...user, hobbies: stringToArray(e.target.value) })} placeholder="hiking, photography, board games" />
        </div>
      </section>

      {/* PREFERENCES */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Match Preferences</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Min age</label>
            <input className={inputClass} type="number" min={18} max={100} value={user.age_min || ''} onChange={e => setUser({ ...user, age_min: parseInt(e.target.value) || null })} />
          </div>
          <div>
            <label className={labelClass}>Max age</label>
            <input className={inputClass} type="number" min={18} max={100} value={user.age_max || ''} onChange={e => setUser({ ...user, age_max: parseInt(e.target.value) || null })} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={user.auto_rematch || false} onChange={e => setUser({ ...user, auto_rematch: e.target.checked })} />
          <span className="text-sm">Auto-rematch me when a match ends</span>
        </label>
      </section>

      {/* PERSONALITY */}
      {user.archetype && (
        <section className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-1">Your Personality Type</h2>
          <p className="text-2xl font-bold">{user.archetype}</p>
        </section>
      )}

      {/* SAVE BAR */}
      <div className="flex items-center gap-4 sticky bottom-0 bg-black py-4 border-t border-gray-800 -mx-4 px-4">
        <button type="submit" disabled={saving} className="bg-white text-black px-6 py-2 rounded-full font-medium disabled:opacity-50 hover:bg-gray-200 transition">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {message && <span className="text-sm">{message}</span>}
      </div>

      {/* ACCOUNT */}
      <section className="border-t border-gray-800 pt-6 space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <button type="button" onClick={handleLogout} className="text-sm text-gray-400 hover:text-white block">
          Log out
        </button>
        <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:text-red-400 block">
          Delete account
        </button>
      </section>
    </form>
  );
}
