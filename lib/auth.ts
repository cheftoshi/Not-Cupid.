import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

const COOKIE_NAME = 'nc_session';
const SESSION_DAYS = 30;

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin.from('sessions').insert({
    token: tokenHash,
    token_hash_version: 1,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('createSession insert failed:', error);
    throw new Error(`Session insert failed: ${error.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
    priority: 'high',
  });

  return token;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = hashSessionToken(token);

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('token, token_hash_version, user_id, expires_at')
    .in('token', [tokenHash, token])
    .limit(1)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin.from('sessions').delete().eq('token', session.token);
    cookieStore.delete(COOKIE_NAME);
    return null;
  }

  // Transparently migrate sessions created before tokens were hashed at rest.
  if (session.token === token) {
    await supabaseAdmin.from('sessions').update({ token: tokenHash, token_hash_version: 1 }).eq('token', token);
  }

  supabaseAdmin
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', tokenHash)
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
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return;

  await supabaseAdmin.from('sessions').delete().in('token', [hashSessionToken(token), token]);
  cookieStore.delete(COOKIE_NAME);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
