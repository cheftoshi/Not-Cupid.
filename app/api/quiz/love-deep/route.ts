import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_RELATIONSHIP_STYLES = new Set([
  'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
]);

/**
 * POST /api/quiz/love-deep
 *
 * The Love-line deep quiz (partner prefs + attachment + values). Runs for an
 * already-authenticated user who finished the core quiz and is boarding Love.
 * Enriches the love profile and ensures they're in the love pool. Does NOT
 * touch HEXACO scores (the core quiz owns those), so it's non-destructive.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { attach_anxiety, attach_avoidance, attach_style, values_profile, relationship_style } = body;

  const clamp100 = (v: any) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

  // Base update never depends on the v2 columns, so the fallback below always
  // has something safe to write.
  const base: any = { status: 'waiting', pool_active: true, roster_snapshot: [], roster_refreshed_at: null };
  if (relationship_style && VALID_RELATIONSHIP_STYLES.has(relationship_style)) {
    base.relationship_style = relationship_style;
  }

  const v2: any = {};
  if (attach_anxiety != null) v2.attach_anxiety = clamp100(attach_anxiety);
  if (attach_avoidance != null) v2.attach_avoidance = clamp100(attach_avoidance);
  if (['secure', 'anxious', 'avoidant', 'fearful'].includes(attach_style)) v2.attach_style = attach_style;
  if (values_profile && typeof values_profile === 'object') v2.values_profile = values_profile;

  let { error } = await supabaseAdmin
    .from('users')
    .update({ ...base, ...v2 })
    .eq('id', user.id);

  // Graceful fallback if quiz-v2 columns aren't migrated yet.
  if (error && /attach_|values_profile|column|schema cache/i.test(error.message || '')) {
    console.warn('Love-deep: quiz-v2 columns missing — run 20260609 migration. Saving without them.');
    ({ error } = await supabaseAdmin.from('users').update(base).eq('id', user.id));
  }

  if (error) {
    console.error('Love-deep update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
