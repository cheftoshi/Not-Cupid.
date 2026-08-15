import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { isAuthorizedCronRequest } from '@/lib/request-security';
import { RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

const HOUR_MS = 60 * 60 * 1000;

function localDinnerLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  }).format(new Date(value));
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const { data: draws, error } = await supabaseAdmin.from('raffle_draws')
    .select('id, user_a_id, user_b_id, restaurant, happens_at, reminder_24h_sent_at, reminder_3h_sent_at')
    .eq('event_key', RAFFLE.key)
    .eq('status', 'both_accepted')
    .gt('happens_at', new Date(now).toISOString())
    .lte('happens_at', new Date(now + 24 * HOUR_MS).toISOString());
  if (error) return NextResponse.json({ error: 'Could not load confirmed Dating Experiment dinners.' }, { status: 500 });

  let claimed = 0;
  let delivered = 0;
  for (const draw of draws ?? []) {
    if (!draw.happens_at || !draw.restaurant) continue;
    const hoursAway = (new Date(draw.happens_at).getTime() - now) / HOUR_MS;
    const field = hoursAway <= 3 ? 'reminder_3h_sent_at' : 'reminder_24h_sent_at';
    if (draw[field]) continue;

    // Claim before sending. At-least-once cron retries must never spam a pair.
    const claimedAt = new Date().toISOString();
    const { data: claim, error: claimError } = await supabaseAdmin.from('raffle_draws')
      .update({ [field]: claimedAt })
      .eq('id', draw.id)
      .eq('status', 'both_accepted')
      .is(field, null)
      .select('id')
      .maybeSingle();
    if (claimError || !claim) continue;
    claimed += 1;

    const userIds = [draw.user_a_id, draw.user_b_id];
    const { data: entries } = await supabaseAdmin.from('raffle_entries')
      .select('user_id, notify')
      .eq('event_key', RAFFLE.key)
      .in('user_id', userIds);
    const optedIn = new Set((entries ?? []).filter((entry) => entry.notify !== false).map((entry) => entry.user_id));
    const lead = hoursAway <= 3 ? 'Your dinner is coming up' : 'Your dinner is tomorrow';
    const body = `${localDinnerLabel(draw.happens_at)} · ${draw.restaurant}. Open NotCupid for your confirmed details.`;
    const results = await Promise.all(userIds
      .filter((id) => optedIn.has(id))
      .map((id) => sendPushToUser(id, {
        title: `${lead} ✦`,
        body,
        url: '/dating-experiment',
        tag: `dating-experiment-reminder-${draw.id}-${field}`,
      })));
    delivered += results.filter(Boolean).length;
  }

  return NextResponse.json({ ok: true, examined: draws?.length ?? 0, claimed, delivered });
}
