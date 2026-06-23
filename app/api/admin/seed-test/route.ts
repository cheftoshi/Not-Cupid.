import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { joinCircle } from '@/lib/friend-circles';
import { devLoginUrl } from '@/lib/dev-login';

export const dynamic = 'force-dynamic';

// A self-contained TEST WORLD, segregated from real users (is_test = true; the
// matcher/roster/pulse only ever pair test↔test). Built so logging in as
// **Test Alex** exercises EVERY surface at once:
//   LOVE  → "your chats" with a live both-accepted chat (Bailey, w/ messages +
//           a locked profile so the $0.99 unlock wall shows) AND a "your move"
//           pending match (Harper), plus a FULL roster carousel of 5 more women.
//   FRIEND→ a live 3-person crew + group chat (opened) AND a SEALED pack of 4
//           waiting to be opened (the cinematic /friends/pack reveal).
//   SCENE → events + posts on the board, with Alex RSVP'd / liked some so the
//           hub's "your events", "for your vibe" and "you liked" all populate.
// Every profile is fully filled (gallery, sun sign, sports, attachment, values)
// so the bubbles, sign badges, unlock walls and personality bars all render.

const gal = (a: number, b: number) => [`https://i.pravatar.cc/600?img=${a}`, `https://i.pravatar.cc/600?img=${b}`];
const baseVibes = { chronotype: 2, date_freq: 3, future: 3, comm: 3, social: 3, risk: 2 };
const vals = (o: Record<string, any> = {}) => ({ kids: 2, faith: 1, politics: 2, ambition: 2, lifestyle: 2, fitness: 3, substances: 'social', ...o });

type Spec = {
  email: string; name: string; gender: string; seeking: string; age: number; zip: string;
  archetype: string; bio: string; occupation: string; education: string; img: number; g: [number, number];
  sign: string; height: number; rstyle: string;
  music: string[]; food: string[]; hobbies: string[]; sports: string[];
  scores: [number, number, number, number, number, number]; attach: [number, number, string];
  values?: Record<string, any>; activities: string[];
};

