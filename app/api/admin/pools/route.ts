// GET /api/admin/pools
//
// Live snapshot of the dating-pool segmentation:
//   - grid: counts of active daters by intent × tier
//   - penalty: cooldown + banned members (with detail, since these are the
//     actionable ones)
//   - matched / total summary
//
// Everything is computed live via lib/pools.ts — no stored segment column.

import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { computeSegment, INTENTS, TIERS, type Intent, type Tier } from '@/lib/pools';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const now = new Date();

    const [{ data: users }, { data: sessions }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, name, email, gender, status, pool_active, zip, relationship_style, vibes, matching_cooldown_until, matching_disabled_at, ghost_reports_received')
        .is('deleted_at', null),
      supabaseAdmin
        .from('sessions')
        .select('user_id, last_used_at')
        .order('last_used_at', { ascending: false }),
    ]);

    // Latest session timestamp per user (sessions came back desc, so first wins).
    const lastSeen = new Map<string, Date>();
    for (const s of sessions ?? []) {
      if (!lastSeen.has(s.user_id) && s.last_used_at) {
        lastSeen.set(s.user_id, new Date(s.last_used_at));
      }
    }

    // grid[intent][tier] = count
    const grid: Record<Intent, Record<Tier, number>> = {
      serious: { A: 0, B: 0, next: 0 },
      casual:  { A: 0, B: 0, next: 0 },
      enm:     { A: 0, B: 0, next: 0 },
      open:    { A: 0, B: 0, next: 0 },
    };

    const cooldown: any[] = [];
    const banned: any[] = [];
    let matched = 0;
    let activeTotal = 0;

    // Per-metro tally (area pools) — active + matched users by nearest metro.
    const byMetro: Record<string, number> = { boston: 0, worcester: 0, providence: 0, other: 0 };

    for (const u of users ?? []) {
      const seg = computeSegment(u, lastSeen.get(u.id) ?? null, now);
      if (seg.kind === 'active' || seg.kind === 'matched') {
        const m = metroOf(u.zip);
        byMetro[m ?? 'other']++;
      }
      switch (seg.kind) {
        case 'active':
          grid[seg.intent!][seg.tier!]++;
          activeTotal++;
          break;
        case 'matched':
          matched++;
          break;
        case 'cooldown':
          cooldown.push({
            id: u.id, name: u.name, email: u.email,
            cooldownUntil: seg.cooldownUntil,
            ghostReports: seg.ghostReports,
          });
          break;
        case 'banned':
          banned.push({
            id: u.id, name: u.name, email: u.email,
            ghostReports: seg.ghostReports,
          });
          break;
      }
    }

    // Sort cooldown by soonest release first.
    cooldown.sort((a, b) => new Date(a.cooldownUntil).getTime() - new Date(b.cooldownUntil).getTime());

    return NextResponse.json({
      grid,
      intents: INTENTS,
      tiers: TIERS,
      byMetro,
      metroLabels: Object.fromEntries(Object.entries(METRO_CENTERS).map(([k, v]) => [k, v.label])),
      penalty: { cooldown, banned },
      summary: {
        total: users?.length ?? 0,
        active: activeTotal,
        matched,
        cooldown: cooldown.length,
        banned: banned.length,
      },
    });
  } catch (err: any) {
    console.error('admin/pools error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
