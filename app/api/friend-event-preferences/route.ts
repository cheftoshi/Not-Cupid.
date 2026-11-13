import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { FRIEND_EVENT_CONSENT_VERSION } from '@/lib/friend-event-campaign';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('friend_event_preferences').select('email_enabled,push_enabled').eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Preferences unavailable' }, { status: 503 });
  return NextResponse.json(data ?? { email_enabled: false, push_enabled: false });
}
export async function PUT(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!['email', 'push'].includes(body.channel) || typeof body.enabled !== 'boolean' || body.version !== FRIEND_EVENT_CONSENT_VERSION) return NextResponse.json({ error: 'Invalid preference' }, { status: 400 });
  const { error } = await supabaseAdmin.rpc('set_friend_event_preference', { p_user: user.id, p_channel: body.channel, p_enabled: body.enabled, p_source: 'profile' });
  if (error) return NextResponse.json({ error: 'Could not save preference' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
