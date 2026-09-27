import test from "node:test";
import assert from "node:assert/strict";
import { planHasEnded } from "../lib/connection-plans.ts";
import {
  validateDateSchedule,
  dateDiscoveryExpiry,
  datePreferredGenders,
  datePreferencesMatch,
  dateOutcome,
} from "../lib/date-plan-lifecycle.ts";

const now = Date.parse("2026-09-27T12:00:00Z");
const day = 86400000;
test("confirmed dates outlive their discovery window", () => {
  const plan = {
    state: "confirmed",
    expires_at: new Date(now - day).toISOString(),
    happens_at: new Date(now + day).toISOString(),
  };
  assert.equal(planHasEnded(plan, now), false);
  assert.equal(planHasEnded({ ...plan, state: "open" }, now), true);
});
test("date schedule accepts the boundary and rejects past, invalid and distant dates", () => {
  assert.equal(validateDateSchedule(null, now), null);
  assert.equal(
    validateDateSchedule(new Date(now + 60 * day).toISOString(), now).getTime(),
    now + 60 * day,
  );
  for (const value of [
    "not a date",
    new Date(now).toISOString(),
    new Date(now + 60 * day + 1).toISOString(),
  ])
    assert.throws(() => validateDateSchedule(value, now));
});
test("discovery ends independently of a distant date and never after the date starts", () => {
  assert.equal(Date.parse(dateDiscoveryExpiry(null, now)), now + 14 * day);
  assert.equal(
    Date.parse(dateDiscoveryExpiry(new Date(now + 60 * day), now)),
    now + 14 * day,
  );
  assert.equal(
    Date.parse(dateDiscoveryExpiry(new Date(now + day), now)),
    now + day,
  );
});
test("explicit date preferences override Love and unknown preferences are not inferred", () => {
  assert.deepEqual(datePreferredGenders({}), []);
  assert.deepEqual(datePreferredGenders({ seeking: "both" }), ["m", "f", "nb"]);
  assert.equal(
    datePreferencesMatch({ seeking: "m", date_plan_genders: ["f"] }, "m"),
    false,
  );
  assert.equal(
    datePreferencesMatch({ seeking: "m", date_plan_genders: ["f"] }, "f"),
    true,
  );
  assert.equal(datePreferencesMatch({ seeking: "nb" }, "nb"), true);
  assert.equal(datePreferencesMatch({}, "f"), false);
});
test("request history distinguishes filled, declined, cancelled and expired without identities", () => {
  const future = new Date(now + day).toISOString();
  assert.equal(dateOutcome("pending", "open", future, null, now), null);
  assert.equal(dateOutcome("withdrawn", "cancelled", future, null, now), null);
  assert.equal(dateOutcome("accepted", "cancelled", future, null, now), null);
  assert.equal(
    dateOutcome("filled", "confirmed", future, null, now).status,
    "filled",
  );
  assert.equal(
    dateOutcome("passed", "open", future, null, now).status,
    "passed",
  );
  assert.equal(
    dateOutcome("cancelled", "cancelled", future, null, now).status,
    "cancelled",
  );
  assert.equal(
    dateOutcome("pending", "open", new Date(now).toISOString(), null, now)
      .status,
    "expired",
  );
  assert.equal(
    dateOutcome("pending", "open", future, new Date(now).toISOString(), now)
      .status,
    "expired",
  );
});
