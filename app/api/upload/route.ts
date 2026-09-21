import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseCallsCsv } from "@/lib/csv";
import { appendCalls } from "@/lib/store";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const { calls, errors } = parseCallsCsv(text);

  if (calls.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid rows found in CSV", errors }, { status: 400 });
  }

  const all = await appendCalls(calls);

  return NextResponse.json({
    ok: true,
    imported: calls.length,
    total: all.length,
    errors
  });
}
