// GET /api/admin/feedback — recent app feedback drops, with who sent each.
import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { data: rows } = await supabaseAdmin
      .from('feedback')
      .select('id, user_id, body, created_at, replied_at, reply_body')
      .order('created_at', { ascending: false })
      .limit(200);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    const { data: users } = ids.length
      ? await supabaseAdmin.from('users').select('id, name, email').in('id', ids)
      : { data: [] as any[] };
    const byId = new Map((users ?? []).map((u: any) => [u.id, u]));

    const items = (rows ?? []).map((r: any) => {
      const u = r.user_id ? byId.get(r.user_id) : null;
      return {
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        replied_at: r.replied_at,
        reply_body: r.reply_body,
        user: u ? { name: u.name, email: u.email } : null,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err: any) {
    console.error('admin/feedback error', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
