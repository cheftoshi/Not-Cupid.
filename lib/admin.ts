import { getCurrentUser } from '@/lib/auth';

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  if (list.length === 0) {
    console.warn('[admin] ADMIN_EMAILS env var is empty');
    return false;
  }
  // Trim incoming email too in case it has stray whitespace from the DB.
  const normalized = email.trim().toLowerCase();
  const match = list.includes(normalized);
  if (!match) {
    console.warn('[admin] email not in allowlist', {
      providedLen: normalized.length,
      providedPrefix: normalized.slice(0, 3),
      providedSuffix: normalized.slice(-6),
      allowlistSize: list.length,
      allowlistFirstLen: list[0]?.length,
    });
  }
  return match;
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isAdminEmail(user.email)) return null;
  return user;
}