const S: Spec[] = [
  { email: 'alex+test@notcupid.dev', name: 'Test Alex', gender: 'm', seeking: 'f', age: 30, zip: '02116',
    archetype: 'The Grounded Optimist', bio: 'Test account. Runs on cold brew and long walks along the Charles. Looking for someone to split a ramen bowl and a record store crawl with.',
    occupation: 'Product designer', education: 'Northeastern', img: 12, g: [13, 14], sign: 'libra', height: 180, rstyle: 'marriage_track',
    music: ['indie', 'jazz'], food: ['ramen', 'tacos'], hobbies: ['running', 'film', 'cooking'], sports: ['run club', 'climbing'],
    scores: [13, 9, 11, 12, 13, 14], attach: [1, 1, 'secure'], activities: ['food & restaurants', 'outdoors & hikes', 'live music'] },
  { email: 'bailey+test@notcupid.dev', name: 'Test Bailey', gender: 'f', seeking: 'm', age: 29, zip: '02118',
    archetype: 'The Curious Realist', bio: 'Test account. South End regular, trivia-night ringer, will absolutely judge your coffee order (kindly).',
    occupation: 'Data scientist', education: 'BU', img: 45, g: [31, 32], sign: 'scorpio', height: 168, rstyle: 'marriage_track',
    music: ['indie', 'soul'], food: ['ramen', 'thai'], hobbies: ['running', 'reading', 'film'], sports: ['yoga', 'tennis'],
    scores: [14, 10, 10, 13, 12, 15], attach: [2, 1, 'secure'], activities: ['food & restaurants', 'live music', 'creative & art'] },
  { email: 'harper+test@notcupid.dev', name: 'Test Harper', gender: 'f', seeking: 'm', age: 28, zip: '02215',
    archetype: 'The Warm Connector', bio: 'Test account. Fenway-adjacent, plant hoarder, hosts the best low-key dinner parties.',
    occupation: 'UX researcher', education: 'Emerson', img: 16, g: [25, 26], sign: 'cancer', height: 165, rstyle: 'open',
    music: ['pop', 'r&b'], food: ['sushi', 'pasta'], hobbies: ['pottery', 'cooking', 'thrifting'], sports: ['pilates', 'cycling'],
    scores: [12, 12, 12, 14, 11, 13], attach: [3, 2, 'anxious'], activities: ['food & restaurants', 'creative & art', 'coffee shops'] },
  { email: 'dev+test@notcupid.dev', name: 'Test Dev', gender: 'f', seeking: 'm', age: 28, zip: '02143',
    archetype: 'The Spirited Realist', bio: 'Test account. Somerville, always knows the new spot, dangerously competitive at trivia.',
    occupation: 'PM', education: 'Tufts', img: 47, g: [20, 21], sign: 'leo', height: 170, rstyle: 'dink',
    music: ['pop', 'soul'], food: ['thai', 'tacos'], hobbies: ['cooking', 'art', 'trivia'], sports: ['bouldering', 'run club'],
    scores: [13, 11, 13, 13, 11, 14], attach: [2, 1, 'secure'], activities: ['food & restaurants', 'gaming & nerdy stuff', 'coffee shops'] },
  { email: 'iris+test@notcupid.dev', name: 'Test Iris', gender: 'f', seeking: 'm', age: 31, zip: '02139',
    archetype: 'The Quiet Adventurer', bio: 'Test account. Cambridge, vinyl crates and long bike rides, quietly the funniest person in the room.',
    occupation: 'Architect', education: 'MIT', img: 48, g: [27, 28], sign: 'aquarius', height: 172, rstyle: 'open',
    music: ['indie', 'electronic'], food: ['korean', 'pizza'], hobbies: ['cycling', 'photography', 'film'], sports: ['cycling', 'swimming'],
    scores: [14, 9, 9, 12, 13, 15], attach: [1, 3, 'avoidant'], activities: ['live music', 'outdoors & hikes', 'creative & art'] },
  { email: 'jules+test@notcupid.dev', name: 'Test Jules', gender: 'f', seeking: 'm', age: 30, zip: '02130',
    archetype: 'The Easygoing Builder', bio: 'Test account. JP, brunch evangelist, runs a game night that has a waitlist.',
    occupation: 'Teacher', education: 'UMass', img: 24, g: [29, 30], sign: 'taurus', height: 167, rstyle: 'marriage_track',
    music: ['folk', 'rock'], food: ['brunch', 'thai'], hobbies: ['board games', 'baking', 'hiking'], sports: ['hiking', 'soccer'],
    scores: [13, 12, 12, 13, 12, 13], attach: [2, 2, 'secure'], activities: ['gaming & nerdy stuff', 'food & restaurants', 'outdoors & hikes'] },
  { email: 'maya+test@notcupid.dev', name: 'Test Maya', gender: 'f', seeking: 'm', age: 27, zip: '02134',
    archetype: 'The Bright Wanderer', bio: 'Test account. Allston, festival chaser, always two trips deep into planning the next one.',
    occupation: 'Marketing', education: 'Berklee', img: 5, g: [9, 10], sign: 'sagittarius', height: 169, rstyle: 'casual',
    music: ['pop', 'dance'], food: ['mexican', 'sushi'], hobbies: ['travel', 'dancing', 'film'], sports: ['dance', 'volleyball'],
    scores: [12, 11, 14, 12, 10, 14], attach: [3, 1, 'anxious'], activities: ['live music', 'bars & nightlife', 'food & restaurants'] },
  { email: 'cam+test@notcupid.dev', name: 'Test Cam', gender: 'm', seeking: 'f', age: 31, zip: '02139',
    archetype: 'The Easygoing Builder', bio: 'Test account. Cambridge climber, will rope you into a run club within a week.',
    occupation: 'Engineer', education: 'MIT', img: 33, g: [3, 4], sign: 'capricorn', height: 183, rstyle: 'dink',
    music: ['rock', 'electronic'], food: ['pizza', 'korean'], hobbies: ['climbing', 'running', 'board games'], sports: ['climbing', 'run club'],
    scores: [12, 8, 13, 11, 12, 13], attach: [1, 2, 'secure'], activities: ['outdoors & hikes', 'workouts & run club', 'gaming & nerdy stuff'] },
  { email: 'eli+test@notcupid.dev', name: 'Test Eli', gender: 'm', seeking: 'f', age: 32, zip: '02134',
    archetype: 'The Quiet Adventurer', bio: 'Test account. Allston, vinyl crates and long bike rides, makes a mean negroni.',
    occupation: 'Writer', education: 'Emerson', img: 51, g: [52, 53], sign: 'pisces', height: 178, rstyle: 'open',
    music: ['indie', 'jazz'], food: ['ramen', 'pizza'], hobbies: ['cycling', 'music', 'film'], sports: ['cycling', 'basketball'],
    scores: [14, 9, 9, 12, 13, 15], attach: [2, 2, 'secure'], activities: ['live music', 'bars & nightlife', 'outdoors & hikes'] },
  { email: 'owen+test@notcupid.dev', name: 'Test Owen', gender: 'm', seeking: 'f', age: 29, zip: '02129',
    archetype: 'The Grounded Optimist', bio: 'Test account. Charlestown, weekend woodworker, dog is more popular than he is.',
    occupation: 'Carpenter', education: 'Wentworth', img: 60, g: [61, 62], sign: 'virgo', height: 185, rstyle: 'marriage_track',
    music: ['country', 'rock'], food: ['bbq', 'burgers'], hobbies: ['woodworking', 'hiking', 'cooking'], sports: ['hiking', 'softball'],
    scores: [13, 8, 11, 13, 14, 11], attach: [1, 1, 'secure'], activities: ['outdoors & hikes', 'food & restaurants', 'bars & nightlife'] },
];

