import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { claudeJSON, aiEnabled } from '@/lib/ai';
import { METRO_CENTERS } from '@/lib/quiz-data';
import { DROP, untilNextDrop } from '@/lib/weekly-drop';
import { friendLocationContext } from '@/lib/friend-location';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // one Claude round-trip, comfortably

// ── TODAY'S MOVE — the AI concierge behind the open→do→close loop ───────────
// The client sends what's actually on the user's board (upcoming plans it can
// render, connections it can DM, sealed-pack state); the server adds the
// profile (interests, archetype, city) and asks Claude to DECIDE one move —
// not a feed to browse, one thing to do today. Cached per user per day on
// users.today_move (graceful pre-migration: recompute per request).

type Move = {
  headline: string;
  body: string;
  cta: string;
  action: 'rsvp' | 'dm' | 'pack' | 'post' | 'scene';
  target: string;
};

const MOVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'body', 'cta', 'action', 'target'],
  properties: {
    headline: { type: 'string', description: 'Short punchy headline, lowercase-leaning, max ~48 chars, at most one emoji.' },
    body: { type: 'string', description: '1-2 warm sentences (max ~170 chars) saying WHY this is their move today, referencing concrete details.' },
    cta: { type: 'string', description: 'Imperative button label, max ~26 chars, no trailing arrow.' },
    action: { type: 'string', enum: ['rsvp', 'dm', 'pack', 'post', 'scene'] },
    target: { type: 'string', description: 'Exact id of the chosen event (rsvp) or connection (dm); empty string otherwise.' },
  },
} as const;

const str = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dayKey = () => new Date().toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ move: null });
  if (!aiEnabled()) return NextResponse.json({ move: null });

  const body = await req.json().catch(() => ({}));
  const refresh = body.refresh === true;

  // Day cache — one Claude call per user per day, consistent across devices.
  // (Columns from 20260708_today_move.sql; pre-migration these are undefined
  // and we just recompute — the localStorage cache still bounds cost.)
  if (!refresh && (user as any).today_move && (user as any).today_move_at) {
    if (String((user as any).today_move_at).slice(0, 10) === dayKey()) {
      return NextResponse.json({ move: (user as any).today_move });
    }
  }

  // Clamp the client-sent context hard — it only feeds a suggestion for this
  // same user, but nothing unbounded goes into a prompt.
  const events = (Array.isArray(body.events) ? body.events : []).slice(0, 12).map((e: any) => ({
    id: str(e.id, 40),
    title: str(e.title, 80),
    category: str(e.category, 24),
    area: str(e.area, 40),
    when: str(e.when, 32),
    location: str(e.location, 60),
    going: Number.isFinite(e.going) ? Math.max(0, Math.min(999, e.going)) : 0,
    friendsGoing: (Array.isArray(e.friendsGoing) ? e.friendsGoing : []).slice(0, 3).map((n: any) => str(n, 20)),
  })).filter((e: any) => e.id && e.title);
  const connections = (Array.isArray(body.connections) ? body.connections : []).slice(0, 8).map((c: any) => ({
    id: str(c.id, 40),
    name: str(c.name, 24).split(' ')[0],
  })).filter((c: any) => c.id && c.name);
  const sealedCount = Number.isFinite(body.sealedCount) ? Math.max(0, Math.min(20, body.sealedCount)) : 0;

  const friendLocation = await friendLocationContext(user);
  const metro = friendLocation.metro;
  const city = metro && METRO_CENTERS[metro] ? METRO_CENTERS[metro].city : 'your city';
  const interests = [
    ...(user.hobbies || []), ...(user.sports || []), ...(user.food || []), ...(user.music || []),
  ].filter(Boolean).slice(0, 14);

  const system = `You are the NotCupid concierge — the decision-maker behind a social connection app in ${city}. The product promise: open the app, get ONE decided move for today, do it, close the app. No feeds, no browsing.

Pick exactly ONE move from the user's real options, in this rough priority:
1. "rsvp" — join an upcoming plan that fits their interests (best: happening today/soon, friends going, matching category).
2. "dm" — message a specific connection to make a small real-world plan (coffee, a walk, the thing they're both into).
3. "pack" — they have a sealed pack of new people waiting; tell them to open it.
4. "post" — nothing fits: have them post the small plan they wish existed, tied to one of THEIR interests.
5. "scene" — last resort only.

Hard rules:
- Never invent events, people, or details not in the data. "target" must be the exact id of the chosen event (rsvp) or connection (dm), else "".
- Reference concrete specifics: the plan's name and time, the friend's first name, the interest it matches.
- Voice: warm, lowercase-leaning, zero corporate speak, at most one emoji. Decide — don't offer options or hedge.
- The move must end in something real: a plan joined, a message sent, people met. Never suggest scrolling or browsing.`;

  const context = {
    user: {
      firstName: (user.name || 'friend').split(' ')[0],
      age: user.age ?? null,
      archetype: user.archetype || null,
      interests,
      city,
    },
    weeklyDrop: { nextIn: untilNextDrop(), cadence: DROP.label },
    sealedPackWaiting: sealedCount,
    upcomingPlans: events,
    connections,
    localDay: new Date().toUTCString().slice(0, 3),
  };

  let move = await claudeJSON<Move>({
    system,
    user: `Here is today's data. Choose the one move.\n${JSON.stringify(context)}`,
    schema: MOVE_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 500,
  });

  // Server-side sanity: the model must point at things that exist, or the
  // action degrades to the closest safe fallback the client can always run.
  if (move) {
    const eventIds = new Set(events.map((e: any) => e.id));
    const connIds = new Set(connections.map((c: any) => c.id));
    if (move.action === 'rsvp' && !eventIds.has(move.target)) move = { ...move, action: 'scene', target: '' };
    if (move.action === 'dm' && !connIds.has(move.target)) move = { ...move, action: 'scene', target: '' };
    if (move.action === 'pack' && sealedCount === 0) move = { ...move, action: 'scene', target: '' };
    move = {
      headline: str(move.headline, 90) || 'your move today',
      body: str(move.body, 240),
      cta: str(move.cta, 40) || 'do it',
      action: move.action,
      target: str(move.target, 40),
    };
    // Cache for the rest of the day (best-effort; column may not be migrated).
    try {
      await supabaseAdmin.from('users')
        .update({ today_move: move, today_move_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch { /* pre-migration — fine */ }
  }

  return NextResponse.json({ move });
}
