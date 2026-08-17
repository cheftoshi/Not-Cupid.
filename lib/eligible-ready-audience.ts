import 'server-only';
import { getAdminEmails } from '@/lib/admin';
import { experimentProfileReadiness } from '@/lib/experiment-profile';
import { ELIGIBLE_READY_REMINDER_CAMPAIGN } from '@/lib/eligible-ready-reminder';
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch';
import { zipDistanceMiles } from '@/lib/quiz-data';
import { RAFFLE } from '@/lib/raffle';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

export type EligibleReadyReminderUser = {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  zip: string | null;
  photo_url: string | null;
  bio: string | null;
  hobbies: string[] | null;
  music: string[] | null;
  food: string[] | null;
  sports: string[] | null;
  archetype: string | null;
  score_honesty: number | null;
  created_at: string;
  is_test: boolean | null;
  deleted_at: string | null;
  is_blocked: boolean | null;
  matching_disabled_at: string | null;
  email_notifications: boolean | null;
  notifications_paused_at: string | null;
  pool_active: boolean | null;
};

type Delivery = { user_id: string; variant: string; status: string; updated_at: string; sent_at: string | null };

export type EligibleReadyAudience = {
  candidates: EligibleReadyReminderUser[];
  currentEligibleNonEntrants: number;
  profileConverted: number;
  joinedAfterCampaign: number;
  excludedPushReachable: number;
  alreadyCompleted: number;
};

export async function loadEligibleReadyReminderAudience(): Promise<EligibleReadyAudience> {
  const [users, originalDeliveries, reminderDeliveries, entries, subscriptions] = await Promise.all([
    fetchAllSupabaseRows<EligibleReadyReminderUser>((from, to) => supabaseAdmin
      .from('users')
      .select('id,email,name,age,zip,photo_url,bio,hobbies,music,food,sports,archetype,score_honesty,created_at,is_test,deleted_at,is_blocked,matching_disabled_at,email_notifications,notifications_paused_at,pool_active')
      .order('id', { ascending: true })
      .range(from, to)),
    fetchAllSupabaseRows<Delivery>((from, to) => supabaseAdmin
      .from('email_campaign_deliveries')
      .select('user_id,variant,status,updated_at,sent_at')
      .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
      .order('user_id', { ascending: true })
      .range(from, to)),
    fetchAllSupabaseRows<Delivery>((from, to) => supabaseAdmin
      .from('email_campaign_deliveries')
      .select('user_id,variant,status,updated_at,sent_at')
      .eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN)
      .order('user_id', { ascending: true })
      .range(from, to)),
    fetchAllSupabaseRows<{ user_id: string }>((from, to) => supabaseAdmin
      .from('raffle_entries')
      .select('user_id')
      .eq('event_key', RAFFLE.key)
      .neq('status', 'withdrawn')
      .order('user_id', { ascending: true })
      .range(from, to)),
    fetchAllSupabaseRows<{ user_id: string }>((from, to) => supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
      .order('user_id', { ascending: true })
      .range(from, to)),
  ]);

  const adminEmails = new Set(getAdminEmails());
  const entered = new Set(entries.map((row) => row.user_id));
  const pushReachable = new Set(subscriptions.map((row) => row.user_id));
  const originalByUser = new Map(originalDeliveries.map((row) => [row.user_id, row]));
  const originalCampaignStartedAt = originalDeliveries
    .map((row) => row.sent_at)
    .filter((value): value is string => !!value)
    .sort()[0] || null;
  const recentQueuedCutoff = Date.now() - 10 * 60 * 1000;
  const completed = new Set(reminderDeliveries
    .filter((row) => row.status !== 'failed' && (row.status !== 'queued' || new Date(row.updated_at).getTime() > recentQueuedCutoff))
    .map((row) => row.user_id));

  const currentEligible = users.filter((user) =>
    user.is_test !== true
    && !user.deleted_at
    && user.is_blocked !== true
    && !user.matching_disabled_at
    && typeof user.email === 'string'
    && user.email.includes('@')
    && user.email_notifications !== false
    && !user.notifications_paused_at
    && user.pool_active !== false
    && !adminEmails.has(user.email.trim().toLowerCase())
    && !entered.has(user.id)
    && experimentProfileReadiness(user).complete
    && (zipDistanceMiles(user.zip, RAFFLE.centerZip) ?? Number.POSITIVE_INFINITY) <= RAFFLE.radiusMiles
  );

  const newlyReady = currentEligible.filter((user) => originalByUser.get(user.id)?.variant === 'profile');
  const joinedAfterCampaign = currentEligible.filter((user) =>
    !originalByUser.has(user.id)
    && !!originalCampaignStartedAt
    && user.created_at > originalCampaignStartedAt
  );
  const reminderPool = [...newlyReady, ...joinedAfterCampaign]
    .filter((user, index, all) => all.findIndex((candidate) => candidate.id === user.id) === index);
  const excludedPushReachable = reminderPool.filter((user) => pushReachable.has(user.id)).length;
  const candidates = reminderPool
    .filter((user) => !pushReachable.has(user.id) && !completed.has(user.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return {
    candidates,
    currentEligibleNonEntrants: currentEligible.length,
    profileConverted: candidates.filter((user) => originalByUser.get(user.id)?.variant === 'profile').length,
    joinedAfterCampaign: candidates.filter((user) => !originalByUser.has(user.id)).length,
    excludedPushReachable,
    alreadyCompleted: completed.size,
  };
}
