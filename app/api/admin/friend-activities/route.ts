import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// GET — recent Scene activities (events + posts) for moderation, newest first,
// with author info and a soft "red flag" heuristic so flagged ones float up.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: acts } = await supabaseAdmin.from('friend_activities')
    .select('id, title, kind, body, category, area, location, author_id, audience_gender, capacity, created_at')
    .order('created_at', { ascending: false }).limit(100);

  const ids = Array.from(new Set((acts ?? []).map((a) => a.author_id)));
  const { data: authors } = ids.length
    ? await supabaseAdmin.from('users').select('id, name, gender, age, email, is_test').in('id', ids)
    : { data: [] as any[] };
  const byId = new Map((authors ?? []).map((u: any) => [u.id, u]));

  const items = (acts ?? []).map((a) => {
    const au: any = byId.get(a.author_id) || {};
    const aud = Array.isArray(a.audience_gender) ? a.audience_gender : [];
    // Red flag: an event that targets a gender its author isn't (e.g. a man's
    // "women only" event). The forward fix removed this; this surfaces legacy ones.
    const flag = (a.kind || 'event') !== 'post' && aud.length > 0 && au.gender && !aud.includes(au.gender) && !aud.includes('lgbtq');
    return {
      id: a.id, title: a.title, kind: a.kind || 'event', category: a.category, area: a.area,
      location: a.location ?? null, body: a.body ?? null, capacity: a.capacity ?? null,
      created_at: a.created_at, audienceGender: aud, isTest: au.is_test === true, flag,
      author: { id: a.author_id, name: au.name || '—', gender: au.gender || null, age: au.age ?? null, email: au.email || null },
    };
  });
  return NextResponse.json({ activities: items });
}

// POST { id } — delete a Scene activity (admin moderation). Removes its RSVPs +
// comments first so nothing is orphaned.
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await supabaseAdmin.from('friend_activity_rsvps').delete().eq('activity_id', id);
  await supabaseAdmin.from('friend_activity_comments').delete().eq('activity_id', id);
  const { error } = await supabaseAdmin.from('friend_activities').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
