import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Fire-and-forget pageview beacon. No auth (anonymous visitors count too),
// kept deliberately cheap — no session lookup per hit.
export async function POST(req: NextRequest) {
  try {
    const { path, ref, anonId } = await req.json().catch(() => ({}));
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Don't log admin/api routes or anything with absurd length.
    const clean = path.split('?')[0].split('#')[0].slice(0, 200);
    if (clean.startsWith('/admin') || clean.startsWith('/api')) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    await supabaseAdmin.from('page_views').insert({
      path: clean,
      anon_id: typeof anonId === 'string' ? anonId.slice(0, 64) : null,
      referrer: typeof ref === 'string' && ref ? ref.slice(0, 300) : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
