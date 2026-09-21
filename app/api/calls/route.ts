import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCallsForRole, isUsingRedis } from "@/lib/store";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const calls = await getCallsForRole(session.role, session.id);
  return NextResponse.json({
    ok: true,
    calls,
    role: session.role,
    id: session.id,
    persistent: isUsingRedis()
  });
}
