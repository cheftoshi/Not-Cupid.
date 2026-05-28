import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { suggestEmailCorrection } from '@/lib/email-typos';

export const dynamic = 'force-dynamic';

/**
 * GET  — returns the list of users whose stored email matches a known typo
 *        pattern, along with the proposed correction. No DB writes.
 *
 * POST — applies the corrections. Also clears quiz_blast_sent_at on fixed users
 *        so they get included in the next blast retry.
 *
 *        Body (optional): { ids: string[] } to fix only specific users; if omitted,
 *        fixes all detected typos.
 */

async function findCandidates() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, created_at, quiz_blast_sent_at')
    .is('deleted_at', null)
    .not('email', 'is', null);

  if (error) throw error;

  const candidates: Array<{ id: string; name: string | null; email: string; suggestion: string; createdAt: string; alreadyBlasted: boolean }> = [];
  for (const u of users || []) {
    const suggestion = suggestEmailCorrection(u.email);
    if (suggestion) {
      candidates.push({
        id: u.id,
        name: u.name,
        email: u.email,
        suggestion,
        createdAt: u.created_at,
        alreadyBlasted: !!u.quiz_blast_sent_at,
      });
    }
  }
  return candidates;
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const candidates = await findCandidates();
  return NextResponse.json({ count: candidates.length, candidates });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const restrictToIds: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

  const candidates = await findCandidates();
  const targets = restrictToIds
    ? candidates.filter((c) => restrictToIds.includes(c.id))
    : candidates;

  let fixed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const c of targets) {
    // Skip if another user already owns the corrected email (would violate unique constraint).
    const { data: clash } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', c.suggestion)
      .neq('id', c.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (clash) {
      failed++;
      errors.push(`${c.email} → ${c.suggestion}: already taken by another user`);
      continue;
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ email: c.suggestion, quiz_blast_sent_at: null })
      .eq('id', c.id);

    if (error) {
      failed++;
      errors.push(`${c.email}: ${error.message}`);
    } else {
      fixed++;
    }
  }

  return NextResponse.json({
    success: true,
    candidatesFound: candidates.length,
    targeted: targets.length,
    fixed,
    failed,
    errors: errors.slice(0, 20),
  });
}
