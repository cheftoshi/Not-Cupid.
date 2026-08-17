import { NextRequest, NextResponse } from 'next/server';
import {
  ELIGIBLE_READY_REMINDER_CAMPAIGN,
  ELIGIBLE_READY_REMINDER_DESTINATION,
  verifyEligibleReadyReminderToken,
} from '@/lib/eligible-ready-reminder';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Signed first-party redirect for this small reminder. It records a real CTA
// click without enabling provider link rewriting for OTPs or transactional mail.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t');
  const validUserId = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId);
  if (!validUserId || !verifyEligibleReadyReminderToken(userId, token)) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const now = new Date().toISOString();
  const { data: row } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('status,clicked_at')
    .eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN)
    .eq('user_id', userId)
    .maybeSingle();
  if (row) {
    const terminal = ['failed', 'bounced', 'suppressed', 'complained'].includes(row.status);
    await Promise.all([
      supabaseAdmin
        .from('email_campaign_deliveries')
        .update({
          status: terminal ? row.status : 'clicked',
          clicked_at: row.clicked_at || now,
          last_event_at: now,
          updated_at: now,
        })
        .eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN)
        .eq('user_id', userId),
      supabaseAdmin.from('campaign_funnel_events').upsert({
        campaign_key: ELIGIBLE_READY_REMINDER_CAMPAIGN,
        user_id: userId,
        variant: 'ready',
        event: 'email_clicked',
        metadata: { source: 'signed-reminder-link' },
      }, { onConflict: 'campaign_key,user_id,event', ignoreDuplicates: true }),
    ]);
  }

  return NextResponse.redirect(new URL(ELIGIBLE_READY_REMINDER_DESTINATION, url.origin));
}
