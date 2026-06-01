import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { neighborhoodOf } from '@/lib/neighborhoods';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['food', 'drinks', 'active', 'outdoors', 'culture', 'nightlife', 'games', 'chill', 'hang'];

// GET — live activity board, newest first. Optional ?area= &category= filters.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const area = req.nextUrl.searchParams.get('area');
  const category = req.nextUrl.searchParams.get('category');
  const nowIso = new Date().toISOString();

  let q = supabaseAdmin
    .from('friend_activities')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(60);
  if (area) q = q.eq('area', area);
  if (category) q = q.eq('category', category);
  const { data: acts } = await q;

  const ids = (acts ?? []).map((a) => a.id);
  const authorIds = Array.from(new Set((acts ?? []).map((a) => a.author_id)));
  const { data: authors } = await supabaseAdmin
    .from('users').select('id, name, photo_url')
    .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);
  const aById = new Map((authors ?? []).map((u) => [u.id, u]));

  const { data: rsvps } = await supabaseAdmin
    .from('friend_activity_rsvps').select('activity_id, user_id')
    .in('activity_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const countByAct = new Map<string, number>();
  const mineByAct = new Set<string>();
  (rsvps ?? []).forEach((r) => {
    countByAct.set(r.activity_id, (countByAct.get(r.activity_id) || 0) + 1);
    if (r.user_id === user.id) mineByAct.add(r.activity_id);
  });

  const activities = (acts ?? []).map((a) => {
    const author: any = aById.get(a.author_id) || {};
    return {
      id: a.id, title: a.title, body: a.body, category: a.category, area: a.area,
      kind: a.kind || 'event',
      happens_at: a.happens_at, created_at: a.created_at,
      authorName: author.name, authorPhoto: author.photo_url,
      isMine: a.author_id === user.id,
      rsvpCount: countByAct.get(a.id) || 0,
      iRsvped: mineByAct.has(a.id),
    };
  });

  return NextResponse.json({ activities });
}

// POST — create an activity. expires_at defaults to happens_at or +14 days.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title || '').toString().trim();
  if (!title) return NextResponse.json({ error: 'Give it a title.' }, { status: 400 });
  if (title.length > 140) return NextResponse.json({ error: 'Title too long (140 max).' }, { status: 400 });
  const kind = body.kind === 'post' ? 'post' : 'event';
  const category = CATEGORIES.includes(body.category) ? body.category : 'hang';
  // Posts have no time; events can. Posts live 7d, events until 12h after they happen (or 14d).
  const happensAt = kind === 'event' && body.happens_at ? new Date(body.happens_at) : null;
  const area = (body.area || '').toString().trim() || neighborhoodOf(user.zip);
  const expiresAt = kind === 'post'
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : happensAt
      ? new Date(happensAt.getTime() + 12 * 60 * 60 * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const { data: act, error } = await supabaseAdmin
    .from('friend_activities')
    .insert({
      author_id: user.id, title, kind,
      body: (body.body || '').toString().slice(0, 1000) || null,
      category, area,
      happens_at: happensAt ? happensAt.toISOString() : null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Author auto-RSVPs their own activity.
  await supabaseAdmin.from('friend_activity_rsvps').upsert(
    { activity_id: act.id, user_id: user.id }, { onConflict: 'activity_id,user_id' }
  );

  return NextResponse.json({ ok: true, id: act.id });
}
