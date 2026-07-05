"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LINE_CHAT_ID_ERROR, normalizeLineChatId } from "@/lib/lineChatId";
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

export async function setStudentLineChatId(studentId: string, rawValue: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== teacher.classroomId) {
    return { ok: false, message: "ไม่พบนักเรียนในห้องนี้" };
  }

  let lineChatId: string | null;
  try {
    lineChatId = normalizeLineChatId(rawValue);
  } catch {
    return { ok: false, message: LINE_CHAT_ID_ERROR };
  }

  await prisma.student.update({
    where: { studentId },
    data: { lineChatId },
  });
  await prisma.attendanceLog.create({
    data: {
      studentId,
      eventType: "settings_changed",
      detail: `ครู ${teacher.fullName} แก้ไข LINE ID ของนักเรียน ${studentId}: ${student.lineChatId ?? "(ว่าง)"} -> ${lineChatId ?? "(ว่าง)"}`,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/line-status`);
  return { ok: true, message: "บันทึก LINE ID แล้ว" };
}
