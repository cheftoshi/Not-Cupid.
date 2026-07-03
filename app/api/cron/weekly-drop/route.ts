import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assignFriendMatches, matchCapFor } from '@/lib/friend-assign';
import { isFriendCooled } from '@/lib/friend-cooldown';
import { dropKey } from '@/lib/weekly-drop';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// THE WEEKLY DROP (Thursdays, 23:00 UTC — vercel.json) — every friend-opted-in
// real user gets a fresh sealed pack: a free match round (bumps their cap) +
// assignment + a push. Idempotent per week via the rounds table's unique
// stripe_payment_id (`drop-<week>-<user>`), so re-runs never double-drop.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const isVercelCron = (!!cronSecret && authHeader === `Bearer ${cronSecret}`) || /vercel-cron/i.test(userAgent);
  if (!isVercelCron) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const week = dropKey();

  // Friend-line users only; real realm (the seeder runs the test world). Bounded
  // for safety — far above beta scale.
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, friend_cooldown_until')
    .not('friend_opted_in_at', 'is', null)
    .is('deleted_at', null)
    .not('is_test', 'is', true)
    .limit(500);

  let dropped = 0, skippedCooled = 0, alreadyDropped = 0, empty = 0;

  for (const u of users ?? []) {
    try {
      if (isFriendCooled(u)) { skippedCooled++; continue; }

      // Idempotent weekly grant: the unique key means only the first run this
      // week inserts; later runs see a duplicate and skip.
      const { data: inserted } = await supabaseAdmin
        .from('friend_match_rounds')
        .upsert(
          { user_id: u.id, stripe_payment_id: `drop-${week}-${u.id}` },
          { onConflict: 'stripe_payment_id', ignoreDuplicates: true }
        )
        .select('id');
      if (!inserted || inserted.length === 0) { alreadyDropped++; continue; }

      const cap = await matchCapFor(u.id);
      const created = await assignFriendMatches(u.id, cap);
      if (created > 0) {
        dropped++;
        await sendPushToUser(u.id, {
          title: 'your weekly pack just dropped 🧡',
          body: `${created} new ${created === 1 ? 'person' : 'people'}, curated for you. sealed until you open it.`,
          url: '/friends/pack',
          tag: 'weekly-drop',
        }).catch(() => {});
      } else {
        empty++; // thin pool this week — the granted round carries to next assign
      }
    } catch (e) {
      console.error('weekly-drop failed for user', u.id, e);
    }
  }

  return NextResponse.json({ ok: true, week, dropped, empty, skippedCooled, alreadyDropped, scanned: (users ?? []).length });
}
