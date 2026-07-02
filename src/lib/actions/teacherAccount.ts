"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassroom } from "@/lib/teacher";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Mirrors legacy teacher/settings.php action=change_teacher_pw. */
export async function changeTeacherPassword(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const currentPw = String(formData.get("current_pw") ?? "");
  const newPw = String(formData.get("new_pw") ?? "");
  const confirmPw = String(formData.get("confirm_pw") ?? "");

  const record = await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.teacherId } });

  const validCurrent = await bcrypt.compare(currentPw, record.passwordHash);
  if (!validCurrent) return { ok: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  if (newPw.length < 6) return { ok: false, message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" };
  if (newPw !== confirmPw) return { ok: false, message: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน" };

  const sameAsOld = await bcrypt.compare(newPw, record.passwordHash);
  if (sameAsOld) return { ok: false, message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };

  const newHash = await bcrypt.hash(newPw, 10);
  await prisma.teacher.update({ where: { id: teacher.teacherId }, data: { passwordHash: newHash } });

  return { ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}
