'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileDashboard from './profile-dashboard';
import ProfileForm from './profile-form';

export default function ProfileShell({
  initialUser,
  startEditing = false,
  relaunchMode = false,
}: {
  initialUser: any;
  startEditing?: boolean;
  relaunchMode?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [mode, setMode] = useState<'view' | 'edit'>(startEditing ? 'edit' : 'view');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (mode === 'edit') {
    return (
      <ProfileForm
        initialUser={user}
        relaunchMode={relaunchMode}
        onSaved={(u) => {
          setUser(u);
          if (relaunchMode) {
            router.push('/dashboard?from=profile-relaunch');
          } else {
            setMode('view');
          }
        }}
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
