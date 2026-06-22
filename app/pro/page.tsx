import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isPro } from '@/lib/pro';
import ProClient from './pro-client';

export const dynamic = 'force-dynamic';

export default async function ProPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/pro');
  const until = user.friend_pro_until ? new Date(user.friend_pro_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;
  return <ProClient pro={isPro(user)} renewsOn={until} />;
}
