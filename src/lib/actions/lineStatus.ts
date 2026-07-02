"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassroom } from "@/lib/teacher";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Teacher-triggered unbind: clears a student's LINE link so they can re-bind (e.g. linked the wrong account). */
export async function unlinkStudentLine(studentId: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== teacher.classroomId) {
    return { ok: false, message: "ไม่พบนักเรียนในห้องนี้" };
  }
  if (!student.lineUserId) {
    return { ok: false, message: "นักเรียนคนนี้ยังไม่ได้ผูกบัญชี LINE" };
  }

  await prisma.student.update({
    where: { studentId },
    data: { lineUserId: null, lineDisplayName: null, linePictureUrl: null },
  });
  await prisma.attendanceLog.create({
    data: { studentId, eventType: "settings_changed", detail: `ครู ${teacher.fullName} ยกเลิกการผูกบัญชี LINE ของนักเรียน ${studentId}` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/line-status`);
  return { ok: true, message: "ยกเลิกการผูกบัญชี LINE แล้ว" };
}
