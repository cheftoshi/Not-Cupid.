import { getCurrentUser } from '@/lib/auth';
import FriendMaxxinClient from './friend-client';

export const dynamic = 'force-dynamic';

export default async function FriendMaxxinPage() {
  const user = await getCurrentUser();
  return <FriendMaxxinClient
    authed={!!user}
    onWaitlist={!!user?.friend_waitlist_at}
  />;
}
