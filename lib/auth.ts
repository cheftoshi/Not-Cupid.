import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

const COOKIE_NAME = 'nc_session';
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin.from('sessions').insert({
    token,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('createSession insert failed:', error);
    throw new Error(`Session insert failed: ${error.message}`);
  }

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

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  supabaseAdmin
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)
    .then(() => {});

  const { data: user } = await supabaseAdmin
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

  await supabaseAdmin.from('sessions').delete().eq('token', token);
  cookies().delete(COOKIE_NAME);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
