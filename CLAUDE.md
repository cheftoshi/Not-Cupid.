# NotCupid — project memory

Boston-area dating experiment. "Meet People. Not Profiles." A Lemon Labs property.
Two products: **Love Maxxin** (live, dating) and **Friend Maxxin** (soon, platonic).
Algorithm-assigned, one-match-at-a-time, no swiping, no browsing.

## Stack & deploy
- Next.js 14 (App Router) + Supabase (Postgres) + Vercel (**Pro** plan) + Resend (email).
- Repo: `github.com/cheftoshi/Not-Cupid.` → pushes to `main` auto-deploy on Vercel.
- Node IS installed locally (Homebrew). **ALWAYS run `npm run build` before pushing** — `tsconfig` is `strict`, `next.config.js` has no `ignoreBuildErrors`, so any TS error fails the deploy. (We lost ~an hour once shipping blind.)
- Local `.env.local` holds PLACEHOLDER keys (gitignored) so `next build` can construct service clients during page-data collection. Real keys live in Vercel env vars.

## ⚠️ Operational rules (don't forget)
- **Migrations are NOT auto-applied.** SQL files in `supabase/migrations/` are run MANUALLY in the Supabase SQL Editor. After adding a migration, always remind the user to run it or new features 500.
- **⏳ PENDING MIGRATIONS to confirm next session** (added late in the 5/29 session — user may not have run yet): `20260529_match_radius.sql` (users.match_radius default 15 + radius_nudge_sent_at), `20260529_pool_balance.sql` (users.balance_hold_at + last_matched_at), `20260529_feedback.sql` (feedback table). Until run, the matcher (match_radius), intake gating, and feedback spot will error.
- Required Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `MATCH_LINK_SECRET`, `CRON_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TICKETMASTER_API_KEY`, `YELP_API_KEY`.
- **Cron auth gotcha:** `CRON_SECRET` would NOT inject into the Vercel runtime no matter what (set in Production, Vercel sent the bearer, but `process.env.CRON_SECRET` read empty). Worked around it — the cron routes ALSO accept Vercel's `user-agent: vercel-cron/1.0`. So crons authenticate via UA, not the secret. Minor spoof risk; fine for beta. If `CRON_SECRET` ever starts injecting, tighten back to bearer-only.
- Storage bucket `profile-photos` is configured in the Supabase dashboard (not in repo).
- Photo uploads: 4MB cap client+server (Vercel serverless body limit is 4.5MB).

## Brand (Brand Kit v1)
- **Blue `#2563FF`** = primary / love side. **Orange `#FF6A1F`** = friend / social side.
- Ink `#0B0B0B`, paper `#F6F6F6`. Deep blue `#1b46c9`, blue-pale `#e8edff`, orange-deep `#d2530f`.
- Tokens in `app/globals.css` (`--blue`, `--orange`, legacy `--lav*` aliased to blue).
- Fonts: Bebas Neue (display), DM Mono (labels), Georgia/Playfair (serif accents).
- App color-codes love=blue, friend=orange consistently across all surfaces.

