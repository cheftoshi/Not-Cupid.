import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/request-security';
import { processNotificationOutbox } from '@/lib/notification-outbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await processNotificationOutbox(50)) });
  } catch (error) {
    console.error('[notification-outbox] worker failed', error);
    return NextResponse.json({ ok: false, error: 'notification_worker_failed' }, { status: 500 });
  }
}
