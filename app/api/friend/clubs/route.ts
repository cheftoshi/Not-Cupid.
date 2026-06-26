import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

const CLUB_CATS = ['running', 'books', 'fitness', 'sports', 'food', 'coffee', 'movies', 'music', 'arts', 'games', 'outdoors', 'other'];

// GET — clubs in your city (realm-segregated, not hidden), with your membership
// status + a pending-request count for clubs you run.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const meTest = (user as any).is_test === true;
  const myMetro = metroOf((user as any).zip);

  let q = supabaseAdmin.from('friend_clubs').select('*').eq('is_test', meTest).is('hidden_at', null).order('created_at', { ascending: false }).limit(100);
  if (myMetro) q = q.eq('metro', myMetro);
  const { data: clubs } = await q;

  const ids = (clubs ?? []).map((c) => c.id);
  const { data: mems } = ids.length
    ? await supabaseAdmin.from('friend_club_members').select('club_id, user_id, status').in('club_id', ids)
    : { data: [] as any[] };
  const creatorIds = Array.from(new Set((clubs ?? []).map((c) => c.creator_id)));
  const { data: creators } = creatorIds.length
    ? await supabaseAdmin.from('users').select('id, name').in('id', creatorIds)
    : { data: [] as any[] };
  const cName = new Map((creators ?? []).map((u: any) => [u.id, u.name]));

  const out = (clubs ?? []).map((c) => {
    const cm = (mems ?? []).filter((m: any) => m.club_id === c.id);
    const mine = cm.find((m: any) => m.user_id === user.id);
    const isOwner = c.creator_id === user.id;
    return {
      id: c.id, name: c.name, category: c.category, description: c.description,
      area: c.area, creatorName: cName.get(c.creator_id) || 'someone',
      memberCount: cm.filter((m: any) => m.status === 'member').length,
      myStatus: isOwner ? 'owner' : (mine ? mine.status : null),
      pendingCount: isOwner ? cm.filter((m: any) => m.status === 'pending').length : 0,
      created_at: c.created_at,
    };
  });
  return NextResponse.json({ clubs: out });
}

// POST { name, category, description, area } — start a club. Creator auto-joins.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Name your club.' }, { status: 400 });
  const category = CLUB_CATS.includes(b.category) ? b.category : 'other';
  const description = String(b.description ?? '').trim().slice(0, 400) || null;
  const area = String(b.area ?? '').trim().slice(0, 60) || null;

  const { data: club, error } = await supabaseAdmin.from('friend_clubs').insert({
    name, category, description, area,
    creator_id: user.id, metro: metroOf((user as any).zip), is_test: (user as any).is_test === true,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // creator is a member from the start.
  await supabaseAdmin.from('friend_club_members').upsert(
    { club_id: club.id, user_id: user.id, status: 'member' }, { onConflict: 'club_id,user_id' }
  );
  return NextResponse.json({ ok: true, id: club.id });
}
