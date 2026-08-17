import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { friendChatEmailActivation, runFriendChatUnreadNotifications } from '@/lib/friend-chat-notifications';
import { isAuthorizedCronRequest } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Hourly scan; eligibility begins only after 12 unread hours. Delivery is also
// protected by an explicit template-version environment approval, so deploying
// code or a cron schedule alone can never send customer email.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const activation = friendChatEmailActivation();
  const result = await runFriendChatUnreadNotifications({ send: activation.enabled });
  return NextResponse.json(result);
}
