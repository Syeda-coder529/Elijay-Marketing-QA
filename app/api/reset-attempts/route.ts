import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, writeAllCalls } from "@/lib/store";

// One-time utility: clears qaAttempts/qaError on all still-PENDING calls so
// they become eligible for auto-classification again. Useful after fixing
// a root cause (like a deprecated Gemini model) that was causing every call
// to hit MAX_ATTEMPTS and get silently excluded from future runs.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const all = await readAllCalls();
  let resetCount = 0;

  const updated = all.map((c) => {
    if (c.qaResult === "PENDING" && ((c.qaAttempts ?? 0) > 0 || c.qaError)) {
      resetCount += 1;
      return { ...c, qaAttempts: 0, qaError: undefined };
    }
    return c;
  });

  await writeAllCalls(updated);

  return NextResponse.json({ ok: true, resetCount });
}
