import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyUnsubToken } from '@/lib/email';

export const dynamic = 'force-dynamic';

// One-click unsubscribe. The token is HMAC-signed against the user id, so
// the link in our email is the only way to trigger this — random people
// can't unsubscribe other users by guessing IDs.
//
// Effect: stops all activity emails AND removes the user from the matching
// pool (pool_active=false). Per product call: if you can't get notified
// about a match, you shouldn't be in the pool.
export async function POST(req: NextRequest) {
  try {
    const { u, t } = await req.json();
    if (!u || !t || typeof u !== 'string' || typeof t !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }
    if (!verifyUnsubToken(u, t)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        email_notifications: false,
        pool_active: false,
        notifications_paused_at: new Date().toISOString(),
      })
      .eq('id', u);

    if (error) {
      console.error('unsubscribe: db error', error);
      return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('unsubscribe error', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
