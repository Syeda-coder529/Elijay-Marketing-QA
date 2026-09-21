import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { CallRecord } from "./types";

// ---------------------------------------------------------------------------
// PERSISTENCE
//
// Vercel serverless functions do NOT share a filesystem between invocations —
// each request can land on a different instance, and /tmp is wiped between
// them. A local JSON file therefore cannot be the source of truth in
// production: a CSV uploaded in one request may be invisible to a later
// request (e.g. "Run AI QA" reporting 0 calls right after an upload).
//
// Fix: use Upstash Redis (installed via the Vercel Marketplace — Vercel's
// own "KV" product was retired in Dec 2024 in favor of Upstash) as the real,
// shared store in production. If no Redis credentials are present (e.g.
// local `npm run dev` with nothing configured), this module transparently
// falls back to the local JSON file so the app still works for local dev.
// ---------------------------------------------------------------------------

const REDIS_KEY = "elijay:calls";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ---- local JSON file fallback (dev only) ----

const isProd = process.env.VERCEL === "1";
const DATA_FILE = isProd
  ? path.join("/tmp", "elijay-calls.json")
  : path.join(process.cwd(), "data", "calls.json");

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const seedPath = path.join(process.cwd(), "data", "calls.json");
    if (fs.existsSync(seedPath) && DATA_FILE !== seedPath) {
      fs.copyFileSync(seedPath, DATA_FILE);
    } else {
      fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    }
  }
}

function readLocalFile(): CallRecord[] {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as CallRecord[];
  } catch {
    return [];
  }
}

function writeLocalFile(calls: CallRecord[]) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2), "utf-8");
}

// ---- public API (async now, so it can talk to Redis) ----

export async function readAllCalls(): Promise<CallRecord[]> {
  const redis = getRedis();
  if (redis) {
    const data = await redis.get<CallRecord[]>(REDIS_KEY);
    return data || [];
  }
  return readLocalFile();
}

export async function writeAllCalls(calls: CallRecord[]): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, calls);
    return;
  }
  writeLocalFile(calls);
}

export async function appendCalls(newCalls: CallRecord[]): Promise<CallRecord[]> {
  const existing = await readAllCalls();
  const merged = [...existing, ...newCalls];
  await writeAllCalls(merged);
  return merged;
}

export async function updateCall(id: string, patch: Partial<CallRecord>): Promise<CallRecord | null> {
  const calls = await readAllCalls();
  const idx = calls.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  calls[idx] = { ...calls[idx], ...patch };
  await writeAllCalls(calls);
  return calls[idx];
}

export async function getCallsForRole(role: "admin" | "publisher" | "buyer", id: string): Promise<CallRecord[]> {
  const all = await readAllCalls();
  if (role === "admin") return all;
  if (role === "publisher") return all.filter((c) => c.publisher === id);
  return all.filter((c) => c.target === id);
}

export async function listPublisherIds(): Promise<string[]> {
  const all = await readAllCalls();
  return Array.from(new Set(all.map((c) => c.publisher).filter(Boolean)));
}

export async function listTargetIds(): Promise<string[]> {
  const all = await readAllCalls();
  return Array.from(new Set(all.map((c) => c.target).filter(Boolean)));
}

export function isUsingRedis(): boolean {
  return !!getRedis();
}
