// GET  /api/admin/reports — recent user reports with reporter + reported info
//   and how many total reports each reported user has accrued.
// POST /api/admin/reports — { userId, action: 'block' | 'unblock' }

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: rows } = await supabaseAdmin
    .from('user_reports')
    .select('id, reporter_id, reported_id, reason, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((rows ?? []).flatMap((r: any) => [r.reporter_id, r.reported_id])));
  const { data: users } = ids.length
    ? await supabaseAdmin.from('users').select('id, name, email, is_blocked').in('id', ids)
    : { data: [] as any[] };
  const byId = new Map((users ?? []).map((u: any) => [u.id, u]));

  // Count reports per reported user.
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.reported_id, (counts.get(r.reported_id) || 0) + 1);

  const items = (rows ?? []).map((r: any) => {
    const reporter = byId.get(r.reporter_id);
    const reported = byId.get(r.reported_id);
    return {
      id: r.id,
      reason: r.reason,
      detail: r.detail,
      created_at: r.created_at,
      reporter: reporter ? { name: reporter.name, email: reporter.email } : null,
      reported: reported
        ? { id: reported.id, name: reported.name, email: reported.email, is_blocked: reported.is_blocked, reportCount: counts.get(r.reported_id) || 1 }
        : null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId : null;
  const action = body?.action;
  if (!userId || (action !== 'block' && action !== 'unblock')) {
    return NextResponse.json({ error: 'userId + action required' }, { status: 400 });
  }

  const blocked = action === 'block';
  const updates: Record<string, any> = { is_blocked: blocked };
  // Blocking also pulls them from the pool immediately.
  if (blocked) { updates.pool_active = false; updates.status = 'inactive'; }

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
