import { supabaseAdmin } from '@/lib/supabase';

// Explicit public projection: no venue, photos, audience-targeted invitations,
// participant identities, dates or test/blocked/deleted hosts.
export async function publicPlans({ metro, id }: { metro?: string; id?: string }) {
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return [];
  let query = supabaseAdmin.from('friend_activities')
    .select('id,title,category,area,happens_at,metro,author_id,users!friend_activities_author_id_fkey!inner(name,is_test,is_blocked,deleted_at)')
    .eq('kind', 'event').eq('is_test', false)
    .is('audience_age_min', null).is('audience_age_max', null)
    .or('audience_gender.is.null,audience_gender.eq.{}')
    .not('users.is_test', 'is', true).not('users.is_blocked', 'is', true).is('users.deleted_at', null)
    .gt('expires_at', new Date().toISOString());
  if (metro) query = query.eq('metro', metro);
  if (id) query = query.eq('id', id);
  const { data, error } = await query.order('happens_at', { ascending: true, nullsFirst: false }).abortSignal(AbortSignal.timeout(3000)).limit(id ? 1 : 4);
  if (error) { console.error('public-plan-projection unavailable', error.code); return []; }
  return (data || []).map((row: any) => ({
    id: row.id, title: row.title, category: row.category, area: row.area,
    happens_at: row.happens_at, metro: row.metro,
    hostFirst: String(row.users?.name || 'A member').split(' ')[0],
  }));
}
