"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClassroomManager } from "@/lib/teacher";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
export type BulkImportResult =
  | { ok: true; added: number; skipped: { line: string; reason: string }[]; message: string }
  | { ok: false; message: string };

function normalizeStudentId(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/** New student: password defaults to their own student ID, forced to change it on first login (same convention as resetStudentPassword). */
export async function createStudent(input: {
  studentId: string;
  fullName: string;
  nickname: string;
  numberInClass: string;
  classroomId: number;
}): Promise<ActionResult> {
  const teacher = await requireClassroomManager(input.classroomId);

  const studentId = normalizeStudentId(input.studentId);
  const fullName = input.fullName.trim();
  if (!studentId) return { ok: false, message: "กรุณากรอกรหัสนักเรียน" };
  if (!fullName) return { ok: false, message: "กรุณากรอกชื่อ-นามสกุลนักเรียน" };

  const existing = await prisma.student.findUnique({ where: { studentId } });
  if (existing) {
    return {
      ok: false,
      message: existing.status === 1 ? "มีรหัสนักเรียนนี้อยู่ในระบบแล้ว" : "รหัสนักเรียนนี้เคยถูกลบไว้ในห้องเรียนอื่น/ห้องนี้ — ติดต่อผู้ดูแลระบบเพื่อกู้คืนแทนการสร้างใหม่",
    };
  }

  const numberInClass = input.numberInClass.trim() ? Number(input.numberInClass) : null;
  if (numberInClass !== null && (!Number.isInteger(numberInClass) || numberInClass < 1)) {
    return { ok: false, message: "เลขที่ในห้องต้องเป็นตัวเลขจำนวนเต็มบวก" };
  }

  const passwordHash = await bcrypt.hash(studentId, 10);
  await prisma.student.create({
    data: {
      studentId,
      fullName,
      nickname: input.nickname.trim() || null,
      numberInClass,
      classroomId: teacher.classroomId,
      passwordHash,
      mustChangePw: 1,
      status: 1,
    },
  });
  await prisma.attendanceLog.create({
    data: { studentId, eventType: "settings_changed", detail: `ครู ${teacher.fullName} เพิ่มนักเรียนใหม่: ${fullName} (${studentId})` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/students/manage`);
  return { ok: true, message: `เพิ่ม ${fullName} เข้าห้องเรียนเรียบร้อยแล้ว รหัสผ่านเริ่มต้นคือรหัสนักเรียน (${studentId})` };
}

export async function bulkImportStudents(text: string, classroomId: number): Promise<BulkImportResult> {
  let teacher;
  try {
    teacher = await requireClassroomManager(classroomId);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "ไม่สามารถยืนยันสิทธิ์ครูได้" };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { ok: false, message: "กรุณาวางข้อมูลนักเรียนก่อนนำเข้า" };

  const skipped: { line: string; reason: string }[] = [];
  const parsed: {
    line: string;
    studentId: string;
    fullName: string;
    nickname: string | null;
    numberInClass: number | null;
  }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const columns = line.split("\t");
    const rawNumberInClass = (columns[0] ?? "").trim();
    const studentId = normalizeStudentId(columns[1] ?? "");
    const fullName = (columns[2] ?? "").trim();
    const nickname = (columns[3] ?? "").trim() || null;

    if (!studentId || !fullName) {
      skipped.push({ line, reason: "ข้อมูลไม่ครบ" });
      continue;
    }

    const numberInClass = rawNumberInClass ? Number(rawNumberInClass) : null;
    if (numberInClass !== null && (!Number.isInteger(numberInClass) || numberInClass < 1)) {
      skipped.push({ line, reason: "เลขที่ไม่ถูกต้อง" });
      continue;
    }

    if (seen.has(studentId)) {
      skipped.push({ line, reason: "รหัสซ้ำในรายการที่วาง" });
      continue;
    }

    seen.add(studentId);
    parsed.push({ line, studentId, fullName, nickname, numberInClass });
  }

  if (parsed.length === 0) {
    return {
      ok: true,
      added: 0,
      skipped,
      message: `นำเข้าสำเร็จ 0 คน${skipped.length ? ` · ข้าม ${skipped.length} คน` : ""}`,
    };
  }

  const existing = await prisma.student.findMany({
    where: { studentId: { in: parsed.map((row) => row.studentId) } },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((student) => student.studentId));
  const valid = parsed.filter((row) => {
    if (!existingIds.has(row.studentId)) return true;
    skipped.push({ line: row.line, reason: "รหัสซ้ำในระบบ" });
    return false;
  });

  const rowsWithPassword = await Promise.all(
    valid.map(async (row) => ({
      ...row,
      passwordHash: await bcrypt.hash(row.studentId, 10),
    })),
  );

  await prisma.$transaction([
    ...rowsWithPassword.map((row) =>
      prisma.student.create({
        data: {
          studentId: row.studentId,
          fullName: row.fullName,
          nickname: row.nickname,
          numberInClass: row.numberInClass,
          classroomId: teacher.classroomId,
          passwordHash: row.passwordHash,
          mustChangePw: 1,
          status: 1,
        },
      }),
    ),
    prisma.attendanceLog.create({
      data: {
        studentId: null,
        eventType: "settings_changed",
        detail: `ครู ${teacher.fullName} นำเข้านักเรียน ${rowsWithPassword.length} คน`,
      },
    }),
  ]);

  revalidatePath(`/classrooms/${teacher.classroomId}/students/manage`);
  return {
    ok: true,
    added: rowsWithPassword.length,
    skipped,
    message: `นำเข้าสำเร็จ ${rowsWithPassword.length} คน${skipped.length ? ` · ข้าม ${skipped.length} คน` : ""}`,
  };
}

export async function updateStudent(
  studentId: string,
  input: { fullName: string; nickname: string; numberInClass: string; classroomId: number },
): Promise<ActionResult> {
  const teacher = await requireClassroomManager(input.classroomId);

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== teacher.classroomId || student.status !== 1) {
    return { ok: false, message: "ไม่พบข้อมูลนักเรียนในห้องเรียนที่คุณดูแล" };
  }

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, message: "กรุณากรอกชื่อ-นามสกุลนักเรียน" };

  const numberInClass = input.numberInClass.trim() ? Number(input.numberInClass) : null;
  if (numberInClass !== null && (!Number.isInteger(numberInClass) || numberInClass < 1)) {
    return { ok: false, message: "เลขที่ในห้องต้องเป็นตัวเลขจำนวนเต็มบวก" };
  }

  await prisma.student.update({
    where: { studentId },
    data: { fullName, nickname: input.nickname.trim() || null, numberInClass },
  });
  await prisma.attendanceLog.create({
    data: { studentId, eventType: "settings_changed", detail: `ครู ${teacher.fullName} แก้ไขข้อมูลส่วนตัวของนักเรียน ${fullName} (${studentId})` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/students/manage`);
  return { ok: true, message: `บันทึกข้อมูลของ ${fullName} เรียบร้อยแล้ว` };
}

export async function renumberStudents(classroomId: number): Promise<ActionResult> {
  const teacher = await requireClassroomManager(classroomId);

  const students = await prisma.student.findMany({
    where: { classroomId: teacher.classroomId, status: 1 },
    orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
  });
  const ordered = students.slice().sort((a, b) => {
    if (a.numberInClass === null && b.numberInClass !== null) return 1;
    if (a.numberInClass !== null && b.numberInClass === null) return -1;
    if (a.numberInClass !== b.numberInClass) return (a.numberInClass ?? 0) - (b.numberInClass ?? 0);
    return a.studentId.localeCompare(b.studentId);
  });

  const updates = ordered.flatMap((student, index) => {
    const nextNumber = index + 1;
    if (student.numberInClass === nextNumber) return [];
    return [
      prisma.student.update({
        where: { studentId: student.studentId },
        data: { numberInClass: nextNumber },
      }),
    ];
  });
  await prisma.$transaction([
    ...updates,
    prisma.attendanceLog.create({
      data: {
        studentId: null,
        eventType: "settings_changed",
        detail: `ครู ${teacher.fullName} จัดเรียงเลขที่นักเรียนใหม่ (${ordered.length} คน)`,
      },
    }),
  ]);

  revalidatePath(`/classrooms/${teacher.classroomId}/students/manage`);
  return { ok: true, message: `จัดเรียงเลขที่ใหม่เรียบร้อยแล้ว (${ordered.length} คน)` };
}

/** Soft delete: flips status to 0. FK relations to attendance history use onDelete:Restrict, so a hard delete is intentionally not exposed here — it would fail (or need a separate irreversible admin-only path) once a student has any attendance record. */
export async function deactivateStudent(studentId: string, classroomId: number): Promise<ActionResult> {
  const teacher = await requireClassroomManager(classroomId);

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== teacher.classroomId || student.status !== 1) {
    return { ok: false, message: "ไม่พบข้อมูลนักเรียนในห้องเรียนที่คุณดูแล" };
  }

  await prisma.student.update({ where: { studentId }, data: { status: 0 } });
  await prisma.attendanceLog.create({
    data: { studentId, eventType: "settings_changed", detail: `ครู ${teacher.fullName} ลบนักเรียน ${student.fullName} (${studentId}) ออกจากห้องเรียน` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/students/manage`);
  return { ok: true, message: `ลบ ${student.fullName} ออกจากห้องเรียนเรียบร้อยแล้ว` };
}
