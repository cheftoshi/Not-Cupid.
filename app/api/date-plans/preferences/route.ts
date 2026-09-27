import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.age || user.age < 18)
    return NextResponse.json(
      { error: "Date invitations are for adults." },
      { status: 403 },
    );
  const limit = await rateLimit({
    key: `date-preferences:${user.id}`,
    windowSec: 3600,
    maxAttempts: 30,
    blockSec: 900,
  });
  if (!limit.ok)
    return NextResponse.json(
      { error: "Please wait before changing preferences again." },
      { status: 429 },
    );
  const body = await req.json().catch(() => null);
  if (
    !Array.isArray(body?.genders) ||
    !body.genders.length ||
    body.genders.length > 3 ||
    body.genders.some(
      (g: unknown) => typeof g !== "string" || !["m", "f", "nb"].includes(g),
    )
  ) {
    return NextResponse.json(
      { error: "Choose who you would like to meet." },
      { status: 400 },
    );
  }
  const { error } = await supabaseAdmin
    .from("users")
    .update({ date_plan_genders: [...new Set(body.genders)] })
    .eq("id", user.id)
    .is("deleted_at", null);
  return NextResponse.json(
    error ? { error: "Could not save date preferences." } : { ok: true },
    { status: error ? 503 : 200 },
  );
}
