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
- Required Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `MATCH_LINK_SECRET`, `CRON_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TICKETMASTER_API_KEY`, `YELP_API_KEY`.
- Storage bucket `profile-photos` is configured in the Supabase dashboard (not in repo).
- Photo uploads: 4MB cap client+server (Vercel serverless body limit is 4.5MB).

## Brand (Brand Kit v1)
- **Blue `#2563FF`** = primary / love side. **Orange `#FF6A1F`** = friend / social side.
- Ink `#0B0B0B`, paper `#F6F6F6`. Deep blue `#1b46c9`, blue-pale `#e8edff`, orange-deep `#d2530f`.
- Tokens in `app/globals.css` (`--blue`, `--orange`, legacy `--lav*` aliased to blue).
- Fonts: Bebas Neue (display), DM Mono (labels), Georgia/Playfair (serif accents).
- App color-codes love=blue, friend=orange consistently across all surfaces.

## Key systems
- **Matching** (`lib/matching.ts` + `app/api/match/route.ts`): HEXACO 80% + vibes 20%; adaptive gender-balance threshold; **wait-time threshold decay** (longer wait → lower bar, floor 35); **intent prioritization** (prefer same relationship-intent, fall back). Match radius = 25mi (`isWithinMatchRadius`).
- **Pools/segmentation** (`lib/pools.ts`): computed-live 2D segments — intent (serious/casual/enm/open from `relationship_style` + `future` vibe) × tier (A/B/next from session recency). Penalty states: cooldown / banned. Admin view at `/admin`.
- **Geo / metros** (`lib/quiz-data.ts`): signup radius 75mi from Boston; `ZIP_COORDS` already covers Boston + Worcester (01xxx) + Providence/RI (028/029xx) with accurate coords. `METRO_CENTERS` + `metroOf(zip)` label the nearest metro (Boston/Worcester/Providence) — used for admin "area pools" breakdown. Matching stays 25mi distance so each metro self-isolates.
- **Cron** (`vercel.json`, Pro per-minute): `rematch` every 20min (continuous matching, ejection, wave drops, cooldown auto-release); `expiring-soon` hourly (3–6h "accept window closing" reminder).
- **Date vibes** (`/match/[id]/date-vibes`): post-acceptance activity game. Interest picker → swipe deck → mutual-yes reveals. **Date meter (1→2→3)** auto-ascends by time-since-match (+1/week) + mutual matches; tiers gate activity intensity (date 1 light → date 3 intimate). Deck = curated Boston-area list (`lib/activities.ts`, tiered) + **metro-aware live events** (`lib/live-events.ts` → Ticketmaster/Yelp per metro, Boston Calendar Boston-only).
- **Profiles**: primary `photo_url` (free to matches) + `gallery` (3 photos, part of $2.99 unlock). Relationship style field. Preview at `/profile/preview` shows gallery grid.
- **Unlock**: $2.99 reveals bio + gallery + music/food/hobbies/vibes. Blocked if the match has no bio AND no gallery (server + client wall).
- **Emails** (`lib/email.ts`): shared branded template (`renderEmail`/`sendEmail`), all blue. Activity emails respect `users.email_notifications`. Unsubscribe = opt out of emails AND matching pool.
- **Admin** (`/admin`, `lib/admin.ts` gate via `ADMIN_EMAILS`): Mission Control redesign — KPIs, pool segments + heatmap + penalty box w/ release/lift + run-rotation, pool health (conversion/wait/stagnant/black-holes), date feedback, live-events queue w/ hide/blacklist, area-pools strip.
- **Robustness**: `lib/fetch-helpers.ts` `parseResponse()` — never `.json()` a non-JSON error body (the original "token R" bug fix). Used across all client fetches.

## Roadmap — when we come back
1. **Per-metro pool balancing** (biggest matching upgrade): `thresholdFor` is still GLOBAL — should scope gender-balance to the user's metro now that Worcester/Providence are active. Wave releases per metro too.
2. **OG / social share images + meta tags** — for the growth push (links shared on Reddit/social). Not done yet.
3. **Connecticut / Hartford** expansion (deferred — Providence + Worcester first).
4. **Acceptance-likelihood weighting** in the matcher (conversion lever — use pool-health data to decide).
5. **Re-match expiry** — `match_history` blocks re-matching forever; consider expiry so thin pools don't dry up.
6. Friend Maxxin product (currently "soon" placeholder).

## Status (last session)
- Brand fully rolled out, hub layout fixed, footers sticky/branded.
- Geo data prep done (metros labeled, events metro-aware), launch-readiness done (loosened per-IP OTP caps for CGNAT surge).
- All migrations run in Supabase. App shipped + Pro crons live. Ready for the Boston/Providence/Worcester Reddit launch.
