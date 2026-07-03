"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatDateInput, nowInBangkok } from "@/lib/time";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function formatLeaveRange(startDate: Date, endDate: Date): string {
  const start = formatDateInput(startDate);
  const end = formatDateInput(endDate);
  return start === end ? start : `${start} ถึง ${end}`;
}

export async function requestLeave(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const reason = String(formData.get("reason") ?? "").trim();
  const mode = String(formData.get("mode") ?? "single").trim();
  if (!reason) return { ok: false, message: "กรุณาระบุเหตุผลการลา" };
  if (reason.length > 100) return { ok: false, message: "เหตุผลต้องไม่เกิน 100 ตัวอักษร" };
  if (mode !== "single" && mode !== "range") return { ok: false, message: "รูปแบบวันที่ไม่ถูกต้อง" };

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (mode === "single") {
    const date = parseDateInput(String(formData.get("date") ?? "").trim());
    if (!date) return { ok: false, message: "วันที่ลาไม่ถูกต้อง" };
    startDate = date;
    endDate = date;
  } else {
    startDate = parseDateInput(String(formData.get("startDate") ?? "").trim());
    endDate = parseDateInput(String(formData.get("endDate") ?? "").trim());
    if (!startDate || !endDate) return { ok: false, message: "ช่วงวันที่ลาไม่ถูกต้อง" };
    if (startDate > endDate) return { ok: false, message: "วันเริ่มต้นต้องไม่เกินวันสิ้นสุด" };
  }

  const { dateOnly: today } = nowInBangkok();
  if (startDate < today) return { ok: false, message: "ยื่นคำขอลาย้อนหลังไม่ได้" };

  const student = await prisma.student.findUnique({
    where: { studentId: session.id },
    select: { studentId: true, classroomId: true },
  });
  if (!student) return { ok: false, message: "ไม่พบบัญชีนักเรียน" };

  const overlapping = await prisma.studentExemption.findFirst({
    where: {
      studentId: student.studentId,
      status: { in: ["pending", "approved"] },
      isActive: 1,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, status: true },
  });
  if (overlapping) {
    return {
      ok: false,
      message:
        overlapping.status === "approved"
          ? "ช่วงวันที่นี้คุณได้รับอนุมัติลาไปแล้ว"
          : "มีคำขอลาที่รออนุมัติทับซ้อนช่วงวันที่นี้อยู่แล้ว",
    };
  }

  await prisma.studentExemption.create({
    data: {
      studentId: student.studentId,
      reason,
      weekday: null,
      startDate,
      endDate,
      requestedByStudent: 1,
      status: "pending",
      createdBy: null,
      isActive: 1,
    },
  });

  await prisma.attendanceLog.create({
    data: {
      studentId: student.studentId,
      eventType: "settings_changed",
      detail: `นักเรียนยื่นขอลา: ${reason} (${formatLeaveRange(startDate, endDate)})`,
    },
  });

  revalidatePath(`/classrooms/${student.classroomId}`);
  return { ok: true, message: "ส่งคำขอลาเรียบร้อยแล้ว รอครูอนุมัติ" };
}

export async function cancelMyLeave(id: number): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const exemption = await prisma.studentExemption.findFirst({
    where: { id, studentId: session.id, status: "pending" },
    select: { id: true, studentId: true, reason: true, startDate: true, endDate: true, student: { select: { classroomId: true } } },
  });
  if (!exemption) return { ok: false, message: "ไม่พบคำขอลาที่รอยกเลิก หรือคำขอนี้ถูกพิจารณาแล้ว" };

  await prisma.studentExemption.delete({ where: { id: exemption.id } });
  await prisma.attendanceLog.create({
    data: {
      studentId: exemption.studentId,
      eventType: "settings_changed",
      detail: `นักเรียนยกเลิกคำขอลา: ${exemption.reason} (${formatLeaveRange(exemption.startDate!, exemption.endDate!)})`,
    },
  });

  revalidatePath(`/classrooms/${exemption.student.classroomId}`);
  return { ok: true, message: "ยกเลิกคำขอลาเรียบร้อยแล้ว" };
}

export async function getMyLeaveRequests() {
  const session = await requireSession();
  if (session.role !== "student") throw new Error("เฉพาะนักเรียนเท่านั้น");

  return prisma.studentExemption.findMany({
    where: { studentId: session.id, requestedByStudent: 1 },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      startDate: true,
      endDate: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
  });
}
