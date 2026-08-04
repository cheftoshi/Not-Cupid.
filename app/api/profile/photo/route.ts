import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { detectSafeImageType } from '@/lib/request-security';

// Vercel serverless functions cap request bodies at 4.5MB; multipart adds
// overhead, so the practical ceiling is ~4MB.
const MAX_SIZE = 4 * 1024 * 1024;
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'photo must be under 4MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectSafeImageType(buffer);
  if (!detected || (file.type && file.type !== detected.mime)) {
    return NextResponse.json({ error: 'File contents must be JPEG, PNG, or WebP' }, { status: 400 });
  }
  const filename = `${user.id}/${Date.now()}.${detected.ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('profile-photos')
    .upload(filename, buffer, {
      contentType: detected.mime,
      upsert: false,
    });

  if (uploadError) {
    console.error('Photo upload failed:', { userId: user.id, error: uploadError });
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('profile-photos')
    .getPublicUrl(filename);

  await supabaseAdmin
    .from('users')
    .update({ photo_url: publicUrl })
    .eq('id', user.id);

  return NextResponse.json({ url: publicUrl });
}
