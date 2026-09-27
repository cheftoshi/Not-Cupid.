import { supabaseAdmin } from '@/lib/supabase';

/** Both directions; fail closed rather than treating a database failure as no reports. */
export async function reportedFriendIds(userId: string): Promise<Set<string>> {
  const peers = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('user_reports')
      .select('id, reporter_id, reported_id')
      .or(`reporter_id.eq.${userId},reported_id.eq.${userId}`)
      .order('id').range(offset, offset + 499);
    if (error) throw new Error('Friend safety checks unavailable');
    for (const row of data ?? []) peers.add(row.reporter_id === userId ? row.reported_id : row.reporter_id);
    if ((data ?? []).length < 500) return peers;
  }
}
