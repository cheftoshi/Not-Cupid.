import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/auth';
import { verifyDevLogin } from '@/lib/dev-login';

export const dynamic = 'force-dynamic';

// Magic login for TEST accounts. Signed + expiring, AND hard-gated to is_test
// users — refuses to ever create a session for a real account.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  const exp = Number(req.nextUrl.searchParams.get('exp'));
  const sig = req.nextUrl.searchParams.get('sig');

  if (!u || !verifyDevLogin(u, exp, sig)) {
    return new NextResponse('Invalid or expired login link.', { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, is_test')
    .eq('id', u)
    .is('deleted_at', null)
    .single();

  if (!user || user.is_test !== true) {
    // Never log into a non-test account, even with a valid signature.
    return new NextResponse('Dev login is only available for test accounts.', { status: 403 });
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL('/hub', req.url));
}
