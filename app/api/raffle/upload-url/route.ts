import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

// Signed direct-to-storage upload for the contest intro video (bypasses Vercel's
// 4.5MB body limit). The client PUTs the file straight to Supabase storage.
// Requires a PUBLIC `raffle-videos` bucket configured in the Supabase dashboard.
const OK_EXT = new Set(['mp4', 'mov', 'webm', 'm4v', 'quicktime']);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ext } = await req.json().catch(() => ({ ext: 'mp4' }));
  const clean = String(ext || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const e = OK_EXT.has(clean) ? clean : 'mp4';
  const path = `${user.id}/${RAFFLE.key}-${Date.now()}.${e}`;

  const { data, error } = await supabaseAdmin.storage.from('raffle-videos').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('raffle upload-url error', error);
    return NextResponse.json({ error: 'Video uploads not set up yet — you can still register and add your video later.' }, { status: 503 });
  }
  const { data: pub } = supabaseAdmin.storage.from('raffle-videos').getPublicUrl(path);
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl: pub.publicUrl });
}
