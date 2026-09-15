import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/request-security';
import { processEmbeddingShadowJobs } from '@/lib/embedding-shadow-jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await processEmbeddingShadowJobs() }); }
  catch { return NextResponse.json({ error: 'Shadow maintenance failed.' }, { status: 503 }); }
}
