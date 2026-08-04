import { managedStoragePath } from '@/lib/request-security';
import { supabaseAdmin } from '@/lib/supabase';

const VIDEO_BUCKET = 'raffle-videos';

/** Add a short-lived playback URL without replacing the stable DB reference. */
export async function withPrivateVideoPreview<T extends Record<string, any>>(user: T): Promise<T & { intro_video_preview_url: string | null }> {
  const stored = user?.intro_video_url;
  const path = typeof stored === 'string'
    ? managedStoragePath(stored, VIDEO_BUCKET, `profile/${user.id}/`)
    : null;
  if (!path) return { ...user, intro_video_preview_url: null };

  const { data, error } = await supabaseAdmin.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error('[private-media] Could not sign profile video', { userId: user.id });
    return { ...user, intro_video_preview_url: null };
  }
  return { ...user, intro_video_preview_url: data.signedUrl };
}
