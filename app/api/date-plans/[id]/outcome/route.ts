import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("dismiss_date_outcome", {
    p_plan: id,
    p_user: user.id,
  });
  if (error)
    return NextResponse.json(
      { error: "Could not dismiss the update. Try again." },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json(
      { error: "No closed request found." },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
