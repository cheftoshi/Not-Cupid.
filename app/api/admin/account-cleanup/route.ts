import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await getCurrentAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const statuses = ['queued', 'processing', 'retry', 'completed', 'dead'];
  const counts = await Promise.all(statuses.map(async status => {
    const { count, error } = await supabaseAdmin.from('account_cleanup_jobs')
      .select('user_id', { count: 'exact', head: true }).eq('status', status);
    if (error) throw Error('cleanup_counts_unavailable');
    return [status, count || 0];
  })).catch(() => null);
  if (!counts) return NextResponse.json({ error: 'Cleanup metrics unavailable' }, { status: 503 });
  return NextResponse.json({ counts: Object.fromEntries(counts),
    action: 'Dead jobs require operator review. No customer data is included in this summary.' });
}
