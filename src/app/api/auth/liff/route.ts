import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";

/**
 * LIFF login: the /liff client sends the LIFF-issued OpenID ID token here. We verify it
 * server-side (never trusting a client-sent userId), map the verified LINE userId to an
 * existing bound student/teacher, and mint the normal session cookie. From then on the
 * student uses the same session-based pages (/checkin, leave, /account) inside the LINE webview.
 */
export async function POST(req: NextRequest) {
  let idToken: string | undefined;
  try {
    const body = (await req.json()) as { idToken?: string };
    idToken = body?.idToken;
  } catch {
    // fall through to missing-token handling
  }
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "missing_id_token" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyLiffIdToken(idToken);
  } catch {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({ where: { lineUserId: identity.userId } });
  if (student && student.status === 1) {
    await createSession("student", student.studentId);
    return NextResponse.json({ ok: true, role: "student", redirect: "/checkin" });
  }

  const teacher = await prisma.teacher.findUnique({ where: { lineUserId: identity.userId } });
  if (teacher) {
    await createSession("teacher", String(teacher.id));
    return NextResponse.json({ ok: true, role: "teacher", redirect: "/account" });
  }

  // Verified LINE user, but no bound account. The /liff client shows guidance
  // (teacher binds them, or bind via the web first). Self-bind can be added later.
  return NextResponse.json({ ok: false, error: "not_linked" }, { status: 404 });
}
