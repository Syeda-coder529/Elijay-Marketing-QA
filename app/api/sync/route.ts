import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls } from "@/lib/store";
import { syncCallsToSheets } from "@/lib/sheets";

// Syncs the full call set to Google Sheets. Kept as its own endpoint (rather
// than being called after every classify batch) so we don't hammer the
// Sheets API's per-minute quota during a "Run AI QA" session that can make
// 20-50+ classify requests in a row.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const all = await readAllCalls();
  const sync = await syncCallsToSheets(all).catch((e) => ({ synced: false, reason: e.message }));

  return NextResponse.json({ ok: true, sync });
}
