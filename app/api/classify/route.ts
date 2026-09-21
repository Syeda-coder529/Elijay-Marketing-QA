import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, updateCall } from "@/lib/store";
import { classifyCallWithGemini } from "@/lib/gemini";
import { syncCallsToSheets } from "@/lib/sheets";

// Allow this function to run longer than the Next.js default (10s) so each
// batch has room to call Gemini multiple times in sequence. Vercel Hobby
// projects are capped at 60s for this value; Pro/Enterprise can go higher.
// If you're on Hobby and still see timeouts, lower MAX_PER_RUN below instead.
export const maxDuration = 60;

// Classifies PENDING calls in batches (or a single call if `id` is provided).
// Admin-only. The dashboard calls this endpoint in a loop (see
// app/admin/dashboard/page.tsx) until `remaining` is 0, so from the user's
// perspective clicking "Run AI QA" once processes every call — batching here
// just keeps each individual serverless invocation short enough to avoid
// hitting Vercel's function time limit or Gemini's rate limits.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const singleId: string | undefined = body?.id;

  const all = await readAllCalls();
  const targets = singleId ? all.filter((c) => c.id === singleId) : all.filter((c) => c.qaResult === "PENDING");

  // Audio transcription+classification calls are slower than plain text
  // classification was, so a smaller batch keeps each request comfortably
  // inside the 60s function limit.
  const MAX_PER_RUN = singleId ? 1 : 8;
  const batch = targets.slice(0, MAX_PER_RUN);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const call of batch) {
    try {
      const classification = await classifyCallWithGemini(call);
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
  }

  const updatedAll = await readAllCalls();
  const sync = await syncCallsToSheets(updatedAll).catch((e) => ({ synced: false, reason: e.message }));

  return NextResponse.json({
    ok: true,
    processed: results.length,
    remaining: Math.max(0, targets.length - batch.length),
    results,
    sync
  });
}
