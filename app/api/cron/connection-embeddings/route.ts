import { NextRequest, NextResponse } from 'next/server';
import { backfillConsentedConnectionEmbeddings } from '@/lib/connection-embeddings-server';
import { isAuthorizedCronRequest } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// A bounded, consent-only maintenance pass. Input hashes make unchanged users
// free of OpenAI calls, and the checked-at cursor prevents the same first page
// from starving later users.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const requested = Number(req.nextUrl.searchParams.get('limit') || 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.round(requested), 25)) : 10;
  try {
    const result = await backfillConsentedConnectionEmbeddings(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[connection-embeddings] maintenance failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Embedding maintenance failed.' }, { status: 500 });
  }
}
