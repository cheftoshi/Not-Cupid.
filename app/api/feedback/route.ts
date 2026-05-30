import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  // Feedback is open to logged-in users (the dashboard spot); anonymous is
  // fine too if we ever surface it elsewhere — user_id just stays null.

  const { body } = await req.json().catch(() => ({ body: null }));
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Empty feedback' }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: 'Too long (max 4000 chars)' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('feedback').insert({
    user_id: user?.id ?? null,
    body: body.trim(),
  });

  if (error) {
    console.error('Feedback insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
