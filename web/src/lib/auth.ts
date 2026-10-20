import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dapurplan_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const DEV_SECRET = "dapurplan-local-prototype-session-secret-only";
type OwnerSession = { username: "owner"; role: "owner"; expiresAt: number };

function secret() {
  const value = process.env.DEMO_SESSION_SECRET?.trim();
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("Set DEMO_SESSION_SECRET to at least 32 characters.");
  return DEV_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createOwnerSession() {
  const session: OwnerSession = { username: "owner", role: "owner", expiresAt: Date.now() + SESSION_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string | undefined): OwnerSession | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(body));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OwnerSession;
    if (session.username !== "owner" || session.role !== "owner" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function getOwnerSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
