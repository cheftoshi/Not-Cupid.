import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { RAFFLE } from '@/lib/raffle';
import { managedStoragePath, isAuthorizedCronRequest } from '@/lib/request-security';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const deleteAfter = new Date(RAFFLE.happensAt).getTime() + RETENTION_MS;
  if (!Number.isFinite(deleteAfter) || Date.now() < deleteAfter) {
    return NextResponse.json({ ok: true, state: 'retention-window-open', deleted: 0 });
  }

  const { data: entries, error } = await supabaseAdmin.from('raffle_entries')
    .select('id, user_id, video_url')
    .eq('event_key', RAFFLE.key)
    .not('video_url', 'is', null)
    .limit(500);
  if (error) return NextResponse.json({ error: 'Could not load experiment videos.' }, { status: 500 });

  const paths = (entries ?? []).flatMap((entry) => {
    const path = managedStoragePath(entry.video_url, 'raffle-videos', `${entry.user_id}/${RAFFLE.key}-`);
    return path ? [path] : [];
  });
  if (paths.length) {
    const { error: storageError } = await supabaseAdmin.storage.from('raffle-videos').remove(paths);
    if (storageError) return NextResponse.json({ error: 'Could not delete experiment videos.' }, { status: 500 });
  }

  const ids = (entries ?? []).map((entry) => entry.id);
  if (ids.length) {
    const { error: updateError } = await supabaseAdmin.from('raffle_entries').update({ video_url: null }).in('id', ids);
    if (updateError) return NextResponse.json({ error: 'Videos were removed but entry references could not be cleared.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, state: ids.length === 500 ? 'more-remain' : 'complete', deleted: paths.length });
}
