import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { friendLocationContext } from '@/lib/friend-location';
import { dateParticipant, type DatePlanRow } from '@/lib/date-plan-policy';

export const DATE_PERSON_COLUMNS = 'id,name,age,gender,photo_url,bio,hobbies,is_test';
export async function accessibleDatePlan(user: any, id: string): Promise<DatePlanRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: p, error } = await supabaseAdmin.from('connection_date_plans').select('*').eq('id', id).eq('is_test', user.is_test === true).maybeSingle();
  if (error) throw Error('Could not verify date access.');
  if (!p || !user.age || user.age < 18) return null;
  const member = dateParticipant(p, user.id);
  if (!member && (p.state !== 'open' || Date.parse(p.expires_at) <= Date.now())) return null;
  if (!member && (await friendLocationContext(user)).metro !== p.metro) return null;
  const ids = [p.host_id, ...(p.guest_id ? [p.guest_id] : [])];
  const [people, reports] = await Promise.all([
    supabaseAdmin.from('users').select('id').in('id', ids).eq('is_test', user.is_test === true).gte('age', 18).is('deleted_at', null).neq('is_blocked', true),
    supabaseAdmin.from('user_reports').select('reporter_id,reported_id').or(`reporter_id.eq.${user.id},reported_id.eq.${user.id}`),
  ]);
  if (people.error || reports.error) throw Error('Could not verify date access.');
  const blocked = new Set((reports.data || []).map(r => r.reporter_id === user.id ? r.reported_id : r.reporter_id));
  return people.data?.length === ids.length && !ids.some(id => blocked.has(id)) ? p : null;
}
