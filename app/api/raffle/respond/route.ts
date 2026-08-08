import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE } from '@/lib/raffle';
import { sendPushToUser } from '@/lib/push';
import { drawRaffle } from '@/lib/raffle-draw';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type Decision = { pairId: string; accept: boolean; favorite: boolean };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `raffle-response:${user.id}`, windowSec: 3600, maxAttempts: 10, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.decisions)) {
    const rawDecisions = body.decisions.slice(0, RAFFLE.shortlistMaxOptions);
    if (rawDecisions.some((item: any) => typeof item?.accept !== 'boolean' || typeof item?.favorite !== 'boolean')) {
      return NextResponse.json({ error: 'Every shortlist decision must be an explicit yes or pass.' }, { status: 400 });
    }
    const decisions: Decision[] = rawDecisions.map((item: any) => ({
      pairId: String(item?.pairId || '').slice(0, 100),
      accept: item?.accept === true,
      favorite: item?.favorite === true,
    }));
    if (!decisions.length || new Set(decisions.map((decision) => decision.pairId)).size !== decisions.length) {
      return NextResponse.json({ error: 'Submit one decision for every shortlist option.' }, { status: 400 });
    }
    if (decisions.some((decision) => !decision.pairId || (decision.favorite && !decision.accept))) {
      return NextResponse.json({ error: 'A favorite must also be someone you would meet.' }, { status: 400 });
    }
    if (decisions.filter((decision) => decision.favorite).length > 1) {
      return NextResponse.json({ error: 'Choose at most one favorite.' }, { status: 400 });
    }

    const { data: rows } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .select('id, round_id, user_a_id, user_b_id, a_accepted, b_accepted, status')
      .eq('event_key', RAFFLE.key)
      .eq('status', 'pending')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
    const targetRows = (rows ?? []).filter((row) => decisions.some((decision) => decision.pairId === row.id));
    if (!targetRows.length || targetRows.length !== decisions.length) {
      return NextResponse.json({ error: 'That shortlist is no longer active.' }, { status: 409 });
    }
    const roundIds = new Set(targetRows.map((row) => row.round_id));
    if (roundIds.size !== 1) return NextResponse.json({ error: 'Submit one shortlist round at a time.' }, { status: 400 });
    const roundId = targetRows[0].round_id;
    const activeRows = (rows ?? []).filter((row) => row.round_id === roundId);
    if (activeRows.length !== decisions.length || activeRows.some((row) => !decisions.some((decision) => decision.pairId === row.id))) {
      return NextResponse.json({ error: 'Submit a decision for every person in your shortlist.' }, { status: 400 });
    }
    const choicesAlreadySealed = activeRows.every((row) => (
      row.user_a_id === user.id ? row.a_accepted : row.b_accepted
    ) !== null);
    if (choicesAlreadySealed) {
      return NextResponse.json({ error: 'Your private choices are already sealed.' }, { status: 409 });
    }
    const { data: round } = await supabaseAdmin.from('dating_experiment_rounds')
      .select('status, response_deadline')
      .eq('id', roundId)
      .maybeSingle();
    if (!round || round.status !== 'collecting' || Date.now() >= new Date(round.response_deadline).getTime()) {
      return NextResponse.json({ error: 'This decision window has closed.' }, { status: 409 });
    }

    const { data: sealedCount, error: sealError } = await supabaseAdmin.rpc(
      'submit_dating_experiment_shortlist_choices',
      { p_round_id: roundId, p_user_id: user.id, p_decisions: decisions },
    );
    if (sealError || sealedCount !== decisions.length) {
      const conflict = /already sealed|window is closed|not active/i.test(sealError?.message ?? '');
      if (!conflict) console.error('[dating-experiment-seal]', sealError);
      return NextResponse.json(
        { error: conflict ? 'This shortlist is already sealed or closed.' : 'Could not save your private choices.' },
        { status: conflict ? 409 : 500 },
      );
    }
    const resolution = await drawRaffle().catch((error) => {
      console.error('[dating-experiment-resolve]', error);
      return null;
    });
    return NextResponse.json({ ok: true, state: resolution?.state ?? 'choices-locked' });
  }

  // Legacy single-pair response support for a pending V1 draw, if one exists.
  const accept = body.accept === true;
  const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
    .eq('event_key', RAFFLE.key)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq('status', 'pending')
    .limit(1);
  const draw = draws?.[0];
  if (!draw) return NextResponse.json({ error: 'No active experiment shortlist.' }, { status: 404 });
  const isA = draw.user_a_id === user.id;
  const otherId = isA ? draw.user_b_id : draw.user_a_id;
  if (!accept) {
    await supabaseAdmin.from('raffle_draws').update({ status: 'declined' }).eq('id', draw.id).eq('status', 'pending');
    return NextResponse.json({ ok: true, status: 'declined' });
  }
  const patch = isA ? { a_accepted: true } : { b_accepted: true };
  await supabaseAdmin.from('raffle_draws').update(patch).eq('id', draw.id).eq('status', 'pending');
  const { data: current } = await supabaseAdmin.from('raffle_draws').select('a_accepted, b_accepted').eq('id', draw.id).single();
  if (current?.a_accepted && current?.b_accepted) {
    const { data: claimed } = await supabaseAdmin.from('raffle_draws')
      .update({ status: 'both_accepted', restaurant: RAFFLE.restaurant, happens_at: RAFFLE.happensAt })
      .eq('id', draw.id).eq('status', 'pending').select('id').maybeSingle();
    if (claimed) {
      const message = { title: "It's a date! ✦", body: `You both said yes. Open the Dating Experiment for dinner details.`, url: '/dating-experiment', tag: `dating-experiment-${draw.id}` };
      await Promise.allSettled([sendPushToUser(user.id, message), sendPushToUser(otherId, message)]);
    }
  }
  return NextResponse.json({ ok: true });
}
