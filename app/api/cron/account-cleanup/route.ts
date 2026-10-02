import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/request-security';
import { processAccountCleanup } from '@/lib/account-cleanup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...await processAccountCleanup() });
  } catch {
    console.error('[account-cleanup] worker failed; leased work will retry');
    return NextResponse.json({ error: 'cleanup_worker_failed' }, { status: 503 });
  }
}
