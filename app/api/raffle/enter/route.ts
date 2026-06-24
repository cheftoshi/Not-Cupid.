import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible, raffleClosed } from '@/lib/raffle';
import { drawRaffle } from '@/lib/raffle-draw';

export const dynamic = 'force-dynamic';

// Enter the raffle. Needs established cred (a real, complete profile), the match
// basics, an intro video, and to be in the event's city. New entrants also face
// the deadline, the overall cap, and a per-gender balance cap so the pool can't
// skew lopsided (keeps everyone's odds fair).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!raffleEligible(user)) return NextResponse.json({ error: `${RAFFLE.city} only for this one — change your city to ${RAFFLE.city} to enter.` }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const video_url = body.video_url ? String(body.video_url).slice(0, 2000) : null;
  const notify = body.notify !== false;

  // Match basics from the form — set them on the real profile (the matcher reads
  // user.gender/seeking/age) so they're not raffle-only.
  const gender = ['m', 'f', 'nb'].includes(body.gender) ? body.gender : null;
  const seeking = ['m', 'f', 'both'].includes(body.seeking) ? body.seeking : null;
  const ageMin = Number(body.ageMin), ageMax = Number(body.ageMax);
  const ageOk = ageMin >= 18 && ageMin <= 99 && ageMax >= ageMin && ageMax <= 99;
  const profilePatch: any = {};
  if (gender) profilePatch.gender = gender;
  if (seeking) profilePatch.seeking = seeking;
  if (ageOk) { profilePatch.age_min = ageMin; profilePatch.age_max = ageMax; }
  if (Object.keys(profilePatch).length) await supabaseAdmin.from('users').update(profilePatch).eq('id', user.id);

  // "Established cred" gate — pull from the (now-updated) profile.
  const g = gender || user.gender, sk = seeking || user.seeking;
  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const missing: string[] = [];
  if (!user.photo_url) missing.push('a profile photo');
  if (!user.archetype || typeof user.score_honesty !== 'number') missing.push('the personality quiz');
  if (!(user.bio || '').trim()) missing.push('a bio');
  if (interests < 3) missing.push('3+ interests');
  if (user.age == null) missing.push('your age');
  if (!g) missing.push('your gender');
  if (!sk) missing.push('who to match you with');
  if (missing.length) return NextResponse.json({ error: `Finish your profile first — still need: ${missing.join(', ')}.` }, { status: 400 });
  if (!video_url) return NextResponse.json({ error: 'Your intro video is required to enter.' }, { status: 400 });
  if (body.agreed !== true) return NextResponse.json({ error: 'Please agree to the Official Rules to enter.' }, { status: 400 });

  // New entrants face the deadline, the overall cap, and the per-gender balance
  // cap; updating your own existing entry skips all three.
  const { data: mine } = await supabaseAdmin.from('raffle_entries').select('user_id').eq('user_id', user.id).eq('event_key', RAFFLE.key).maybeSingle();
  const alreadyIn = !!mine;
  if (!alreadyIn) {
    if (raffleClosed()) return NextResponse.json({ error: 'Entries are closed for this one — watch the hub for the next.' }, { status: 400 });
    const { data: ents } = await supabaseAdmin.from('raffle_entries').select('user_id').eq('event_key', RAFFLE.key);
    const ids = (ents ?? []).map((e: any) => e.user_id);
    if (ids.length >= RAFFLE.cap) return NextResponse.json({ error: 'The raffle just hit capacity — watch the hub for the next one.' }, { status: 400 });
    // Balance: neither men nor women can exceed 60% of the cap, so the pool can't
    // go lopsided and crush one side's odds. (nb uncapped — small numbers.)
    if ((g === 'm' || g === 'f') && ids.length) {
      const { data: gs } = await supabaseAdmin.from('users').select('gender').in('id', ids);
      const sameSide = (gs ?? []).filter((u: any) => u.gender === g).length;
      if (sameSide >= Math.ceil(RAFFLE.cap * 0.6)) {
        const side = g === 'm' ? 'men’s' : 'women’s';
        return NextResponse.json({ error: `The ${side} side is full for this round — we balance the pool so the draw stays fair. Watch the hub for the next one.` }, { status: 400 });
      }
    }
  }

  const row: any = { user_id: user.id, event_key: RAFFLE.key, video_url, notify, status: 'entered', agreed_at: new Date().toISOString() };
  let { error } = await supabaseAdmin.from('raffle_entries').upsert(row, { onConflict: 'user_id,event_key' });
  if (error && /agreed_at/i.test(error.message || '')) { // pre-migration fallback
    delete row.agreed_at;
    ({ error } = await supabaseAdmin.from('raffle_entries').upsert(row, { onConflict: 'user_id,event_key' }));
  }
  if (error) {
    console.error('raffle enter error', error);
    return NextResponse.json({ error: 'Could not enter — try again.' }, { status: 500 });
  }

  // Hit the cap on this entry → auto-draw immediately (the algo does the rest).
  if (!alreadyIn) {
    const { count: now } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key).eq('status', 'entered');
    if ((now ?? 0) >= RAFFLE.cap) await drawRaffle().catch((e) => console.error('cap auto-draw failed', e));
  }
  return NextResponse.json({ ok: true });
}
