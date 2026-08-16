import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleLaunchBlockers } from '@/lib/raffle';
import { isAdminEmail } from '@/lib/admin';

export type DatingExperimentEvent = {
  event_key: string;
  public_name: string;
  city: string;
  metro: string;
  center_zip: string;
  radius_miles: number;
  status: 'draft' | 'entry_open' | 'entry_closed' | 'shortlisting' | 'resolved' | 'cancelled';
  entry_cap: number;
  shortlist_max_options: number;
  winner_pair_limit: number;
  max_attempts: number;
  response_hours: number;
  prize_per_pair_cents: number;
  terms_version: string;
  algorithm_version: string;
  minimum_pair_score: number;
  winner_fulfillment_details: string | null;
  entry_opens_at: string;
  entry_closes_at: string;
  happens_at: string;
  prize_funding_confirmed: boolean;
  prize_funding_confirmed_at: string | null;
  venue_confirmed: boolean;
  venue_confirmed_at: string | null;
  venue_confirmation_reference: string | null;
  prize_fulfillment_method: string | null;
  sponsor_details_confirmed: boolean;
  sponsor_details_confirmed_at: string | null;
  sponsor_legal_name: string | null;
  sponsor_public_mailing_address: string | null;
  operator_compliance_approved: boolean;
  operator_compliance_approved_at: string | null;
  operator_compliance_reference: string | null;
  dinner_dates: DatingExperimentDinnerDate[];
};

export type DatingExperimentDinnerDate = {
  slot_key: string;
  event_date: string;
  public_label: string;
  starts_at: string | null;
  venue_details: string | null;
  status: 'date_confirmed' | 'time_confirmed' | 'details_confirmed' | 'cancelled';
};

export async function getDatingExperimentEvent(
  eventKey = RAFFLE.key,
): Promise<DatingExperimentEvent | null> {
  const { data, error } = await supabaseAdmin
    .from('dating_experiment_events')
    .select([
      'event_key', 'public_name', 'city', 'metro', 'center_zip', 'radius_miles',
      'status', 'entry_cap', 'shortlist_max_options', 'winner_pair_limit',
      'max_attempts', 'response_hours', 'prize_per_pair_cents', 'terms_version',
      'algorithm_version', 'minimum_pair_score', 'winner_fulfillment_details',
      'entry_opens_at', 'entry_closes_at', 'happens_at',
      'prize_funding_confirmed', 'prize_funding_confirmed_at',
      'venue_confirmed', 'venue_confirmed_at', 'venue_confirmation_reference',
      'prize_fulfillment_method',
      'sponsor_details_confirmed', 'sponsor_details_confirmed_at',
      'sponsor_legal_name', 'sponsor_public_mailing_address',
      'operator_compliance_approved', 'operator_compliance_approved_at', 'operator_compliance_reference',
    ].join(', '))
    .eq('event_key', eventKey)
    .maybeSingle();
  if (error) {
    console.error('[dating-experiment-event]', error);
    return null;
  }
  if (!data) return null;
  const { data: dinnerDates, error: dinnerDatesError } = await supabaseAdmin
    .from('dating_experiment_event_dates')
    .select('slot_key, event_date, public_label, starts_at, venue_details, status')
    .eq('event_key', eventKey)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });
  if (dinnerDatesError) {
    console.error('[dating-experiment-event-dates]', dinnerDatesError);
    return null;
  }
  const event = data as unknown as Omit<DatingExperimentEvent, 'dinner_dates'>;
  return { ...event, dinner_dates: (dinnerDates ?? []) as DatingExperimentDinnerDate[] };
}

export function hasDatabaseLaunchApproval(event: DatingExperimentEvent): boolean {
  return event.prize_funding_confirmed
    && event.prize_funding_confirmed_at != null
    && event.venue_confirmed
    && event.venue_confirmed_at != null
    && !!event.venue_confirmation_reference?.trim()
    && !!event.prize_fulfillment_method?.trim()
    && event.sponsor_details_confirmed
    && event.sponsor_details_confirmed_at != null
    && !!event.sponsor_legal_name?.trim()
    && !!event.sponsor_public_mailing_address?.trim()
    && event.operator_compliance_approved
    && event.operator_compliance_approved_at != null
    && !!event.operator_compliance_reference?.trim()
    && event.terms_version === RAFFLE.termsVersion
    && event.algorithm_version === RAFFLE.algorithmVersion
    && event.dinner_dates.length >= event.winner_pair_limit
    && event.dinner_dates.every((date) => (
      (date.status === 'time_confirmed' || date.status === 'details_confirmed')
      && date.starts_at != null
    ));
}

function rehearsalEmails(): string[] {
  return (process.env.DATING_EXPERIMENT_REHEARSAL_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Rehearsal access is deliberately narrower than normal admin access. It lets
// explicitly named real admin accounts exercise the production PWA entry flow
// only while the public code gate is closed. Test fixtures stay excluded, and
// the database must still have every non-public sign-off.
export function datingExperimentAdminRehearsalOpen(
  event: DatingExperimentEvent | null,
  user: { email?: string | null; is_test?: boolean | null } | null,
  now = Date.now(),
): boolean {
  const email = user?.email?.trim().toLowerCase();
  return !RAFFLE.entriesOpen
    && user?.is_test !== true
    && !!email
    && isAdminEmail(email)
    && rehearsalEmails().includes(email)
    && event != null
    && event.status === 'entry_open'
    && hasDatabaseLaunchApproval(event)
    && now >= new Date(event.entry_opens_at).getTime()
    && now < new Date(event.entry_closes_at).getTime();
}

export function datingExperimentDateLabel(event: DatingExperimentEvent | null): string {
  if (!event?.dinner_dates.length) return RAFFLE.dateLabel;
  return `${event.dinner_dates.map((date) => date.public_label).join(' or ')}; restaurant revealed privately later`;
}

// Code and database gates must both agree. A partial deployment, stale event
// row, or missing migration therefore leaves the experiment safely closed.
export function datingExperimentEntriesOpen(
  event: DatingExperimentEvent | null,
  now = Date.now(),
): boolean {
  return RAFFLE.entriesOpen
    && raffleLaunchBlockers().length === 0
    && event != null
    && event.status === 'entry_open'
    && hasDatabaseLaunchApproval(event)
    && now >= new Date(event.entry_opens_at).getTime()
    && now < new Date(event.entry_closes_at).getTime();
}

export function datingExperimentCanShortlist(event: DatingExperimentEvent | null): boolean {
  return RAFFLE.entriesOpen
    && raffleLaunchBlockers().length === 0
    && event != null
    && ['entry_open', 'entry_closed', 'shortlisting'].includes(event.status)
    && hasDatabaseLaunchApproval(event);
}
