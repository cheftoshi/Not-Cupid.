import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isPro } from '@/lib/pro';
import ProClient from './pro-client';
import { recordMonetizationEvent } from '@/lib/monetization';

export const dynamic = 'force-dynamic';

export default async function ProPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/pro');
  const pro = isPro(user);
  if (!pro && !(user as any).is_test) {
    await recordMonetizationEvent({
      userId: user.id,
      event: 'paywall_viewed',
      product: 'pro',
      surface: 'pro_page',
      amountCents: 399,
    });
  }
  const until = user.friend_pro_until ? new Date(user.friend_pro_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;
  return <ProClient pro={pro} renewsOn={until} />;
}
