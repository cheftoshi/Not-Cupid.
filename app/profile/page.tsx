import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ProfileForm from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
        <p className="text-gray-400 mb-8">This is what your matches will see.</p>
        <ProfileForm initialUser={user} />
      </div>
    </div>
  );
}
