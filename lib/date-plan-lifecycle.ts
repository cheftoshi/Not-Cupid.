export const DATE_SCHEDULE_DAYS = 60;
export const DATE_DISCOVERY_DAYS = 14;
const DAY = 86_400_000;

export function validateDateSchedule(value: string | null, now = Date.now()) {
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at) || at <= now) throw Error("Choose a future time.");
  if (at > now + DATE_SCHEDULE_DAYS * DAY)
    throw Error("Choose a date within the next 60 days.");
  return new Date(at);
}

export function dateDiscoveryExpiry(when: Date | null, now = Date.now()) {
  return new Date(
    Math.min(when?.getTime() ?? Infinity, now + DATE_DISCOVERY_DAYS * DAY),
  ).toISOString();
}

export function datePreferredGenders(user: {
  date_plan_genders?: string[] | null;
  seeking?: string | null;
}) {
  if (user.date_plan_genders)
    return user.date_plan_genders.filter((g) => ["m", "f", "nb"].includes(g));
  if (user.seeking === "b" || user.seeking === "both") return ["m", "f", "nb"];
  return user.seeking && ["m", "f", "nb"].includes(user.seeking)
    ? [user.seeking]
    : [];
}

export function datePreferencesMatch(
  user: Parameters<typeof datePreferredGenders>[0],
  hostGender?: string,
) {
  return !!hostGender && datePreferredGenders(user).includes(hostGender);
}

export type DateOutcome = {
  planId: string;
  title: string;
  status: string;
  message: string;
};
export function dateOutcomeVisible(
  request: { dismissed_at?: string | null; status_updated_at: string },
  outcome: { status: string },
  expiresAt: string,
  happensAt: string | null,
  now = Date.now(),
) {
  if (request.dismissed_at) return false;
  const resolved =
    outcome.status === "expired"
      ? Math.min(
          Date.parse(expiresAt),
          happensAt ? Date.parse(happensAt) : Infinity,
        )
      : Date.parse(request.status_updated_at);
  return Number.isFinite(resolved) && resolved >= now - 30 * DAY;
}
export function dateOutcome(
  status: string,
  state: string,
  expiresAt: string,
  happensAt: string | null,
  now = Date.now(),
) {
  if (status === "withdrawn" || status === "accepted") return null;
  if (status === "passed")
    return {
      status,
      message:
        "The host passed on this request. You can explore other invitations.",
    };
  if (status === "filled")
    return {
      status,
      message: "This invitation has been filled. Your request is now closed.",
    };
  if (state === "cancelled" || status === "cancelled")
    return {
      status: "cancelled",
      message: "The host cancelled this invitation. No need to make the trip.",
    };
  if (state === "confirmed")
    return {
      status: "filled",
      message: "This invitation has been filled. Your request is now closed.",
    };
  if (
    Date.parse(expiresAt) <= now ||
    (happensAt && Date.parse(happensAt) <= now)
  )
    return {
      status: "expired",
      message: "This invitation closed before a date was confirmed.",
    };
  return null;
}