## Key systems
- **Matching** (`lib/matching.ts` + `app/api/match/route.ts`): HEXACO 80% + vibes 20%; adaptive gender-balance threshold; **wait-time threshold decay** (longer wait → lower bar, floor 35); **intent prioritization** (prefer same relationship-intent, fall back); **equity rotation** (`equityBonus` in `lib/pools.ts` — small under-served bonus so the same high-scorers don't monopolize the scarce side; sim showed distinct men matched over 6 cycles jumps 60→115/140). **Per-user match radius** default **15mi**, distance-based (`zipDistanceMiles`), user widens in 15mi steps to 75mi via `/api/profile/expand-radius` (dashboard "widen search" button). Thin-pool nudge email when compatible people exist but all beyond radius.
- **Gender-balance intake gating** (`lib/balance.ts` + `/api/submit` + cron): new over-represented-gender signups in a skewed metro (active >62% one side, pool ≥8) get held (`pool_active=false`, `balance_hold_at`); cron releases as the scarce side joins or after a 3-day cap. Held users see the normal positive queue — no negative messaging. **KEY INSIGHT from the sim (`scripts/simulate-pool.mjs`): straight-pool stagnation is a SUPPLY problem — matches ≤ min(M,F); threshold/algo tweaks change WHO matches + quality, never the COUNT. Only adding women moves it. So the real fix is women-first recruiting/pricing (growth, not code).**
- **Match accept** (`lib/match-actions.ts` `acceptMatch`): email link AND in-app button both go through ONE shared activation — sets accepted flag, first-accept nudges the other ("interested, accept to connect"), mutual accept → status=both_accepted + opens chat + sends it's-a-match contact emails. **Chat expiry is inactivity-based**: opens with 24h window, every message slides it +24h (`/api/messages`); cron closes silent chats (both-accepted + chat_expires_at passed).
- **Pools/segmentation** (`lib/pools.ts`): computed-live 2D segments — intent (serious/casual/enm/open from `relationship_style` + `future` vibe) × tier (A/B/next from session recency). Penalty states: cooldown / banned. Admin view at `/admin`.
- **Geo / metros** (`lib/quiz-data.ts`): signup radius 75mi from Boston; `ZIP_COORDS` covers Boston + Worcester (01xxx) + Providence/RI (028/029xx). `METRO_CENTERS` (with city/state) + `metroOf(zip)` label the nearest metro — drives admin area-pools AND metro-aware live events.
- **Cron** (`vercel.json`, Pro per-minute): `rematch` every 20min (continuous matching, ejection, wave drops, cooldown auto-release, balance-hold release, silent-chat cleanup); `expiring-soon` hourly (3–6h "accept window closing" reminder). Auth via vercel-cron UA (see gotcha above).
- **Date vibes** (`/match/[id]/date-vibes`): post-acceptance activity game. Interest picker → swipe deck → mutual-yes reveals. **Date meter (1→2→3)** auto-ascends by time-since-match (+1/week) + mutual matches; tiers gate activity intensity (date 1 light → date 3 intimate). Deck = curated Boston-area list (`lib/activities.ts`, tiered) + **metro-aware live events** (`lib/live-events.ts` → Ticketmaster/Yelp per metro, Boston Calendar Boston-only).
- **Profiles**: primary `photo_url` (free to matches) + `gallery` (3 photos, part of $2.99 unlock). Relationship style field. Preview at `/profile/preview` shows gallery grid.
- **Unlock**: $2.99 reveals bio + gallery + music/food/hobbies/vibes. Blocked if the match has no bio AND no gallery (server + client wall).
- **Emails** (`lib/email.ts`): shared branded template (`renderEmail`/`sendEmail`), all blue. Activity emails respect `users.email_notifications`. Unsubscribe = opt out of emails AND matching pool.
- **Dashboard moments**: cinematic **match reveal** (`match-reveal.tsx`) — one-time warm full-screen takeover when a new match drops (algo-voice eyebrow, compatibility % counts up, name drops in, soft light/glow palette, plays once per match via localStorage). Match card animates in; buttons have press states. Brand wordmark → `/hub` on dashboard + profile. Past matches show the other person's NAME, not the end reason. "What's new" panel (`lib/changelog.ts`, localStorage new-dot) + "send feedback" pills at top of dashboard.
- **Feedback** (`feedback` table, `/api/feedback`): dashboard drop spot → admin reads it at `/admin` "Feedback" section (`/api/admin/feedback`).
- **Admin** (`/admin`, `lib/admin.ts` gate via `ADMIN_EMAILS`): Mission Control — KPIs, pool segments + heatmap + penalty box w/ release/lift + run-rotation, pool health (conversion/wait/stagnant/black-holes/skew), date feedback ("Dates"), app feedback ("Feedback"), live-events queue w/ hide/blacklist, area-pools strip.
- **Simulation** (`scripts/simulate-pool.mjs`, run `node scripts/simulate-pool.mjs`): mirrors the real scoring; test matcher/param changes before shipping. Proved the supply-ceiling + validated equity rotation.
- **Robustness**: `lib/fetch-helpers.ts` `parseResponse()` — never `.json()` a non-JSON error body (the original "token R" bug fix). Used across all client fetches. **Always `npm run build` locally before push** (no Node in CI; strict TS).

## Roadmap — when we come back
1. **Women-first GROWTH/SUPPLY (the #1 real lever).** The sim proved matching can't fix a 70/30 pool — only more women can. Wanted: a written growth playbook (women-free or men-pay pricing, where/how to recruit women in Boston, referral mechanics, launch sequencing). User deferred this — pick it up.
2. **OG / social share images + meta tags** — for shared links (Reddit/social). Still not done.
3. **More edgy UI (warm, minimal — user's stated taste):** unlock-as-drama (redacted/blurred reveal), quiz loading-screen algo voice, editorial match card. (Match reveal + motion + algo voice already shipped.)
4. **Acceptance-likelihood weighting** in the matcher (conversion lever — use pool-health data).
5. **Per-metro `thresholdFor`** (gender-balance is still global in `thresholdFor`; intake gating IS per-metro now, but the score threshold isn't).
6. **Re-match expiry** — `match_history` blocks re-matching forever; expiry so thin pools don't dry up.
7. **Rematch cron perf** — it does per-user `fetch(/api/match)` HTTP round-trips (~26s, ~100 DB calls at small scale). Convert to in-process matching + batched queries when the pool grows.
8. Connecticut/Hartford expansion. Friend Maxxin product (still "soon" placeholder).

## Status (last session — 2026-05-29, big session)
- Shipped: cron auth fix (UA fallback), metro-aware live events, unified accept activation + inactivity chat expiry, 15mi radius + expansion + thin-pool nudge, dropped the "/8" cap framing, gender-balance intake gating + equity rotation, past-matches-as-names, what's-new + feedback (+ admin view), brand→/hub, cinematic match reveal + motion.
- Built `scripts/simulate-pool.mjs` — KEY takeaway: pool stagnation is a SUPPLY problem (need women), not an algo problem.
- ⏳ **First thing next session: confirm the 3 pending migrations ran** (match_radius, pool_balance, feedback — see Operational rules). Everything else build-verified + pushed; HEAD ~`29ae0ed`.
