import { supabaseAdmin } from '@/lib/supabase';
import { reportedFriendIds } from '@/lib/friend-report-policy';

/** Shared across lines; errors deny access rather than treating a failed check as safe. */
export async function safePeerIds(user: {id: string; is_test?: boolean}, ids: string[]): Promise<Set<string>> {
  const reported = await reportedFriendIds(user.id);
  const safe = new Set<string>();
  const unique = [...new Set(ids)].filter(id => !reported.has(id));
  for (let i = 0; i < unique.length; i += 200) {
    const {data, error} = await supabaseAdmin.from('users').select('id,is_test')
      .in('id', unique.slice(i, i + 200)).is('deleted_at', null).neq('is_blocked', true);
    if (error) throw Error('Pair safety checks unavailable');
    for (const peer of data ?? []) if ((peer.is_test === true) === (user.is_test === true)) safe.add(peer.id);
  }
  return safe;
}

export async function pairAllowed(user: {id: string; is_test?: boolean}, otherId: string): Promise<boolean> {
  return (await safePeerIds(user, [otherId])).has(otherId);
}
