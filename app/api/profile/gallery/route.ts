import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Gallery = up to 3 extra photos beyond the primary photo_url, revealed as
// part of the $0.99 profile unlock. Mirrors /api/profile/photo (same bucket, same
// 4MB ceiling that keeps us under Vercel's serverless body limit).

const MAX_SIZE = 4 * 1024 * 1024; // 4MB — stay under Vercel's body limit
const MAX_GALLERY = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'profile-photos';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const current: string[] = Array.isArray(user.gallery) ? user.gallery : [];
  if (current.length >= MAX_GALLERY) {
    return NextResponse.json({ error: `Max ${MAX_GALLERY} gallery photos` }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Must be JPEG, PNG, or WebP' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'photo must be under 4MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${user.id}/gallery/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Gallery upload failed:', { userId: user.id, error: uploadError });
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename);
  const next = [...current, publicUrl].slice(0, MAX_GALLERY);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ gallery: next })
    .eq('id', user.id);

  if (updateError) {
    console.error('Gallery row update failed:', { userId: user.id, error: updateError });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ gallery: next });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json().catch(() => ({ url: null }));
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const current: string[] = Array.isArray(user.gallery) ? user.gallery : [];
  const next = current.filter((u) => u !== url);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ gallery: next })
    .eq('id', user.id);

  if (updateError) {
    console.error('Gallery delete update failed:', { userId: user.id, error: updateError });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Best-effort: remove the object from storage so we don't orphan it.
  // Path is everything after "/<bucket>/" in the public URL.
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = url.slice(idx + marker.length);
    // Only delete files in this user's own folder — defensive.
    if (path.startsWith(`${user.id}/`)) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {});
    }
  }

  return NextResponse.json({ gallery: next });
}
