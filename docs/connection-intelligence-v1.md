# Connection intelligence v1

Status: implemented in shadow mode on 2026-08-20. It does **not** alter live Love or Friend ordering.

## What is live

- Love eligibility and ordering remain `love-v3.1` plus the existing reciprocal/capacity/rotation policy.
- Friend eligibility and ordering remain the existing Maxxin scorer.
- The Hub concierge remains a decision-support surface; it cannot message, join, accept, book, or pay.

## Measurement foundation

`connection_outcome_events` is the canonical, service-role-only connection ledger. Database triggers mirror durable actions from Love picks, mutual responses, first messages, first replies, two-sided conversations, date feedback, safety reports, Friend actions, and Hub recommendation outcomes. Trigger writes are idempotent and fail open so analytics can never block a product action.

Every compatible event can carry an algorithm version, treatment id, acquisition source, device/display context, entity id and a dedupe key. Admin reads use:

- `connection_outcome_summary(since)`
- `connection_retention_cohorts(days)`
- `/api/admin/connection-intelligence?days=30`

Test and deleted users are excluded from headline aggregates.

## Embeddings

The optional matching evaluation uses OpenAI `text-embedding-3-small` with 384 dimensions. Input version is `connection-profile-v1`.

Inputs include only normalized HEXACO scores, controlled values, relationship rhythms, interest labels and (for Friend) controlled friendship preferences. Inputs exclude names, ages, gender/orientation fields, email, ZIP, photos, biography, prompts, raw quiz answers, and message content.

Generation is idempotent by a SHA-256 input hash. An unchanged profile does not create another OpenAI request. Stored vectors are service-role-only and deleted when the user disables the separate **AI match evaluation** control.

The bounded maintenance route is `/api/cron/connection-embeddings`; it processes at most 25 separately-consented users and runs 10 per day by default. Profile-field changes reset the maintenance cursor.

## Shadow retrieval

Set `EMBEDDING_SHADOW_ENABLED=true` to record comparisons. The RPC receives candidate ids from the existing reciprocal eligibility pipeline, so it cannot widen the pool. It records top-10 overlap, shared-rank correlation, coverage and latency in `embedding_shadow_evaluations`.

`live_order_changed` is constrained to `false` in PostgreSQL. The roster route does not read shadow results into its response or `orderedIds`.

## Promotion gate

Do not use vector results in live ordering until a human reviews at least:

1. consent and embedding coverage;
2. top-10 overlap and rank stability by intent and metro;
3. recommendation-to-action and action-to-reciprocal rates by treatment;
4. first-message, reply, two-sided conversation, met, and would-meet-again rates;
5. pass, expiry, report, block, latency and error guardrails;
6. segment minimum sizes so small demographic cohorts are not exposed or overfit.

Any future live experiment must be separately versioned, reversible, capacity-safe, reciprocal, realm-isolated, and launched as a bounded treatment rather than replacing `love-v3.1` globally.

The service-only `connection_intelligence_config` row makes that gate explicit. Its safe defaults are:

- phase `shadow`;
- live allocation `0%`;
- kill switch on;
- at least 100 shadow evaluations, 30 connection actions and 10 consenting users;
- no live-order changes, at most 1% shadow errors and p95 shadow latency at or below 500ms.

`connection_intelligence_promotion_readiness()` returns the current blockers. Even a clear score card does not activate a live treatment: the application has no code path that reads vector order into the roster, and a future live test requires a human approval timestamp, the kill switch off, and a separately deployed bounded treatment.

The admin Mission Control surface shows coverage, failures, evaluation volume, latency, current blockers and metro-level shadow summaries. Historical cohorts that pre-date the canonical ledger are excluded instead of being reported as false zero-retention cohorts.

## Deployment order

1. Apply `20260820170000_connection_intelligence_foundation.sql`.
2. Deploy the application.
3. Confirm `/api/admin/connection-intelligence` has no schema errors.
4. Test consent on an isolated test account and confirm two vectors at most (Love/Friend as applicable).
5. Enable `EMBEDDING_SHADOW_ENABLED=true` only when shadow collection should begin.
6. Keep live allocation at zero until the admin score card reaches its evidence minimums and a human reviews the segment-level outcomes.
