import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Re-check queued notifications: a later withdrawal, cancellation, deletion or block wins.
export async function dateNoticeStillRelevant(job: {
  entity_id: string;
  recipient_id: string;
  actor_id: string | null;
  dedupe_key?: string;
  payload: { dateEvent?: string };
}) {
  if (!job.actor_id) return false;
  // A legacy duplicate may already have been leased when the migration ran.
  // The canonical historical job was renamed to the stable two-part key.
  if (
    job.payload.dateEvent === "pending" &&
    job.dedupe_key?.startsWith("date-request:") &&
    job.dedupe_key.split(":").length > 2
  )
    return false;
  const [plan, people, reports] = await Promise.all([
    supabaseAdmin
      .from("connection_date_plans")
      .select("host_id,guest_id,state,is_test,expires_at,happens_at")
      .eq("id", job.entity_id)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("id,is_test")
      .in("id", [job.recipient_id, job.actor_id])
      .is("deleted_at", null)
      .neq("is_blocked", true)
      .gte("age", 18),
    supabaseAdmin
      .from("user_reports")
      .select("id")
      .or(
        `and(reporter_id.eq.${job.actor_id},reported_id.eq.${job.recipient_id}),and(reporter_id.eq.${job.recipient_id},reported_id.eq.${job.actor_id})`,
      )
      .limit(1),
  ]);
  if (plan.error || people.error || reports.error)
    throw Error("date_notice_access_check_failed");
  const p = plan.data;
  if (
    !p ||
    p.is_test ||
    people.data?.length !== 2 ||
    people.data.some((u) => u.is_test === true) ||
    reports.data?.length
  )
    return false;
  const event = job.payload.dateEvent;
  if (event === 'message')
    return p.state === 'confirmed' && job.actor_id !== job.recipient_id &&
      [p.host_id, p.guest_id].includes(job.actor_id) &&
      [p.host_id, p.guest_id].includes(job.recipient_id);
  if (event === "venue_update")
    return p.state === "confirmed" && p.guest_id === job.recipient_id;
  if (
    event === "cancelled" &&
    [p.host_id, p.guest_id].includes(job.recipient_id)
  )
    return p.state === "cancelled";
  const requester = event === "pending" ? job.actor_id : job.recipient_id;
  const request = await supabaseAdmin
    .from("connection_date_requests")
    .select("status")
    .eq("plan_id", job.entity_id)
    .eq("user_id", requester)
    .maybeSingle();
  if (request.error) throw Error("date_notice_request_check_failed");
  if (event === "pending")
    return (
      p.state === "open" &&
      Date.parse(p.expires_at) > Date.now() &&
      (!p.happens_at || Date.parse(p.happens_at) > Date.now()) &&
      request.data?.status === "pending"
    );
  if (event === "accepted")
    return p.state === "confirmed" && p.guest_id === job.recipient_id;
  return (
    ["passed", "filled", "cancelled"].includes(event || "") &&
    request.data?.status === event
  );
}
