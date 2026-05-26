import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const COOKIE_NAME = 'nc_session';
const SESSION_DAYS = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createSession(userId: string) {
  const supabase = getSupabase();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await supabase.from('sessions').insert({
    token,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = getSupabase();

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)
    .then(() => {});

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .is('deleted_at', null)
    .single();

  return user;
}

export async function destroySession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return;

  const supabase = getSupabase();
  await supabase.from('sessions').delete().eq('token', token);
  cookies().delete(COOKIE_NAME);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
