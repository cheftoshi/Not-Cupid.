import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { recordFriendEventProviderEvent } from '@/lib/friend-event-provider';
export const dynamic = 'force-dynamic';
// Provider GET + ledger reconciliation only. Never sends, retries, or clears claims.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (process.env.FRIEND_EVENT_RECONCILIATION_ENABLED !== 'true' || !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Reconciliation is not enabled' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.deliveryId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.deliveryId)) return NextResponse.json({ error: 'Invalid delivery' }, { status: 400 });
  const { data: row, error } = await supabaseAdmin.from('friend_event_deliveries').select('id,campaign_id,provider_id').eq('id', body.deliveryId).eq('channel', 'email').maybeSingle();
  if (error || !row?.provider_id) return NextResponse.json({ error: 'No known provider submission to reconcile. Do not retry the send.' }, { status: 409 });
  const { data, error: providerError } = await new Resend(process.env.RESEND_API_KEY).emails.get(row.provider_id);
  if (providerError || !data || data.id !== row.provider_id) return NextResponse.json({ error: 'Provider status unavailable' }, { status: 502 });
  const event = { type: `email.${data.last_event}`, created_at: new Date().toISOString(), data: { email_id: data.id, tags: { campaign: row.campaign_id, friend_event_delivery_id: row.id } } };
  try {
    const recorded = await recordFriendEventProviderEvent(event, `reconcile:${data.id}:${data.last_event}`);
    return NextResponse.json({ recorded, providerStatus: data.last_event, timestampMeaning: 'Reconciliation observation time, not provider event time. No send attempted.' });
  } catch { return NextResponse.json({ error: 'Could not store provider status' }, { status: 503 }); }
}
