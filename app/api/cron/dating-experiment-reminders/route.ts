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
    .select('id, user_a_id, user_b_id, restaurant, happens_at')
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
    const notificationType = hoursAway <= 3 ? 'dinner_3h' : 'dinner_24h';

    const userIds = [draw.user_a_id, draw.user_b_id];
    const { data: entries, error: entryError } = await supabaseAdmin.from('raffle_entries')
      .select('user_id, notify')
      .eq('event_key', RAFFLE.key)
      .in('user_id', userIds);
    if (entryError) {
      console.error('[dating-experiment-reminder-entries]', { drawId: draw.id, code: entryError.code });
      continue;
    }
    const optedIn = new Set((entries ?? []).filter((entry) => entry.notify !== false).map((entry) => entry.user_id));
    const lead = hoursAway <= 3 ? 'Your dinner is coming up' : 'Your dinner is tomorrow';
    const body = `${localDinnerLabel(draw.happens_at)} · ${draw.restaurant}. Open NotCupid for your confirmed details.`;
    for (const id of userIds) {
      if (!optedIn.has(id)) continue;
      const nowIso = new Date().toISOString();
      const delivery = {
        event_key: RAFFLE.key,
        draw_id: draw.id,
        user_id: id,
        notification_type: notificationType,
        channel: 'push',
        status: 'claimed',
        claimed_at: nowIso,
        updated_at: nowIso,
      };
      const { error: insertError } = await supabaseAdmin
        .from('dating_experiment_notification_deliveries')
        .insert(delivery);
      if (insertError) {
        if (insertError.code !== '23505') {
          console.error('[dating-experiment-reminder-claim]', { drawId: draw.id, userId: id, code: insertError.code });
          continue;
        }
        const { data: retry, error: retryError } = await supabaseAdmin
          .from('dating_experiment_notification_deliveries')
          .update({ status: 'claimed', claimed_at: nowIso, updated_at: nowIso, last_error: null })
          .eq('event_key', RAFFLE.key)
          .eq('draw_id', draw.id)
          .eq('user_id', id)
          .eq('notification_type', notificationType)
          .eq('channel', 'push')
          .eq('status', 'failed')
          .select('id')
          .maybeSingle();
        if (retryError || !retry) continue;
      }
      claimed += 1;
      const pushed = await sendPushToUser(id, {
        title: `${lead} ✦`,
        body,
        url: '/dating-experiment',
        tag: `dating-experiment-reminder-${draw.id}-${notificationType}`,
      });
      const { error: finishError } = await supabaseAdmin
        .from('dating_experiment_notification_deliveries')
        .update(pushed ? {
          status: 'delivered', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null,
        } : {
          status: 'failed', updated_at: new Date().toISOString(), last_error: 'push_unavailable',
        })
        .eq('event_key', RAFFLE.key)
        .eq('draw_id', draw.id)
        .eq('user_id', id)
        .eq('notification_type', notificationType)
        .eq('channel', 'push')
        .eq('status', 'claimed');
      if (finishError) console.error('[dating-experiment-reminder-finish]', { drawId: draw.id, userId: id, code: finishError.code });
      if (pushed) delivered += 1;
    }
  }

  return NextResponse.json({ ok: true, examined: draws?.length ?? 0, claimed, delivered });
}
