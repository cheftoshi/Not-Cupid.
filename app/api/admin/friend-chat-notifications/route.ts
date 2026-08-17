import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runFriendChatUnreadNotifications } from '@/lib/friend-chat-notifications';

export const dynamic = 'force-dynamic';

// Read-only approval view: exact template plus the live eligible recipient
// count. This route never accepts a send action.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await runFriendChatUnreadNotifications({ send: false }));
}
