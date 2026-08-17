// GET /api/admin/pool-health
//
// The diagnostic layer for matching/pool optimization. Everything here is
// computed from existing users + matches data — no new tracking columns.
// The point is to SEE saturation before tuning the algorithm:
//
//   - funnel:      signup → quiz → in-pool → matched → both-accepted
//   - conversion:  match → mutual-accept rate (the core "does it work" metric)
//   - wait:        how long active daters sit before a (re)match
//   - skew:        active-pool gender ratio (supply imbalance)
//   - stagnant:    pool users matched ≥3× with 0 mutual accepts (the residue)
//   - blackHoles:  in-pool users with the lowest personal accept rate
//                  (chronic passers who burn match cycles)

import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const now = Date.now();
    const since90Iso = new Date(now - 90 * DAY).toISOString();

    const [users, matches, feedbackRows, messageRows, coachRows] = await Promise.all([
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('users')
        .select('id, name, email, gender, status, pool_active, archetype, created_at, matching_cooldown_until, matching_disabled_at')
        .is('deleted_at', null)
        .not('is_test', 'is', true)
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('matches')
        .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, ended_at, ended_reason, created_at, compatibility_score, algorithm_version')
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('date_feedback')
        .select('id,user_id')
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('messages')
        .select('id,match_id,sender_id,created_at')
        .gte('created_at', since90Iso)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
        .from('love_ai_coach_cache')
        .select('match_id,user_id,source,stage,generated_at')
        .gte('generated_at', since90Iso)
        .order('generated_at', { ascending: true })
        .order('match_id', { ascending: true })
        .order('user_id', { ascending: true })
        .order('stage', { ascending: true })
        .range(from, to)),
    ]);

    const U = users;
    const realUserIds = new Set(U.map((u) => u.id));
    const M = matches.filter((m) => realUserIds.has(m.user_1_id) && realUserIds.has(m.user_2_id));

    // ── Per-user aggregates from matches ──────────────────────────────────
    type Agg = { involved: number; accepts: number; mutual: number; lastEndedAt: number | null };
    const agg = new Map<string, Agg>();
    const ensure = (id: string): Agg => {
      let a = agg.get(id);
      if (!a) { a = { involved: 0, accepts: 0, mutual: 0, lastEndedAt: null }; agg.set(id, a); }
      return a;
    };
    for (const m of M) {
      const both = !!(m.user_1_accepted && m.user_2_accepted);
      const endedTs = m.ended_at ? new Date(m.ended_at).getTime() : null;
      for (const [uid, accepted] of [
        [m.user_1_id, m.user_1_accepted],
        [m.user_2_id, m.user_2_accepted],
      ] as Array<[string, boolean]>) {
        if (!uid) continue;
        const a = ensure(uid);
        a.involved++;
        if (accepted) a.accepts++;
        if (both) a.mutual++;
        if (endedTs && (a.lastEndedAt === null || endedTs > a.lastEndedAt)) a.lastEndedAt = endedTs;
      }
    }

    // ── Funnel ────────────────────────────────────────────────────────────
    const signups = U.length;
    const quizComplete = U.filter((u) => !!u.archetype).length;
    const isPenalty = (u: any) =>
      u.matching_disabled_at || (u.matching_cooldown_until && new Date(u.matching_cooldown_until).getTime() > now);
    const inPool = U.filter((u) => u.status === 'waiting' && u.pool_active && !isPenalty(u)).length;
    const matched = U.filter((u) => u.status === 'matched').length;
    const everBothAccepted = new Set<string>();
    for (const m of M) {
      if (m.user_1_accepted && m.user_2_accepted) {
        everBothAccepted.add(m.user_1_id);
        everBothAccepted.add(m.user_2_id);
      }
    }

    // ── Conversion (match → mutual accept) ────────────────────────────────
    const created = M.length;
    const bothAccepted = M.filter((m) => m.user_1_accepted && m.user_2_accepted).length;
    const pending = M.filter((m) => m.status === 'pending' && !m.ended_at && !(m.user_1_accepted && m.user_2_accepted)).length;
    const passed = M.filter((m) => m.status === 'passed' || m.ended_reason === 'one_passed' || m.ended_reason === 'mutual_pass').length;
    const ghosted = M.filter((m) => m.ended_reason === 'ghosted').length;
    const expired = M.filter((m) => m.status === 'expired' || m.ended_reason === 'expired').length;
    const decided = created - pending;
    const conversionPct = decided > 0 ? Math.round((bothAccepted / decided) * 100) : null;

    // ── Wait time for active daters (approximate) ─────────────────────────
    // waitStart = most recent match ended_at, else signup. Captures "how long
    // has this person been waiting for their next match right now."
    const activeDaters = U.filter((u) => u.status === 'waiting' && u.pool_active && !isPenalty(u));
    const waitDays = activeDaters.map((u) => {
      const a = agg.get(u.id);
      const start = a?.lastEndedAt ?? new Date(u.created_at).getTime();
      return Math.max(0, (now - start) / DAY);
    });
    const longWaiters = activeDaters
      .map((u) => {
        const a = agg.get(u.id);
        const start = a?.lastEndedAt ?? new Date(u.created_at).getTime();
        return { id: u.id, name: u.name, email: u.email, days: round1((now - start) / DAY) };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);

    // ── Active-pool gender skew ───────────────────────────────────────────
    const poolM = activeDaters.filter((u) => u.gender === 'm').length;
    const poolF = activeDaters.filter((u) => u.gender === 'f').length;
    const poolOther = activeDaters.length - poolM - poolF;
    const binaryPool = poolM + poolF;
    const skewPct = binaryPool > 0 ? Math.round((Math.max(poolM, poolF) / binaryPool) * 100) : null;
    const skewToward = poolM === poolF ? null : poolM > poolF ? 'men' : 'women';

    // ── Stagnant residue: in pool, matched ≥3, 0 mutual accepts ───────────
    const stagnant = activeDaters
      .map((u) => ({ u, a: agg.get(u.id) }))
      .filter(({ a }) => a && a.involved >= 3 && a.mutual === 0)
      .map(({ u, a }) => ({ id: u.id, name: u.name, email: u.email, matches: a!.involved, accepts: a!.accepts }))
      .sort((x, y) => y.matches - x.matches)
      .slice(0, 12);

    // ── Black holes: in-pool users with lowest personal accept rate ───────
    const blackHoles = activeDaters
      .map((u) => ({ u, a: agg.get(u.id) }))
      .filter(({ a }) => a && a.involved >= 3)
      .map(({ u, a }) => ({
        id: u.id, name: u.name, email: u.email,
        matches: a!.involved, accepts: a!.accepts,
        acceptRate: Math.round((a!.accepts / a!.involved) * 100),
      }))
      .sort((x, y) => x.acceptRate - y.acceptRate)
      .slice(0, 10);

    // ── Conversation quality + AI activation (rolling 90 days) ───────────
    // Mutual accept is not the finish line: measure whether both people enter
    // the chat and whether the exchange gets past a token opener.
    const recentMatches = M.filter((m) => new Date(m.created_at).getTime() >= now - 90 * DAY);
    const recentMatchIds = new Set(recentMatches.map((m) => m.id));
    const sendersByMatch = new Map<string, Set<string>>();
    const messageCountByMatch = new Map<string, number>();
    for (const row of messageRows) {
      if (!recentMatchIds.has(row.match_id) || !realUserIds.has(row.sender_id)) continue;
      const senders = sendersByMatch.get(row.match_id) ?? new Set<string>();
      senders.add(row.sender_id);
      sendersByMatch.set(row.match_id, senders);
      messageCountByMatch.set(row.match_id, (messageCountByMatch.get(row.match_id) ?? 0) + 1);
    }
    const mutual90 = recentMatches.filter((m) => m.user_1_accepted && m.user_2_accepted);
    const bothMessaged90 = mutual90.filter((m) => {
      const senders = sendersByMatch.get(m.id);
      return !!senders?.has(m.user_1_id) && !!senders?.has(m.user_2_id);
    }).length;
    const fivePlus90 = mutual90.filter((m) => (messageCountByMatch.get(m.id) ?? 0) >= 5).length;
    const algorithmVersions: Record<string, number> = {};
    for (const match of recentMatches) {
      const version = match.algorithm_version || 'legacy';
      algorithmVersions[version] = (algorithmVersions[version] ?? 0) + 1;
    }
    const realCoachRows = coachRows.filter((row) => realUserIds.has(row.user_id));
    const coachStages: Record<string, number> = {};
    for (const row of realCoachRows) coachStages[row.stage] = (coachStages[row.stage] ?? 0) + 1;

    return NextResponse.json({
      funnel: { signups, quizComplete, inPool, matched, everBothAccepted: everBothAccepted.size },
      conversion: { created, bothAccepted, pending, passed, ghosted, expired, conversionPct },
      wait: {
        activeWaiting: activeDaters.length,
        medianDays: round1(median(waitDays)),
        p75Days: round1(percentile(waitDays, 75)),
        maxDays: round1(waitDays.length ? Math.max(...waitDays) : 0),
        longWaiters,
      },
      skew: { m: poolM, f: poolF, other: poolOther, skewPct, skewToward },
      stagnant,
      blackHoles,
      conversations90d: {
        created: recentMatches.length,
        mutual: mutual90.length,
        bothMessaged: bothMessaged90,
        fivePlusMessages: fivePlus90,
        mutualToBothMessagedPct: mutual90.length ? Math.round((bothMessaged90 / mutual90.length) * 100) : null,
        algorithmVersions,
      },
      aiCoach90d: {
        cardsGenerated: realCoachRows.length,
        users: new Set(realCoachRows.map((row) => row.user_id)).size,
        ai: realCoachRows.filter((row) => row.source === 'ai').length,
        curated: realCoachRows.filter((row) => row.source === 'curated').length,
        stages: coachStages,
      },
      dates: { feedbackResponses: feedbackRows.filter((row) => realUserIds.has(row.user_id)).length },
    });
  } catch (err: any) {
    console.error('admin/pool-health error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
