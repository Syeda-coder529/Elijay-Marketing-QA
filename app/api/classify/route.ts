import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, updateCall } from "@/lib/store";
import { classifyCallWithGemini } from "@/lib/gemini";
import { syncCallsToSheets } from "@/lib/sheets";
import { parseDurationToSeconds } from "@/lib/duration";
import type { CallRecord } from "@/lib/types";

// Vercel Hobby now allows up to 300s (as of 2026), so we have room. We still
// keep this well under the limit for safety margin against Gemini variance.
export const maxDuration = 120;

// Only calls at or under this duration (seconds) are auto-classified here.
// Longer calls are handled one at a time by /api/classify-long instead.
const MAX_CALL_DURATION_SECONDS = 40;

// Per-Gemini-call timeout so one stuck/slow call can't hang the whole batch
// and take the rest of the pending records down with it.
const PER_CALL_TIMEOUT_MS = 20000;

function classifyWithTimeout(call: CallRecord, ms = PER_CALL_TIMEOUT_MS) {
  return Promise.race([
    classifyCallWithGemini(call),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini call timed out")), ms)
    ),
  ]);
}

// Classifies PENDING short calls (<=40s) in batches (or a single call if
// `id` is provided). Admin-only. The dashboard calls this endpoint in a loop
// (see app/admin/dashboard/page.tsx) until `remaining` is 0.
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

  // Duration filter: skip long calls here so a slow transcription doesn't
  // eat the whole batch's time budget. Long calls are picked up by
  // /api/classify-long instead.
  const targets = singleId
    ? pending
    : pending.filter((c) => parseDurationToSeconds(c.duration) <= MAX_CALL_DURATION_SECONDS);

  // Smaller batch = more safety margin against per-call latency variance.
  const MAX_PER_RUN = singleId ? 1 : 4;
  const batch = targets.slice(0, MAX_PER_RUN);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const call of batch) {
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
      // One failed/timed-out call no longer blocks the rest of the batch.
    }
  }

  const updatedAll = await readAllCalls();
  const sync = await syncCallsToSheets(updatedAll).catch((e) => ({ synced: false, reason: e.message }));

  return NextResponse.json({
    ok: true,
    processed: results.length,
    remaining: Math.max(0, targets.length - batch.length),
    // How many PENDING calls exist but are over the duration cutoff and
    // therefore not being touched by this run (handled by classify-long).
    skippedLongCalls: singleId ? 0 : pending.length - targets.length,
    results,
    sync
  });
}
