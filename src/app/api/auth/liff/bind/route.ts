import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";

/**
 * LIFF self-bind: a student who opened the app in LINE but has no bound account proves who
 * they are with studentId + password, and we attach their (server-verified) LINE userId. Then
 * we mint the session so they land straight in /checkin. Mirrors loginStudent's bcrypt check.
 */
export async function POST(req: NextRequest) {
  let idToken: string | undefined;
  let studentId = "";
  let password = "";
  try {
    const body = (await req.json()) as { idToken?: string; studentId?: string; password?: string };
    idToken = body?.idToken;
    studentId = String(body?.studentId ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    // fall through
  }
  if (!idToken) return NextResponse.json({ ok: false, error: "missing_id_token" }, { status: 400 });
  if (!studentId || !password) {
    return NextResponse.json({ ok: false, error: "กรอกรหัสนักเรียนและรหัสผ่านให้ครบ" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyLiffIdToken(idToken);
  } catch {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.status !== 1) {
    return NextResponse.json({ ok: false, error: "ไม่พบบัญชีนักเรียนนี้" }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });

  // Already bound to a DIFFERENT LINE account → block (teacher must unbind first).
  if (student.lineUserId && student.lineUserId !== identity.userId) {
    return NextResponse.json(
      { ok: false, error: "บัญชีนักเรียนนี้ผูกกับ LINE อื่นไว้แล้ว — แจ้งครูให้ยกเลิกการผูกก่อน" },
      { status: 409 },
    );
  }

  try {
    await prisma.student.update({
      where: { studentId },
      data: {
        lineUserId: identity.userId,
        lineDisplayName: identity.displayName || null,
        linePictureUrl: identity.pictureUrl ?? null,
      },
    });
  } catch {
    // Unique constraint on line_user_id: this LINE is already bound to another user.
    return NextResponse.json(
      { ok: false, error: "LINE นี้ถูกผูกกับบัญชีอื่นแล้ว" },
      { status: 409 },
    );
  }

  await createSession("student", student.studentId);
  return NextResponse.json({ ok: true, redirect: "/checkin" });
}
