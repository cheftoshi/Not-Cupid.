'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileDashboard from './profile-dashboard';
import ProfileForm from './profile-form';
import { experimentProfileReadiness } from '@/lib/experiment-profile';

export default function ProfileShell({
  initialUser,
  startEditing = false,
  relaunchMode = false,
  experimentMode = false,
}: {
  initialUser: any;
  startEditing?: boolean;
  relaunchMode?: boolean;
  experimentMode?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [mode, setMode] = useState<'view' | 'edit'>(startEditing ? 'edit' : 'view');

  useEffect(() => {
    if (experimentMode && experimentProfileReadiness(initialUser).complete) {
      router.replace('/dating-experiment?from=profile-ready');
    }
  }, [experimentMode, initialUser, router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (mode === 'edit') {
    return (
      <ProfileForm
        initialUser={user}
        relaunchMode={relaunchMode}
        experimentMode={experimentMode}
        onSaved={(u) => {
          setUser(u);
          if (experimentMode) {
            if (experimentProfileReadiness(u).complete) {
              router.push('/dating-experiment?from=profile-complete');
            }
          } else if (relaunchMode) {
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
