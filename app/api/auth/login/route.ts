import { NextRequest, NextResponse } from "next/server";
import { checkAdminLogin, checkPublisherLogin, checkBuyerLogin } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { role, username, password } = await req.json();

  let result;
  if (role === "admin") result = checkAdminLogin(username, password);
  else if (role === "publisher") result = await checkPublisherLogin(username, password);
  else if (role === "buyer") result = await checkBuyerLogin(username, password);
  else return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });

  if (!result.ok || !result.role || !result.id) {
    return NextResponse.json({ ok: false, error: result.error || "Login failed" }, { status: 401 });
  }

  await createSession({ role: result.role, id: result.id });
  return NextResponse.json({ ok: true, role: result.role, id: result.id });
}
