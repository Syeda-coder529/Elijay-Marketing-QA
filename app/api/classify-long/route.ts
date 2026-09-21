import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, updateCall } from "@/lib/store";
import { classifyCallWithGemini } from "@/lib/gemini";
import { syncCallsToSheets } from "@/lib/sheets";
import { parseDurationToSeconds } from "@/lib/duration";
import type { CallRecord } from "@/lib/types";

// Long calls need the full time budget for a single call — Vercel Hobby
// allows up to 300s (2026 limits), so we use nearly all of it here since
// only ONE call is processed per invocation.
export const maxDuration = 300;

// Calls at or under this are handled by the fast /api/classify route instead.
const MAX_CALL_DURATION_SECONDS = 40;

// Leave a small safety margin below maxDuration so we always get a chance
// to write the result + respond before Vercel kills the function.
const PER_CALL_TIMEOUT_MS = 280000; // 280s

function classifyWithTimeout(call: CallRecord, ms = PER_CALL_TIMEOUT_MS) {
  return Promise.race([
    classifyCallWithGemini(call),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini call timed out")), ms)
    ),
  ]);
}

// Classifies ONE long (>40s) PENDING call per invocation. Admin-only.
// The dashboard loops this endpoint (like it already loops /api/classify)
// until `remaining` is 0.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const singleId: string | undefined = body?.id;

  const all = await readAllCalls();

  const pending = singleId
    ? all.filter((c) => c.id === singleId)
    : all.filter((c) => c.qaResult === "PENDING");

  // Only long calls here — the ones the fast route skips.
  const targets = singleId
    ? pending
    : pending.filter((c) => parseDurationToSeconds(c.duration) > MAX_CALL_DURATION_SECONDS);

  // Always exactly one at a time for long calls.
  const call = targets[0];

  if (!call) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      remaining: 0,
      results: [],
      sync: { synced: false, reason: "Nothing to process" }
    });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  try {
    const classification = await classifyWithTimeout(call);
    await updateCall(call.id, {
      qaResult: classification.result,
      qaReason: classification.reason,
      qaScore: classification.score,
      qaTranscript: classification.transcript
    });
    results.push({ id: call.id, ok: true });
  } catch (e: any) {
    results.push({ id: call.id, ok: false, error: e.message });
  }

  const updatedAll = await readAllCalls();
  const sync = await syncCallsToSheets(updatedAll).catch((e) => ({ synced: false, reason: e.message }));

  return NextResponse.json({
    ok: true,
    processed: results.length,
    remaining: Math.max(0, targets.length - 1),
    results,
    sync
  });
}
