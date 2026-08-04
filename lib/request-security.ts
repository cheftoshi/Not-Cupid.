import { timingSafeEqual } from 'crypto';

export function timingSafeStringEqual(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.error('[cron] CRON_SECRET is missing or too short');
    return false;
  }
  return timingSafeStringEqual(req.headers.get('authorization'), `Bearer ${secret}`);
}

export function managedStoragePath(
  value: string,
  bucket: string,
  requiredPathPrefix: string,
): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const base = new URL(supabaseUrl);
    const candidate = new URL(value);
    const decodedPath = decodeURIComponent(candidate.pathname);
    const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
    if (candidate.protocol !== 'https:'
      || candidate.origin !== base.origin
      || candidate.username
      || candidate.password
      || candidate.search
      || candidate.hash
      || !decodedPath.startsWith(bucketPrefix)
      || decodedPath.includes('..')) return null;
    const objectPath = decodedPath.slice(bucketPrefix.length);
    return objectPath.startsWith(requiredPathPrefix) ? objectPath : null;
  } catch {
    return null;
  }
}

export function isManagedStorageUrl(value: string, bucket: string, requiredPathPrefix: string): boolean {
  return managedStoragePath(value, bucket, requiredPathPrefix) !== null;
}

export type SafeImageType = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

export function detectSafeImageType(buffer: Buffer): SafeImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export const VIDEO_UPLOAD_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
};
