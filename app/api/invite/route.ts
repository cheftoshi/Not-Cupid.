import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

// GET — your personal invite link (code lazily generated on first ask).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let code: string | null = (user as any).invite_code || null;
  if (!code) {
    // Short, readable, collision-retried. Graceful pre-migration: if the column
    // doesn't exist yet the update errors and we just report unavailable.
    for (let i = 0; i < 4 && !code; i++) {
      const candidate = Math.random().toString(36).slice(2, 8);
      const { error } = await supabaseAdmin.from('users').update({ invite_code: candidate }).eq('id', user.id);
      if (!error) code = candidate;
      else if (!/duplicate|unique/i.test(error.message || '')) {
        return NextResponse.json({ error: 'Invites are warming up — try again shortly.' }, { status: 503 });
      }
    }
  }
  if (!code) return NextResponse.json({ error: 'Could not create your link — try again.' }, { status: 500 });
  return NextResponse.json({ code, url: `${SITE}/join/${code}` });
}
