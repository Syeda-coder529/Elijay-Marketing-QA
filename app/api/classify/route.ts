import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, updateCall } from "@/lib/store";
import { classifyCallWithGemini } from "@/lib/gemini";
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

// After this many failed attempts, stop auto-retrying a call — it needs
// manual review instead of silently looping forever and burning quota.
const MAX_ATTEMPTS = 3;

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
// (see app/admin/dashboard/page.tsx) until `remaining` is 0. Google Sheets
// sync is NOT done here — call /api/sync once after the full run instead.
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
    : all.filter((c) => c.qaResult === "PENDING" && (c.qaAttempts ?? 0) < MAX_ATTEMPTS);

  // Duration filter: skip long calls here so a slow transcription doesn't
  // eat the whole batch's time budget. Long calls are picked up by
  // /api/classify-long instead.
  const targets = singleId
    ? pending
    : pending.filter((c) => parseDurationToSeconds(c.duration) <= MAX_CALL_DURATION_SECONDS);

  // Smaller batch = more safety margin against per-call latency variance.
  const MAX_PER_RUN = singleId ? 1 : 4;
  const batch = targets.slice(0, MAX_PER_RUN);

  let successCount = 0;
  let failCount = 0;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const call of batch) {
    try {
      const classification = await classifyWithTimeout(call);
      await updateCall(call.id, {
        qaResult: classification.result,
        qaReason: classification.reason,
        qaScore: classification.score,
        qaTranscript: classification.transcript,
        qaError: undefined
      });
      results.push({ id: call.id, ok: true });
      successCount += 1;
    } catch (e: any) {
      const attempts = (call.qaAttempts ?? 0) + 1;
      await updateCall(call.id, {
        qaAttempts: attempts,
        qaError: e.message
        // Stays PENDING until MAX_ATTEMPTS is hit, then it's simply excluded
        // from future auto-runs (still visible in the dashboard as PENDING
        // with qaError set, for manual review).
      });
      results.push({ id: call.id, ok: false, error: e.message });
      failCount += 1;
    }
  }

  const updatedAll = await readAllCalls();
  const stuckCount = updatedAll.filter(
    (c) => c.qaResult === "PENDING" && (c.qaAttempts ?? 0) >= MAX_ATTEMPTS
  ).length;

  return NextResponse.json({
    ok: true,
    processed: successCount, // only successful classifications count here now
    failed: failCount,
    remaining: Math.max(0, targets.length - batch.length),
    // How many PENDING calls exist but are over the duration cutoff and
    // therefore not being touched by this run (handled by classify-long).
    skippedLongCalls: singleId ? 0 : pending.length - targets.length,
    stuckCount, // calls that hit MAX_ATTEMPTS and need manual attention
    results
  });
}
