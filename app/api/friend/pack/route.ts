import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { assignFriendMatches, matchCapFor } from '@/lib/friend-assign';
import { isPro } from '@/lib/pro';
import { isHardLocked } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

function metroLabel(zip: string | null | undefined): string | null {
  const m = metroOf(zip);
  return m && METRO_CENTERS[m] ? `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}` : null;
}

// Is a connection still SEALED (in an un-opened pack)? Pre-migration the column
// is absent → treat everything as already-opened so we never show a false pack.
const sealed = (c: any) => 'opened_at' in c && c.opened_at == null;

async function loadFriends(userId: string, rows: any[]) {
  const ids = rows.map((c) => (c.user_a_id === userId ? c.user_b_id : c.user_a_id));
  if (!ids.length) return [];
  const { data: others } = await supabaseAdmin
    .from('users')
    .select('id, name, age, photo_url, archetype, zip, friend_vibes, sun_sign, is_test')
    .in('id', ids);
  const byId = new Map((others ?? []).map((u) => [u.id, u]));
  const { data: me } = await supabaseAdmin.from('users').select('friend_vibes, is_test').eq('id', userId).single();
  const myActs: string[] = (me as any)?.friend_vibes?.activities ?? [];
  const meTest = (me as any)?.is_test === true;
  return rows
    .map((c) => {
      const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
      const o: any = byId.get(otherId) || {};
      const shared = (o.friend_vibes?.activities ?? []).filter((a: string) => myActs.includes(a));
      return {
        otherId, name: o.name, age: o.age, photo_url: o.photo_url, archetype: o.archetype,
        metro: metroLabel(o.zip), sharedActivities: shared, score: c.compatibility_score,
        sunSign: o.sun_sign ?? null,
        _test: o.is_test === true, _meTest: meTest,
      };
    })
    .filter((m) => m._test === m._meTest) // realm segregation
    .map(({ _test, _meTest, ...m }) => m);
}

// GET — your current SEALED pack (un-opened friend matches) + how many friends
// you've already opened. Lazily tops you up to your cap first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ optedIn: false, sealed: [], openedCount: 0 });

  const cooldownActive = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > Date.now();
  if (user.matching_disabled_at || cooldownActive) {
    return NextResponse.json({ optedIn: true, sealed: [], openedCount: 0, ghosted: true, hardLocked: isHardLocked(user.ghost_strikes) });
  }

  const cap = await matchCapFor(user.id);
  await assignFriendMatches(user.id, cap);

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined')
    .order('compatibility_score', { ascending: false });

  const all = conns ?? [];
  const sealedRows = all.filter(sealed);
  const openedCount = all.length - sealedRows.length;
  const friends = await loadFriends(user.id, sealedRows);
  return NextResponse.json({ optedIn: true, sealed: friends, openedCount, pro: isPro(user) });
}

// POST { action } — 'open' marks the sealed pack revealed; 'grant' gives an
// All-Access subscriber a free fresh pack (non-subscribers pay via checkout).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: '' }));

  if (action === 'open') {
    // Stamp every still-sealed connection as opened. (No-op / tolerated pre-migration.)
    try {
      await supabaseAdmin
        .from('friend_connections')
        .update({ opened_at: new Date().toISOString() })
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .is('opened_at', null);
    } catch { /* column not migrated yet — nothing to open */ }
    return NextResponse.json({ ok: true });
  }

  if (action === 'grant') {
    if (!isPro(user)) return NextResponse.json({ error: 'All-Access required', needsPro: true }, { status: 402 });
    // Free pack for subscribers: a synthetic round bumps the cap, then assign.
    await supabaseAdmin.from('friend_match_rounds').upsert(
      { user_id: user.id, stripe_payment_id: `pro-${user.id}-${Date.now()}` },
      { onConflict: 'stripe_payment_id' }
    );
    const cap = await matchCapFor(user.id);
    const created = await assignFriendMatches(user.id, cap);
    return NextResponse.json({ ok: true, created });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
