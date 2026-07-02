// Session = signed, httpOnly cookie (HMAC-SHA256 with SESSION_SECRET). No external session store.
// Pattern proven in the sibling homework-next project (src/lib/auth.ts).
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "lineup_session";
const SESSION_AGE = 60 * 60 * 12; // 12h

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type Role = "student" | "teacher";
export type Session = { role: Role; id: string } | null;

export async function createSession(role: Role, id: string): Promise<void> {
  const exp = Date.now() + SESSION_AGE * 1000;
  const payload = JSON.stringify({ role, id, exp });
  const value = Buffer.from(payload).toString("base64url");
  const token = `${value}.${sign(value)}`;
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig || sign(value) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!data.exp || Date.now() > data.exp) return null;
    if (data.role !== "student" && data.role !== "teacher") return null;
    return { role: data.role, id: data.id };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<NonNullable<Session>> {
  const session = await getSession();
  if (!session) throw new Error("ต้องเข้าสู่ระบบก่อน");
  return session;
}
