import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE } from '@/lib/raffle';
import { managedStoragePath } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: entry } = await supabaseAdmin.from('raffle_entries')
    .select('status, video_url')
    .eq('user_id', user.id)
    .eq('event_key', RAFFLE.key)
    .maybeSingle();
  if (!entry) return NextResponse.json({ ok: true, status: 'not-entered' });
  if (entry.status === 'picked') {
    return NextResponse.json({ error: 'You have already been selected. Use the private pass button instead.' }, { status: 409 });
  }

  const path = entry.video_url
    ? managedStoragePath(entry.video_url, 'raffle-videos', `${user.id}/${RAFFLE.key}-`)
    : null;
  if (path) {
    const { error: storageError } = await supabaseAdmin.storage.from('raffle-videos').remove([path]);
    if (storageError) return NextResponse.json({ error: 'Could not delete your experiment video right now.' }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from('raffle_entries').update({
    status: 'withdrawn',
    withdrawn_at: new Date().toISOString(),
    video_url: null,
  }).eq('user_id', user.id).eq('event_key', RAFFLE.key);
  if (error) return NextResponse.json({ error: 'Could not withdraw right now.' }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'withdrawn' });
}
