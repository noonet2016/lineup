"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginStudent(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!studentId || !password) return { ok: false, error: "กรอกรหัสนักเรียนและรหัสผ่านให้ครบ" };

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.status !== 1) return { ok: false, error: "ไม่พบบัญชีนักเรียนนี้" };

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return { ok: false, error: "รหัสผ่านไม่ถูกต้อง" };

  // Anti-proxy-checkin gate: once a student has bound their LINE account, the normal
  // password form must NOT mint a student session (that path bypasses LINE identity, so a
  // friend who knows the password could check in for them). Bound students enter only via
  // LINE LIFF. Checked AFTER the password verification so this never leaks bind-status to
  // someone who doesn't already know the password. Teacher "unbind" (lineStatus.ts) clears
  // lineUserId and re-opens the form automatically. Unbound students keep using the form.
  if (student.lineUserId) {
    return { ok: false, error: "บัญชีนี้ผูกกับ LINE แล้ว กรุณาเข้าสู่ระบบผ่าน LINE (หากมีปัญหาให้แจ้งครูยกเลิกการผูก)" };
  }

  await createSession("student", student.studentId);
  return { ok: true };
}

export async function loginTeacher(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" };

  const teacher = await prisma.teacher.findUnique({ where: { username } });
  if (!teacher) return { ok: false, error: "ไม่พบบัญชีครูนี้" };

  const valid = await bcrypt.compare(password, teacher.passwordHash);
  if (!valid) return { ok: false, error: "รหัสผ่านไม่ถูกต้อง" };

  await createSession("teacher", String(teacher.id));
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
}
