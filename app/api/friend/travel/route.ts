import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { rateLimit } from '@/lib/rate-limit';
import { friendLocationContext, friendMetroLabel } from '@/lib/friend-location';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const location = await friendLocationContext(user);
  return NextResponse.json({
    homeMetro: location.homeMetro,
    homeLabel: friendMetroLabel(location.homeMetro),
    metro: location.metro,
    label: friendMetroLabel(location.metro),
    area: location.area,
    trip: location.trip,
    isTraveling: location.isTraveling,
    isOnTrip: location.isOnTrip,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const limit = await rateLimit({ key: `friend-travel:${user.id}`, windowSec: 3600, maxAttempts: 12, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many travel changes — try again later.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'cancel') {
    const id = String(body.id || '');
    const { data } = await supabaseAdmin.from('friend_trips')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).eq('status', 'active').select('id').maybeSingle();
    if (!data) return NextResponse.json({ error: 'Travel plan not found.' }, { status: 404 });
    await supabaseAdmin.from('friend_intents').update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('status', 'open');
    return NextResponse.json({ ok: true });
  }

  if (body.action !== 'set') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const destination = String(body.destinationMetro || '');
  const homeMetro = metroOf((user as any).zip);
  if (!METRO_CENTERS[destination]) return NextResponse.json({ error: 'Choose a supported destination.' }, { status: 400 });
  if (destination === homeMetro) return NextResponse.json({ error: 'That is already your home metro.' }, { status: 400 });
  const startsOn = String(body.startsOn || '');
  const endsOn = String(body.endsOn || '');
  if (!DATE.test(startsOn) || !DATE.test(endsOn)) return NextResponse.json({ error: 'Choose your arrival and departure dates.' }, { status: 400 });
  const startMs = new Date(`${startsOn}T12:00:00.000Z`).getTime();
  const endMs = new Date(`${endsOn}T12:00:00.000Z`).getTime();
  const todayMs = new Date(`${day()}T12:00:00.000Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return NextResponse.json({ error: 'Departure must be after arrival.' }, { status: 400 });
  if (endMs < todayMs || startMs > todayMs + 180 * 86_400_000) return NextResponse.json({ error: 'Trips can start within the next six months.' }, { status: 400 });
  if (endMs - startMs >= 60 * 86_400_000) return NextResponse.json({ error: 'Travel mode supports trips up to 60 days.' }, { status: 400 });
  const destinationArea = String(body.destinationArea || '').trim().slice(0, 60) || METRO_CENTERS[destination].city;

  await supabaseAdmin.from('friend_trips').update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('status', 'active');
  const { data, error } = await supabaseAdmin.from('friend_trips').insert({
    user_id: user.id,
    origin_metro: homeMetro,
    destination_metro: destination,
    destination_area: destinationArea,
    starts_on: startsOn,
    ends_on: endsOn,
    is_test: (user as any).is_test === true,
  }).select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Could not save travel mode.' }, { status: 500 });
  // A home-metro signal should not keep advertising after the user switches
  // into a destination. They can create a fresh, destination-specific signal.
  // Only switch discovery immediately when the trip is inside the 30-day
  // planning window. Far-future trips stay scheduled while home discovery runs.
  if (startMs <= todayMs + 30 * 86_400_000) {
    await supabaseAdmin.from('friend_intents').update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('status', 'open');
  }
  return NextResponse.json({ ok: true, id: data.id, label: friendMetroLabel(destination) });
}
