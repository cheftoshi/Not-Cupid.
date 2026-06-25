import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { neighborhoodOf } from '@/lib/neighborhoods';
import { isLgbtqIdentity } from '@/lib/friend-matching';

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

  const countByAct = new Map<string, number>();
  const respByAct = new Map<string, { yes: number; maybe: number; no: number }>();
  const myRespByAct = new Map<string, string>();
  if (ids.length) {
    // Tallies via a DB aggregate (activity_rsvp_counts) instead of pulling every
    // RSVP row into the API and counting in JS — the old way scaled with the
    // total number of RSVPs across all shown events.
    const { data: counts, error: rpcErr } = await supabaseAdmin.rpc('activity_rsvp_counts', { p_ids: ids });
    if (!rpcErr && Array.isArray(counts)) {
      for (const c of counts as any[]) {
        const tally = { yes: c.yes ?? 0, maybe: c.maybe ?? 0, no: c.no ?? 0 };
        respByAct.set(c.activity_id, tally);
        countByAct.set(c.activity_id, tally.yes + tally.maybe + tally.no);
      }
      // The caller's OWN response per activity — bounded by the ~60 shown events.
      const { data: mine } = await supabaseAdmin
        .from('friend_activity_rsvps').select('activity_id, response')
        .eq('user_id', user.id).in('activity_id', ids);
      (mine ?? []).forEach((r) => myRespByAct.set(r.activity_id, (r.response || 'yes')));
    } else {
      // Fallback (RPC not migrated yet — 20260617_activity_rsvp_counts.sql): the
      // original fetch-all tally, so the board never breaks pre-migration.
      const { data: rsvps } = await supabaseAdmin
        .from('friend_activity_rsvps').select('activity_id, user_id, response').in('activity_id', ids);
      (rsvps ?? []).forEach((r) => {
        const resp = (r.response || 'yes') as 'yes' | 'maybe' | 'no';
        countByAct.set(r.activity_id, (countByAct.get(r.activity_id) || 0) + 1);
        const tally = respByAct.get(r.activity_id) || { yes: 0, maybe: 0, no: 0 };
        if (resp === 'yes' || resp === 'maybe' || resp === 'no') tally[resp]++;
        respByAct.set(r.activity_id, tally);
        if (r.user_id === user.id) myRespByAct.set(r.activity_id, resp);
      });
    }
  }

  // Comment counts per shown post (Scene posts are commentable). Graceful if the
  // comments table isn't migrated yet.
  const commentCountByAct = new Map<string, number>();
  if (ids.length) {
    try {
      const { data: cRows } = await supabaseAdmin
        .from('friend_activity_comments').select('activity_id').in('activity_id', ids);
      (cRows ?? []).forEach((c: any) => commentCountByAct.set(c.activity_id, (commentCountByAct.get(c.activity_id) || 0) + 1));
    } catch { /* not migrated yet */ }
  }

  // Is this responder inside an event's audience (gender + age)? Author always is.
  const eligibleFor = (a: any) => {
    if (a.author_id === user.id) return true;
    if ((a.kind || 'event') !== 'event') return true;
    const aud = a.audience_gender;
    if (Array.isArray(aud) && aud.length > 0) {
      const inGender = aud.includes(user.gender) || (aud.includes('lgbtq') && isLgbtqIdentity(user));
      if (!inGender) return false;
    }
    if (a.audience_age_min != null && (user.age == null || user.age < a.audience_age_min)) return false;
    if (a.audience_age_max != null && (user.age == null || user.age > a.audience_age_max)) return false;
    return true;
  };

  const activities = (acts ?? []).map((a) => {
    const author: any = aById.get(a.author_id) || {};
    return {
      id: a.id, title: a.title, body: a.body, category: a.category, area: a.area,
      location: a.location ?? null,
      kind: a.kind || 'event',
      happens_at: a.happens_at, created_at: a.created_at,
      authorName: author.name, authorPhoto: author.photo_url,
      isMine: a.author_id === user.id,
      rsvpCount: countByAct.get(a.id) || 0,
      commentCount: commentCountByAct.get(a.id) || 0,
      iRsvped: myRespByAct.has(a.id),
      // event extras
      audienceGender: a.audience_gender || null,
      audienceAgeMin: a.audience_age_min ?? null,
      audienceAgeMax: a.audience_age_max ?? null,
      eligible: eligibleFor(a),
      responses: respByAct.get(a.id) || { yes: 0, maybe: 0, no: 0 },
      myResponse: myRespByAct.get(a.id) || null,
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

  // Audience targeting (events only). Gender = subset of m/f/nb (empty/null =
  // everyone). Age bounds clamped to 18–120. Posts ignore all this.
  const GENDERS = ['m', 'f', 'nb', 'lgbtq'];
  let audienceGender: string[] | null = null;
  if (kind === 'event' && Array.isArray(body.audience_gender)) {
    const g = body.audience_gender.filter((x: any) => GENDERS.includes(x));
    audienceGender = g.length && g.length < GENDERS.length ? g : null; // all-or-empty = everyone
  }
  const clampAge = (v: any) => { const n = parseInt(v); return Number.isFinite(n) ? Math.max(18, Math.min(120, n)) : null; };
  const audMin = kind === 'event' ? clampAge(body.audience_age_min) : null;
  const audMax = kind === 'event' ? clampAge(body.audience_age_max) : null;

  // Events can name a specific place/venue (free text), separate from the zone.
  const location = kind === 'event' ? ((body.location || '').toString().trim().slice(0, 120) || null) : null;

  const baseRow: any = {
    author_id: user.id, title, kind,
    body: (body.body || '').toString().slice(0, 1000) || null,
    category, area,
    happens_at: happensAt ? happensAt.toISOString() : null,
    expires_at: expiresAt.toISOString(),
  };
  const audienceRow = { audience_gender: audienceGender, audience_age_min: audMin, audience_age_max: audMax };

  const ins = (row: any) => supabaseAdmin.from('friend_activities').insert(row).select('id').single();
  let { data: act, error } = await ins({ ...baseRow, ...audienceRow, location });
  // Graceful fallbacks for un-migrated columns: drop location first, then audience,
  // so the event still posts instead of failing into the void.
  if (error && /location|column|schema cache/i.test(error.message || '')) {
    ({ data: act, error } = await ins({ ...baseRow, ...audienceRow }));
  }
  if (error && /audience_|column|schema cache/i.test(error.message || '')) {
    ({ data: act, error } = await ins(baseRow));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!act) return NextResponse.json({ error: 'Could not create activity.' }, { status: 500 });

  // Author auto-RSVPs their own activity.
  await supabaseAdmin.from('friend_activity_rsvps').upsert(
    { activity_id: act.id, user_id: user.id }, { onConflict: 'activity_id,user_id' }
  );

  return NextResponse.json({ ok: true, id: act.id });
}
