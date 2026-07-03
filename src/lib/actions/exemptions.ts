"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassroom } from "@/lib/teacher";
import { formatDateInput, nowInBangkok } from "@/lib/time";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function normalizeReviewNote(note?: string): string | null {
  const trimmed = String(note ?? "").trim();
  return trimmed ? trimmed.slice(0, 255) : null;
}

function formatLeaveRange(startDate: Date | null, endDate: Date | null): string {
  if (!startDate || !endDate) return "-";
  const start = formatDateInput(startDate);
  const end = formatDateInput(endDate);
  return start === end ? start : `${start} ถึง ${end}`;
}

/**
 * Mirrors legacy teacher/exemptions.php action=add_exemption. `weekdayOption` is one of
 * "all" | "today" | "1".."7" from the UI (legacy only exposed 1-5, this port keeps the schema's
 * full 1-7 range available). "today" collapses to a one-off single-day exemption (weekday=null,
 * start=end=today) exactly like legacy's shortcut for "student is off to a competition today".
 */
export async function addExemption(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const studentId = String(formData.get("student_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const weekdayOption = String(formData.get("weekday") ?? "all");
  const startDateInput = String(formData.get("start_date") ?? "").trim();
  const endDateInput = String(formData.get("end_date") ?? "").trim();

  const student = await prisma.student.findFirst({ where: { studentId, classroomId: teacher.classroomId } });
  if (!student) return { ok: false, message: "ไม่พบนักเรียนคนนี้ในห้องของคุณ" };
  if (!reason) return { ok: false, message: "กรุณาระบุเหตุผล (เช่น ร.ด., นางรำ)" };

  let weekday: number | null = null;
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (weekdayOption === "today") {
    const { dateOnly: today } = nowInBangkok();
    startDate = today;
    endDate = today;
  } else if (weekdayOption !== "all") {
    weekday = Number(weekdayOption);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { ok: false, message: "วันในสัปดาห์ไม่ถูกต้อง" };
    startDate = startDateInput ? parseDateInput(startDateInput) : null;
    endDate = endDateInput ? parseDateInput(endDateInput) : null;
  } else {
    startDate = startDateInput ? parseDateInput(startDateInput) : null;
    endDate = endDateInput ? parseDateInput(endDateInput) : null;
  }

  await prisma.studentExemption.create({
    data: { studentId, reason, weekday, startDate, endDate, createdBy: teacher.teacherId, isActive: 1 },
  });
  await prisma.attendanceLog.create({
    data: { studentId, eventType: "settings_changed", detail: `ครู ${teacher.fullName} เพิ่มการยกเว้นเข้าแถว: ${reason}` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "เพิ่มการยกเว้นเรียบร้อยแล้ว" };
}

/** Mirrors legacy action=delete_exemption — fixes the legacy soft-success bug: reports failure if not found/owned. */
export async function deleteExemption(exemptId: number): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const exemption = await prisma.studentExemption.findFirst({
    where: { id: exemptId, student: { classroomId: teacher.classroomId } },
  });
  if (!exemption) return { ok: false, message: "ไม่พบรายการยกเว้น หรือไม่ใช่ห้องของคุณ" };

  await prisma.studentExemption.delete({ where: { id: exemptId } });
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "ลบการยกเว้นเรียบร้อยแล้ว" };
}

/** Not present in legacy (is_active was a dead column there) — added since the schema already supports it. */
export async function toggleExemptionActive(exemptId: number, isActive: boolean): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const result = await prisma.studentExemption.updateMany({
    where: { id: exemptId, student: { classroomId: teacher.classroomId } },
    data: { isActive: isActive ? 1 : 0 },
  });
  if (result.count === 0) return { ok: false, message: "ไม่พบรายการยกเว้น หรือไม่ใช่ห้องของคุณ" };

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: isActive ? "เปิดใช้งานการยกเว้นแล้ว" : "ปิดใช้งานการยกเว้นแล้ว" };
}

export async function approveLeave(id: number, note?: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const { wallClock: reviewedAt } = nowInBangkok();
  const reviewNote = normalizeReviewNote(note);

  const exemption = await prisma.studentExemption.findFirst({
    where: { id, requestedByStudent: 1, student: { classroomId: teacher.classroomId } },
    select: { id: true, studentId: true, reason: true, startDate: true, endDate: true },
  });
  if (!exemption) return { ok: false, message: "ไม่พบคำขอลาที่รออนุมัติในห้องของคุณ" };

  await prisma.studentExemption.update({
    where: { id: exemption.id },
    data: { status: "approved", reviewedBy: teacher.teacherId, reviewedAt, reviewNote },
  });
  await prisma.attendanceLog.create({
    data: {
      studentId: exemption.studentId,
      eventType: "settings_changed",
      detail: `ครู ${teacher.fullName} อนุมัติคำขอลา: ${exemption.reason} (${formatLeaveRange(exemption.startDate, exemption.endDate)})`,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}`);
  revalidatePath(`/classrooms/${teacher.classroomId}/exemptions`);
  revalidatePath(`/classrooms/${teacher.classroomId}/leave-requests`);
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "อนุมัติคำขอลาเรียบร้อยแล้ว" };
}

export async function rejectLeave(id: number, note?: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const { wallClock: reviewedAt } = nowInBangkok();
  const reviewNote = normalizeReviewNote(note);

  const exemption = await prisma.studentExemption.findFirst({
    where: { id, requestedByStudent: 1, student: { classroomId: teacher.classroomId } },
    select: { id: true, studentId: true, reason: true, startDate: true, endDate: true },
  });
  if (!exemption) return { ok: false, message: "ไม่พบคำขอลาที่รอพิจารณาในห้องของคุณ" };

  await prisma.studentExemption.update({
    where: { id: exemption.id },
    data: { status: "rejected", reviewedBy: teacher.teacherId, reviewedAt, reviewNote },
  });
  await prisma.attendanceLog.create({
    data: {
      studentId: exemption.studentId,
      eventType: "settings_changed",
      detail: `ครู ${teacher.fullName} ไม่อนุมัติคำขอลา: ${exemption.reason} (${formatLeaveRange(exemption.startDate, exemption.endDate)})`,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}`);
  revalidatePath(`/classrooms/${teacher.classroomId}/exemptions`);
  revalidatePath(`/classrooms/${teacher.classroomId}/leave-requests`);
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "ปฏิเสธคำขอลาเรียบร้อยแล้ว" };
}

export async function revertLeaveToPending(id: number): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const exemption = await prisma.studentExemption.findFirst({
    where: { id, requestedByStudent: 1, student: { classroomId: teacher.classroomId } },
    select: { id: true, studentId: true, reason: true, startDate: true, endDate: true },
  });
  if (!exemption) return { ok: false, message: "ไม่พบคำขอลาในห้องของคุณ" };

  await prisma.studentExemption.update({
    where: { id: exemption.id },
    data: { status: "pending", reviewedBy: null, reviewedAt: null, reviewNote: null },
  });
  await prisma.attendanceLog.create({
    data: {
      studentId: exemption.studentId,
      eventType: "settings_changed",
      detail: `ครู ${teacher.fullName} คืนคำขอลาเป็นสถานะรออนุมัติ: ${exemption.reason} (${formatLeaveRange(exemption.startDate, exemption.endDate)})`,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}`);
  revalidatePath(`/classrooms/${teacher.classroomId}/exemptions`);
  revalidatePath(`/classrooms/${teacher.classroomId}/leave-requests`);
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "คืนคำขอลาเป็นสถานะรออนุมัติแล้ว" };
}
