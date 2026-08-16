import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  LOVE_RELAUNCH_CAMPAIGN,
  loveRelaunchPath,
  verifyLoveRelaunchToken,
} from '@/lib/love-relaunch';
import { recordDatingExperimentFunnelEvent } from '@/lib/dating-experiment-funnel';

export const dynamic = 'force-dynamic';

// Signed, first-party campaign redirect. This gives the admin dashboard a
// useful CTA-click metric without enabling provider link rewriting for OTP and
// other transactional mail on the whole sending domain.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('u') || '';
  const destination = url.searchParams.get('d') || '';
  const token = url.searchParams.get('t');
  const validUserId = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId);

  if (!validUserId || !verifyLoveRelaunchToken(userId, destination, token)) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const now = new Date().toISOString();
  const { data: row } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('status, clicked_at')
    .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
    .eq('user_id', userId)
    .maybeSingle();

  if (row) {
    const terminal = ['failed', 'bounced', 'suppressed', 'complained'].includes(row.status);
    await supabaseAdmin
      .from('email_campaign_deliveries')
      .update({
        status: terminal ? row.status : 'clicked',
        clicked_at: row.clicked_at || now,
        last_event_at: now,
        updated_at: now,
      })
      .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
      .eq('user_id', userId);
    await recordDatingExperimentFunnelEvent(userId, 'email_clicked');
  }

  return NextResponse.redirect(new URL(loveRelaunchPath(destination), url.origin));
}
