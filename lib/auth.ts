import { listPublisherIds, listTargetIds } from "./store";
import { Role } from "./types";

export interface LoginResult {
  ok: boolean;
  role?: Role;
  id?: string;
  error?: string;
}

// Admin: single account, credentials come from env vars only.
export function checkAdminLogin(username: string, password: string): LoginResult {
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminPass) {
    return { ok: false, error: "Admin login is not configured. Set ADMIN_PASSWORD in your environment." };
  }
  if (username === adminUser && password === adminPass) {
    return { ok: true, role: "admin", id: "admin" };
  }
  return { ok: false, error: "Invalid admin credentials." };
}

// Publisher & Buyer: username AND password both equal their ID (e.g. EINT1031P),
// and that ID must actually exist in the uploaded call data.
export async function checkPublisherLogin(username: string, password: string): Promise<LoginResult> {
  if (!username || username !== password) {
    return { ok: false, error: "Publisher ID and password must match." };
  }
  const ids = await listPublisherIds();
  if (!ids.includes(username)) {
    return { ok: false, error: "Unknown Publisher ID. Ask admin to upload your call data first." };
  }
  return { ok: true, role: "publisher", id: username };
}

export async function checkBuyerLogin(username: string, password: string): Promise<LoginResult> {
  if (!username || username !== password) {
    return { ok: false, error: "Target ID and password must match." };
  }
  const ids = await listTargetIds();
  if (!ids.includes(username)) {
    return { ok: false, error: "Unknown Target ID. Ask admin to upload call data first." };
  }
  return { ok: true, role: "buyer", id: username };
}
