import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const campaign = req.nextUrl.searchParams.get('campaign') || '';
  if (!/^friend_events_[a-z0-9_]{1,80}$/.test(campaign)) return NextResponse.json({ error: 'Invalid campaign' }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('friend_event_campaign_report', { p_campaign: campaign });
  if (error) return NextResponse.json({ error: 'Report unavailable' }, { status: 503 });
  const channels = (data || []).map((row: Record<string, unknown>) => {
    const accepted = Number(row.provider_accepted || 0);
    return { ...row, returnRateAmongProviderAccepted: accepted ? Number(row.authenticated_returns || 0) / accepted : null,
      meaningfulActionRateAmongProviderAccepted: accepted ? Number(row.meaningful_action_users || 0) / accepted : null };
  });
  return NextResponse.json({ campaign, channels, attribution: 'Last signed touch within seven days of the delivery claim; association, not causation.', notes: ['Raw link requests may include scanners. Authenticated returns are separate.', 'Meaningful actions are new yes-RSVPs or created plans, not confirmed attendance.', 'Channels overlap: do not sum channel users as unique people.', 'Push provider acceptance is not device display. Opens are not a usage metric.'], generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
