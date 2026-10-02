# Session security follow-up — September 29, 2026

## Confirmed and patched locally

`getCurrentUser` previously queried both the SHA-256 hash of the presented cookie
and the cookie itself. A synthetic reproduction confirmed that presenting a
stored version-1 session hash authenticated its owner. This requires prior
access to the stored hash; it does not demonstrate database exposure or abuse.

- Authentication now matches only the hash of the presented bearer, with
  `token_hash_version = 1`.
- Logout uses the same credential rule, rather than accepting stored hashes
  for revocation.
- Invalid and expired timestamps fail closed.
- Plaintext/version-0 sessions no longer authenticate. The baseline migration
  already hashes existing sessions; any remaining legacy sessions must log in
  again. Normal version-1 bearer cookies keep working.
- Four behavior tests cover valid login, hash replay, unsupported versions,
  expiration, blocked/deleted users, logout and cookie-free server reads.

No new migration or production session mutation was performed.

## Verification

- Typecheck passed.
- Full suite: 345 tests passed.
- Production dependency audit in the preceding diagnostic pass: zero reported
  known vulnerabilities. This does not certify application security.
- Production build completed successfully (TypeScript and all 73 static pages).
- Release authorized October 2; live deployment status is verified separately.

## Additional review priorities, not yet proven exploits

Friend roster/pack profile reads do not directly filter deleted/blocked accounts
or recheck report exclusions. Love message-history GET checks match ownership
but not current pair reports or the other account's eligibility. Audit cleanup
and database enforcement, reproduce with synthetic fixtures, then align read
policies with the corresponding profile screens. Preserve deliberately allowed
read-only archives where policy permits them; do not erase conversation evidence.

The external researcher's specific finding is still unknown. On September 29,
the operator approved one disclosure-request email, and the provider accepted
it (ID `01a0eeb3-bbab-7309-91ca-0acba9da48d0`). Provider acceptance is not proof
of inbox delivery. No bounty, credentials or testing authorization was offered.
