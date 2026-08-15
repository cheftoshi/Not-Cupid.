import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import { VIDEO_UPLOAD_TYPES } from '@/lib/request-security';
import { rateLimit } from '@/lib/rate-limit';
import { datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';

// Signed direct-to-storage upload for the experiment intro video (bypasses Vercel's
// 4.5MB body limit). The client PUTs the file straight to Supabase storage.
// The private `raffle-videos` bucket is readable only through signed URLs.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.is_test === true) return NextResponse.json({ error: 'Test accounts cannot upload to the live Dating Experiment.' }, { status: 403 });
  const event = await getDatingExperimentEvent();
  const eventLocation = event
    ? { centerZip: event.center_zip, radiusMiles: Number(event.radius_miles) }
    : RAFFLE;
  if (!datingExperimentEntriesOpen(event) || !raffleEligible(user, eventLocation)) return NextResponse.json({ error: 'Dating Experiment video uploads are not open for this account.' }, { status: 403 });
  const limit = await rateLimit({ key: `dating-experiment-video:${user.id}`, windowSec: 3600, maxAttempts: 10, blockSec: 3600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many upload attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { ext } = await req.json().catch(() => ({ ext: 'mp4' }));
  const clean = String(ext || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const contentType = VIDEO_UPLOAD_TYPES[clean];
  if (!contentType) return NextResponse.json({ error: 'Unsupported video type' }, { status: 400 });
  const e = clean;
  const path = `${user.id}/${RAFFLE.key}-${Date.now()}.${e}`;

  const { data, error } = await supabaseAdmin.storage.from('raffle-videos').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('raffle upload-url error', error);
    return NextResponse.json({ error: 'Video uploads are temporarily unavailable — please try again shortly.' }, { status: 503 });
  }
  const { data: pub } = supabaseAdmin.storage.from('raffle-videos').getPublicUrl(path);
  // `storageRef` is a stable object reference, not a publicly readable URL. The
  // bucket is private and playback always uses a short-lived signed URL.
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, storageRef: pub.publicUrl, contentType });
}
