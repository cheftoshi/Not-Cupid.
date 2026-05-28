import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { data: feedback, error: fbErr } = await supabaseAdmin
      .from('date_feedback')
      .select('id, match_id, user_id, rating, would_again, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fbErr) throw fbErr;
    const rows = feedback ?? [];

    // Bulk-fetch matches and users to avoid N+1.
    const matchIds = Array.from(new Set(rows.map((r) => r.match_id)));
    const reviewerIds = Array.from(new Set(rows.map((r) => r.user_id)));

    const [{ data: matches }, { data: reviewers }] = await Promise.all([
      matchIds.length
        ? supabaseAdmin
            .from('matches')
            .select('id, user_1_id, user_2_id, compatibility_score, created_at')
            .in('id', matchIds)
        : Promise.resolve({ data: [] as any[] }),
      reviewerIds.length
        ? supabaseAdmin.from('users').select('id, name, email').in('id', reviewerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const matchById = new Map((matches ?? []).map((m: any) => [m.id, m]));
    const reviewerById = new Map((reviewers ?? []).map((u: any) => [u.id, u]));

    // Collect the "other user" ids from the matches so we can look them up too.
    const otherIds = new Set<string>();
    for (const r of rows) {
      const m = matchById.get(r.match_id);
      if (!m) continue;
      otherIds.add(m.user_1_id === r.user_id ? m.user_2_id : m.user_1_id);
    }
    const { data: others } = otherIds.size
      ? await supabaseAdmin.from('users').select('id, name, email').in('id', Array.from(otherIds))
      : { data: [] as any[] };
    const otherById = new Map((others ?? []).map((u: any) => [u.id, u]));

    const items = rows.map((r) => {
      const m = matchById.get(r.match_id);
      const otherUserId = m ? (m.user_1_id === r.user_id ? m.user_2_id : m.user_1_id) : null;
      const reviewer = reviewerById.get(r.user_id);
      const ratedUser = otherUserId ? otherById.get(otherUserId) : null;
      return {
        id: r.id,
        match_id: r.match_id,
        rating: r.rating,
        would_again: r.would_again,
        notes: r.notes,
        created_at: r.created_at,
        reviewer: reviewer ? { name: reviewer.name, email: reviewer.email } : null,
        rated_user: ratedUser ? { name: ratedUser.name, email: ratedUser.email } : null,
        match: m ? { score: m.compatibility_score, created_at: m.created_at } : null,
      };
    });

    // Aggregate stats — useful for marketing copy.
    const total = items.length;
    const avgRating = total
      ? Math.round((items.reduce((s, x) => s + x.rating, 0) / total) * 10) / 10
      : null;
    const wouldAgainYes = items.filter((x) => x.would_again === true).length;
    const wouldAgainNo = items.filter((x) => x.would_again === false).length;
    const decided = wouldAgainYes + wouldAgainNo;
    const wouldAgainPct = decided > 0 ? Math.round((wouldAgainYes / decided) * 100) : null;

    return NextResponse.json({
      items,
      stats: { total, avgRating, wouldAgainYes, wouldAgainNo, wouldAgainPct },
    });
  } catch (err: any) {
    console.error('Admin date-feedback error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
