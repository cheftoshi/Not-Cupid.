# NotCupid

NotCupid is an AI connection concierge for love, friendship, and real-life plans.
The production app is a PWA. Read [AGENTS.md](AGENTS.md) before changing product
behavior; it describes current rules, privacy requirements and release safeguards.

## Stack

- Next.js 16 App Router, React and TypeScript
- Supabase/Postgres with server-side session authentication and email OTP
- Resend email, web push and Stripe payments
- Vercel hosting; Capacitor projects for the future native wrapper
- CSS Modules, DM Sans and Space Grotesk

Exact package versions are in `package.json` and `package-lock.json`.

## Local development

Use Node.js 24 and install the locked dependencies:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Configure an isolated local/test environment before
exercising account, payment, notification or database flows. Do not copy production
credentials into tests. Local configuration belongs in gitignored `.env.local`;
never commit secrets or print them in logs.

## Validation

```sh
npm run ci:check
npm run test:e2e:https
```

`ci:check` runs TypeScript validation, unit/policy tests, a production build and
client bundle budgets. The HTTPS mobile suite runs public flows in Chromium and
WebKit. Authenticated integration tests require a separately configured synthetic
test realm; see the test scripts and [AGENTS.md](AGENTS.md).

## Main application areas

- `app/`: public pages, quiz, connection Home, Love/Friend surfaces and server APIs
- `components/`: shared UI
- `lib/`: authentication, matching, privacy policies and service integrations
- `data/curated-events/`: reviewed, expiring outside-event catalogue
- `supabase/migrations/`: forward database migrations
- `tests/` and `e2e/`: policy, integration and browser checks
- `docs/`: product and operating references

## Product and release rules

Love discovery uses reciprocal roster matching; Friend supports member plans,
connections and conversations. Outside events are attributed discovery suggestions,
not automatically published member plans or ticket purchases. The August Dating
Experiment is closed and must not be reopened.

Email and campaign delivery require the exact approvals documented in AGENTS.md.
A successful build or access to credentials never authorizes sending notifications.

GitHub `main` auto-deploys through Vercel. Prepare changes on a separate branch,
review the diff, pass local checks and obtain the required review before merging.
Database changes use new forward migrations and the linked dry-run workflow in
AGENTS.md; historical migrations are immutable. Never deploy an unverified build.
