"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassroom } from "@/lib/teacher";
import { nowInBangkok } from "@/lib/time";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const VALID_STATUSES = ["present", "late", "absent", "pending", "flagged"] as const;

/**
 * Mirrors legacy teacher/edit_status.php's status-edit branch: requires today's session to already
 * be open (auto-opened by a student check-in, or by openTodaySession below), requires a reason,
 * updates the existing record or inserts one (for a student who was absent all along), stamps
 * check_time to the edit moment same as legacy, and logs status_changed.
 */
export async function updateStudentStatus(studentId: string, status: string, editReason: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return { ok: false, message: "ประเภทสถานะที่เลือกไม่ถูกต้อง" };
  }
  const reason = editReason.trim();
  if (!reason) return { ok: false, message: "กรุณากรอกเหตุผลความจำเป็นในการแก้ไขสถานะทุกครั้ง" };

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.status !== 1) return { ok: false, message: "ไม่พบข้อมูลนักเรียน" };
  if (student.classroomId !== teacher.classroomId) {
    return { ok: false, message: "คุณไม่มีสิทธิ์แก้ไขสถานะของนักเรียนนอกห้องเรียนที่ดูแล" };
  }

  const { dateOnly: today, wallClock: editTime } = nowInBangkok();
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: teacher.classroomId } },
  });
  if (!session) {
    return { ok: false, message: "ยังไม่ได้เปิดรอบลงทะเบียนเช็คชื่อในวันนี้ กรุณาเปิดรอบก่อน" };
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  const previousStatus = existing?.status ?? "absent";

  if (existing) {
    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { status, editedBy: teacher.teacherId, editReason: reason, checkTime: editTime },
    });
  } else {
    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId,
        status,
        checkTime: editTime,
        editedBy: teacher.teacherId,
        editReason: reason,
      },
    });
  }

  await prisma.attendanceLog.create({
    data: {
      studentId,
      eventType: "status_changed",
      detail: `ครู ${teacher.fullName} ได้แก้ไขสถานะจาก '${previousStatus}' เป็น '${status}' ด้วยเหตุผล: '${reason}'`,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}`);
  revalidatePath(`/classrooms/${teacher.classroomId}/students/${studentId}`);
  return { ok: true, message: `แก้ไขสถานะของ ${student.fullName} เรียบร้อยแล้ว` };
}

/** Mirrors legacy edit_status.php's reset_pw action: reset to the student's own ID, force change on next login. */
export async function resetStudentPassword(studentId: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== teacher.classroomId) {
    return { ok: false, message: "ไม่พบข้อมูลนักเรียนในห้องเรียนที่คุณดูแล" };
  }

  const newHash = await bcrypt.hash(studentId, 10);
  await prisma.student.update({ where: { studentId }, data: { passwordHash: newHash, mustChangePw: 1 } });
  await prisma.attendanceLog.create({
    data: {
      studentId,
      eventType: "password_changed",
      detail: `ครู ${teacher.fullName} รีเซ็ตรหัสผ่านนักเรียน ${student.fullName} กลับเป็นรหัสนักเรียน`,
    },
  });

  return {
    ok: true,
    message: `รีเซ็ตรหัสผ่านของ ${student.fullName} เรียบร้อย — รหัสใหม่คือ "รหัสนักเรียน" และจะบังคับเปลี่ยนเมื่อล็อกอินครั้งถัดไป`,
  };
}