// Scene board — events + posts authored across the test crew, upcoming + open.
const SCENE = [
  { author: 1, kind: 'event', cat: 'food', title: 'Ramen crawl through Chinatown', area: 'Chinatown', body: 'Three spots, one night. Slurp responsibly.', inDays: 2 },
  { author: 3, kind: 'event', cat: 'culture', title: 'MFA late night + drinks after', area: 'Fenway', body: 'Galleries til 9, then negronis nearby.', inDays: 4 },
  { author: 7, kind: 'event', cat: 'active', title: 'Sunday run club — Charles loop', area: 'Back Bay', body: '5k easy pace, coffee after. All levels.', inDays: 3 },
  { author: 4, kind: 'event', cat: 'nightlife', title: 'Trivia night at the Druid', area: 'Inman Square', body: 'We need a ringer. That could be you.', inDays: 1 },
  { author: 6, kind: 'event', cat: 'games', title: 'Board game night (BYO snacks)', area: 'Jamaica Plain', body: 'Catan, Wingspan, and questionable alliances.', inDays: 5 },
  { author: 2, kind: 'post', cat: 'chill', title: 'Best quiet coffee shop to actually work?', area: 'South End', body: 'Tired of fighting for outlets. Recs?', inDays: null },
  { author: 5, kind: 'post', cat: 'outdoors', title: 'Anyone up for a Blue Hills hike Saturday?', area: 'Cambridge', body: 'Thinking morning, before it gets hot.', inDays: null },
];

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  const now = new Date().toISOString();
  const ids: string[] = [];

  for (const u of S) {
    const row = {
      email: u.email, name: u.name, gender: u.gender, seeking: u.seeking,
      age: u.age, age_min: Math.max(18, u.age - 5), age_max: u.age + 8, zip: u.zip,
      archetype: u.archetype, bio: u.bio, occupation: u.occupation, education: u.education,
      photo_url: `https://i.pravatar.cc/500?img=${u.img}`, gallery: gal(u.g[0], u.g[1]),
      sun_sign: u.sign, height_cm: u.height, relationship_style: u.rstyle,
      music: u.music, food: u.food, hobbies: u.hobbies, sports: u.sports,
      score_honesty: u.scores[0], score_emotionality: u.scores[1], score_extraversion: u.scores[2],
      score_agreeableness: u.scores[3], score_conscientiousness: u.scores[4], score_openness: u.scores[5],
      vibes: baseVibes, attach_anxiety: u.attach[0], attach_avoidance: u.attach[1], attach_style: u.attach[2],
      values_profile: vals(u.values),
      is_test: true, status: 'waiting', pool_active: true,
      matching_cooldown_until: null, matching_disabled_at: null, deleted_at: null, is_blocked: false,
      ghost_strikes: 0, ignored_picks: 0,
      friend_opted_in_at: now,
      friend_vibes: { intent: 'open to both', activities: u.activities, cadence: 'weekly', group_size: 'small', life_stage: 'settling in' },
      friend_seeking: ['grab a drink', 'try new spots'],
    };
    const { data, error } = await supabaseAdmin.from('users').upsert(row, { onConflict: 'email' }).select('id').single();
    if (error) { console.error('seed-test upsert failed', error); return NextResponse.json({ error: error.message }, { status: 500 }); }
    ids.push(data.id);
  }

  const [alex, bailey, harper, dev, iris, jules, maya, cam, eli, owen] = ids;

  // ── Clean slate (idempotent re-seed) ──
  const del = async (table: string, cols: string[]) => {
    for (const c of cols) { try { await supabaseAdmin.from(table).delete().in(c, ids); } catch { /* table may not exist */ } }
  };
  // messages first (FK to matches), then matches
  try {
    const { data: m1 } = await supabaseAdmin.from('matches').select('id').in('user_1_id', ids);
    const { data: m2 } = await supabaseAdmin.from('matches').select('id').in('user_2_id', ids);
    const mids = Array.from(new Set([...(m1 ?? []), ...(m2 ?? [])].map((m: any) => m.id)));
    if (mids.length) await supabaseAdmin.from('messages').delete().in('match_id', mids);
  } catch { /* ignore */ }
  await del('matches', ['user_1_id', 'user_2_id']);
  await del('match_history', ['user_a_id', 'user_b_id']);
  await del('match_unlocks', ['user_id', 'unlocked_user_id']);
  await del('friend_connections', ['user_a_id', 'user_b_id']);
  await del('friend_circle_members', ['user_id']);
  await del('friend_match_history', ['user_a_id', 'user_b_id']);
  try {
    const { data: oldActs } = await supabaseAdmin.from('friend_activities').select('id').in('author_id', ids);
    const aids = (oldActs ?? []).map((a: any) => a.id);
    if (aids.length) { await supabaseAdmin.from('friend_activity_rsvps').delete().in('activity_id', aids); }
    await supabaseAdmin.from('friend_activities').delete().in('author_id', ids);
  } catch { /* ignore */ }

  const expires = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  // ── LOVE: a live chat (Alex↔Bailey, both accepted) + a "your move" pending ──
  const { data: m1 } = await supabaseAdmin.from('matches').insert({
    user_1_id: alex, user_2_id: bailey, compatibility_score: 94,
    status: 'both_accepted', user_1_accepted: true, user_2_accepted: true, expires_at: expires,
  }).select('id').single();
  if (m1?.id) {
    await supabaseAdmin.from('messages').insert([
      { match_id: m1.id, sender_id: bailey, body: 'okay your ramen-crawl idea is dangerous, I’m in 🍜' },
      { match_id: m1.id, sender_id: alex, body: 'oh it’s on. I’ve been building this route for weeks' },
      { match_id: m1.id, sender_id: bailey, body: 'a man with a *spreadsheet*. be still my heart' },
    ]);
  }
  // Harper picked Alex → pending, Harper accepted, Alex hasn't → "your move".
  await supabaseAdmin.from('matches').insert({
    user_1_id: harper, user_2_id: alex, compatibility_score: 88,
    status: 'pending', user_1_accepted: true, user_2_accepted: false, expires_at: expires,
  });
  await supabaseAdmin.from('users').update({ status: 'matched', last_matched_at: now }).in('id', [alex, bailey]);
  // Dev, Iris, Jules, Maya stay unmatched → they fill Alex's roster carousel.

  // ── FRIEND: a live opened crew (Cam, Eli, Owen) + a SEALED pack (Dev,Iris,Jules,Maya) ──
  const crew = [cam, eli, owen];
  const crewScores = [82, 76, 71];
  let circleId: string | null = null;
  for (let i = 0; i < crew.length; i++) {
    circleId = await joinCircle(alex, crew[i]);
    const [ua, ub] = [alex, crew[i]].sort();
    await supabaseAdmin.from('friend_connections').upsert(
      { user_a_id: ua, user_b_id: ub, status: 'connected', a_picked: true, b_picked: true, circle_id: circleId, compatibility_score: crewScores[i], connected_at: now, opened_at: now },
      { onConflict: 'user_a_id,user_b_id' }
    );
  }
  if (circleId) {
    await supabaseAdmin.from('friend_messages').insert([
      { circle_id: circleId, sender_id: cam, body: 'run club sunday? charles loop, easy pace' },
      { circle_id: circleId, sender_id: owen, body: 'in. bringing the dog 🐕' },
      { circle_id: circleId, sender_id: alex, body: 'perfect. coffee after at tatte' },
    ]);
  }
  // Sealed pack — connected but UN-opened (opened_at null) → the cinematic reveal.
  const sealed = [dev, iris, jules, maya];
  const sealedScores = [80, 74, 70, 66];
  for (let i = 0; i < sealed.length; i++) {
    const [ua, ub] = [alex, sealed[i]].sort();
    await supabaseAdmin.from('friend_connections').upsert(
      { user_a_id: ua, user_b_id: ub, status: 'connected', a_picked: true, b_picked: true, compatibility_score: sealedScores[i], connected_at: now, opened_at: null },
      { onConflict: 'user_a_id,user_b_id' }
    );
  }

  // ── SCENE: events + posts; Alex RSVPs/likes some so the hub sections fill ──
  const actIds: string[] = [];
  for (const ev of SCENE) {
    const happens_at = ev.inDays != null ? new Date(Date.now() + ev.inDays * 24 * 3600 * 1000).toISOString() : null;
    const exp = happens_at || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin.from('friend_activities').insert({
      author_id: ids[ev.author], title: ev.title, body: ev.body, category: ev.cat, area: ev.area,
      kind: ev.kind, happens_at, expires_at: exp, audience_gender: null, audience_age_min: null, audience_age_max: null,
    }).select('id').single();
    if (data?.id) actIds.push(data.id);
  }
  // Alex: yes to events 0 & 2, maybe to event 1, like (yes) posts 5 & 6. Events 3,4 left open → "for your vibe".
  const rsvps = [
    { i: 0, r: 'yes' }, { i: 2, r: 'yes' }, { i: 1, r: 'maybe' }, { i: 5, r: 'yes' }, { i: 6, r: 'yes' },
  ];
  for (const rv of rsvps) {
    if (actIds[rv.i]) {
      try { await supabaseAdmin.from('friend_activity_rsvps').upsert({ activity_id: actIds[rv.i], user_id: alex, response: rv.r }, { onConflict: 'activity_id,user_id' }); }
      catch { await supabaseAdmin.from('friend_activity_rsvps').upsert({ activity_id: actIds[rv.i], user_id: alex }, { onConflict: 'activity_id,user_id' }); }
    }
  }
  // A few other test folks RSVP yes to events so counts aren't all zero.
  for (const i of [0, 2, 3]) {
    for (const u of [bailey, dev, cam]) {
      if (actIds[i]) { try { await supabaseAdmin.from('friend_activity_rsvps').upsert({ activity_id: actIds[i], user_id: u, response: 'yes' }, { onConflict: 'activity_id,user_id' }); } catch { /* ignore */ } }
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Test world ready. Log in as Test Alex to see it all: 2 love chats (1 live + 1 "your move") + a full roster, a live friend crew + a sealed pack to open, and a populated Scene with RSVPs. Test accounts only ever match other test accounts.',
    accounts: S.map((u, i) => ({ name: u.name, email: u.email, loginUrl: devLoginUrl(baseUrl, ids[i]) })),
  });
}
