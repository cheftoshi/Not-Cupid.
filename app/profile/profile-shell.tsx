'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileDashboard from './profile-dashboard';
import ProfileForm from './profile-form';

export default function ProfileShell({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (mode === 'edit') {
    return (
      <ProfileForm
        initialUser={user}
        onSaved={(u) => { setUser(u); setMode('view'); }}
        onCancel={() => setMode('view')}
      />
    );
  }

  return (
    <ProfileDashboard
      user={user}
      onEdit={() => setMode('edit')}
      onLogout={handleLogout}
    />
  );
}
