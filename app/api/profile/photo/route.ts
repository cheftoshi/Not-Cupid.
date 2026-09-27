import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { detectSafeImageType } from '@/lib/request-security';
import { removeProfilePhoto } from '@/lib/account-media-cleanup';
import { randomUUID } from 'node:crypto';

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
  const filename = `${user.id}/${randomUUID()}.${detected.ext}`;

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

  let update = supabaseAdmin
    .from('users')
    .update({ photo_url: publicUrl })
    .eq('id', user.id).is('deleted_at',null);
  update = user.photo_url ? update.eq('photo_url',user.photo_url) : update.is('photo_url',null);
  const {data:saved,error:saveError}=await update.select('id').maybeSingle();
  if(saveError || !saved) {
    await supabaseAdmin.storage.from('profile-photos').remove([filename]);
    return NextResponse.json({error:'Profile changed while uploading. Please try again.'},{status:409});
  }
  try {
    if(!user.gallery?.includes(user.photo_url || '')) await removeProfilePhoto(user.id,user.photo_url);
  } catch {console.error('[profile-photo] old photo cleanup failed',{userId:user.id});}

  return NextResponse.json({ url: publicUrl });
}
