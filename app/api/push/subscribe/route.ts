// POST /api/push/subscribe — save the caller's web-push subscription.
// DELETE — remove it (user turned notifications off).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  let validEndpoint = false;
  try {
    const parsed = new URL(endpoint);
    validEndpoint = parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch { /* invalid URL */ }
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !validEndpoint ||
      typeof p256dh !== 'string' || p256dh.length > 512 ||
      typeof auth !== 'string' || auth.length > 512) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  // Upsert on endpoint: a re-subscribe from the same browser replaces its row
  // (and re-homes it if the browser switched accounts).
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('[push] Subscription write failed:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (typeof body?.endpoint !== 'string' || body.endpoint.length > 2048) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id);
  if (error) {
    console.error('[push] Subscription delete failed:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
