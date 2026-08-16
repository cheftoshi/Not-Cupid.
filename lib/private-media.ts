import { managedStoragePath } from '@/lib/request-security';
import { supabaseAdmin } from '@/lib/supabase';

const VIDEO_BUCKET = 'raffle-videos';

export async function signPrivateVideoReference(stored: unknown, requiredPrefix: string, expiresIn = 15 * 60): Promise<string | null> {
  const path = typeof stored === 'string'
    ? managedStoragePath(stored, VIDEO_BUCKET, requiredPrefix)
    : null;
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage.from(VIDEO_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Add a short-lived playback URL without replacing the stable DB reference. */
export async function withPrivateVideoPreview<T extends Record<string, any>>(user: T): Promise<T & { intro_video_preview_url: string | null }> {
  // No video is the normal case. Do not turn an intentionally empty optional
  // field into a production error log.
  if (!user?.intro_video_url) return { ...user, intro_video_preview_url: null };

  const signedUrl = await signPrivateVideoReference(user?.intro_video_url, `profile/${user.id}/`, 60 * 60);
  if (!signedUrl) {
    console.error('[private-media] Could not sign profile video', { userId: user.id });
    return { ...user, intro_video_preview_url: null };
  }
  return { ...user, intro_video_preview_url: signedUrl };
}
