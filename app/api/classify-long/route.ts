import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readAllCalls, updateCall } from "@/lib/store";
import { classifyCallWithGemini } from "@/lib/gemini";
import { syncCallsToSheets } from "@/lib/sheets";
import type { CallRecord } from "@/lib/types";

export const maxDuration = 300;

const MAX_CALL_DURATION_SECONDS = 40;
const PER_CALL_TIMEOUT_MS = 280000;

function classifyWithTimeout(call: CallRecord, ms = PER_CALL_TIMEOUT_MS) {
  return Promise.race([
    classifyCallWithGemini(call),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini call timed out")), ms)
    ),
  ]);
}

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

  const targets = singleId
    ? pending
    : pending.filter((c) => (c.duration ?? 0) > MAX_CALL_DURATION_SECONDS);

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
