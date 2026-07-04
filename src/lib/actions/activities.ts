"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClassroomManager, requireOwner } from "@/lib/teacher";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
export type ActivityColor = "fuchsia" | "amber" | "lime" | "sky" | "violet" | "rose" | "slate";
export type ActivityTag = { name: string; color: string };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeColor(color: string): ActivityColor {
  return ["fuchsia", "amber", "lime", "sky", "violet", "rose", "slate"].includes(color) ? (color as ActivityColor) : "slate";
}

function normalizeIds(values: (string | number)[]): number[] {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

export async function createActivity(name: string, color: string): Promise<ActionResult> {
  await requireOwner();

  const normalizedName = normalizeName(name);
  const normalizedColor = normalizeColor(color);
  if (!normalizedName) return { ok: false, message: "กรุณาระบุชื่อกิจกรรม" };

  try {
    await prisma.schoolActivity.create({ data: { name: normalizedName, color: normalizedColor } });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return { ok: false, message: `มีกิจกรรมชื่อ "${normalizedName}" อยู่แล้ว` };
    }
    throw error;
  }

  revalidatePath("/admin");
  return { ok: true, message: `เพิ่มกิจกรรม "${normalizedName}" เรียบร้อยแล้ว` };
}

export async function updateActivity(id: number, name: string, color: string, isActive: boolean): Promise<ActionResult> {
  await requireOwner();

  const normalizedName = normalizeName(name);
  const normalizedColor = normalizeColor(color);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "ไม่พบกิจกรรม" };
  if (!normalizedName) return { ok: false, message: "กรุณาระบุชื่อกิจกรรม" };

  try {
    await prisma.schoolActivity.update({
      where: { id },
      data: { name: normalizedName, color: normalizedColor, isActive: isActive ? 1 : 0 },
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return { ok: false, message: `มีกิจกรรมชื่อ "${normalizedName}" อยู่แล้ว` };
    }
    throw error;
  }

  revalidatePath("/admin");
  return { ok: true, message: `บันทึกกิจกรรม "${normalizedName}" เรียบร้อยแล้ว` };
}

export async function deleteActivity(id: number): Promise<ActionResult> {
  await requireOwner();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "ไม่พบกิจกรรม" };

  const activity = await prisma.schoolActivity.findUnique({ where: { id }, select: { name: true } });
  if (!activity) return { ok: false, message: "ไม่พบกิจกรรม" };

  await prisma.schoolActivity.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/classrooms");
  return { ok: true, message: `ลบกิจกรรม "${activity.name}" เรียบร้อยแล้ว` };
}

export async function assignActivityMembers(activityId: number, studentIds: string[]): Promise<ActionResult> {
  await requireOwner();
  if (!Number.isInteger(activityId) || activityId <= 0) return { ok: false, message: "ไม่พบกิจกรรม" };

  const normalizedStudentIds = [...new Set(studentIds.map((id) => String(id).trim()).filter(Boolean))];
  const activity = await prisma.schoolActivity.findUnique({ where: { id: activityId }, select: { name: true } });
  if (!activity) return { ok: false, message: "ไม่พบกิจกรรม" };

  const existing = await prisma.studentActivity.findMany({
    where: { activityId },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((row) => row.studentId));
  const nextIds = new Set(normalizedStudentIds);

  const toDelete = [...existingIds].filter((studentId) => !nextIds.has(studentId));
  const toCreate = [...nextIds].filter((studentId) => !existingIds.has(studentId));

  const ops = [
    ...(toDelete.length ? [prisma.studentActivity.deleteMany({ where: { activityId, studentId: { in: toDelete } } })] : []),
    ...(toCreate.length
      ? [
          prisma.studentActivity.createMany({
            data: toCreate.map((studentId) => ({ studentId, activityId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ];
  if (ops.length) await prisma.$transaction(ops);

  revalidatePath("/admin");
  return { ok: true, message: `อัปเดตสมาชิกกิจกรรม "${activity.name}" เรียบร้อยแล้ว` };
}

export async function setStudentActivities(studentId: string, activityIds: number[]): Promise<ActionResult> {
  const student = await prisma.student.findUnique({
    where: { studentId },
    select: { studentId: true, fullName: true, classroomId: true, status: true },
  });
  if (!student || student.status !== 1) return { ok: false, message: "ไม่พบนักเรียนคนนี้" };

  await requireClassroomManager(student.classroomId);

  const normalizedActivityIds = normalizeIds(activityIds);
  const existing = await prisma.studentActivity.findMany({
    where: { studentId },
    select: { activityId: true },
  });
  const existingIds = new Set(existing.map((row) => row.activityId));
  const nextIds = new Set(normalizedActivityIds);

  const toDelete = [...existingIds].filter((activityId) => !nextIds.has(activityId));
  const toCreate = [...nextIds].filter((activityId) => !existingIds.has(activityId));

  const ops = [
    ...(toDelete.length ? [prisma.studentActivity.deleteMany({ where: { studentId, activityId: { in: toDelete } } })] : []),
    ...(toCreate.length
      ? [
          prisma.studentActivity.createMany({
            data: toCreate.map((activityId) => ({ studentId, activityId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ];
  if (ops.length) await prisma.$transaction(ops);

  revalidatePath(`/classrooms/${student.classroomId}/students/manage`);
  revalidatePath(`/classrooms/${student.classroomId}/report`);
  revalidatePath(`/classrooms/${student.classroomId}`);
  return { ok: true, message: `อัปเดตกิจกรรมของ ${student.fullName} เรียบร้อยแล้ว` };
}

/**
 * Advisor-or-owner: set who is in ONE activity, scoped to ONE classroom's active students only.
 * Add/remove is limited to this room — members from other classrooms are never touched, and any
 * studentId not belonging to this room is ignored (defence against tampered input).
 */
export async function setActivityMembersInClassroom(
  activityId: number,
  classroomId: number,
  studentIds: string[],
): Promise<ActionResult> {
  await requireClassroomManager(classroomId);

  const activity = await prisma.schoolActivity.findUnique({ where: { id: activityId }, select: { id: true, name: true } });
  if (!activity) return { ok: false, message: "ไม่พบกิจกรรมนี้" };

  const roomStudents = await prisma.student.findMany({ where: { classroomId, status: 1 }, select: { studentId: true } });
  const roomIds = new Set(roomStudents.map((s) => s.studentId));
  const wanted = new Set(studentIds.filter((id) => roomIds.has(id)));

  const existing = await prisma.studentActivity.findMany({
    where: { activityId, studentId: { in: [...roomIds] } },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((row) => row.studentId));

  const toCreate = [...wanted].filter((id) => !existingIds.has(id));
  const toDelete = [...existingIds].filter((id) => !wanted.has(id));

  const ops = [
    ...(toDelete.length ? [prisma.studentActivity.deleteMany({ where: { activityId, studentId: { in: toDelete } } })] : []),
    ...(toCreate.length
      ? [prisma.studentActivity.createMany({ data: toCreate.map((studentId) => ({ studentId, activityId })), skipDuplicates: true })]
      : []),
  ];
  if (ops.length) await prisma.$transaction(ops);

  revalidatePath(`/classrooms/${classroomId}/activities`);
  revalidatePath(`/classrooms/${classroomId}/students/manage`);
  revalidatePath(`/classrooms/${classroomId}/report`);
  revalidatePath(`/classrooms/${classroomId}`);
  return { ok: true, message: `อัปเดตสมาชิกกิจกรรม ${activity.name} เรียบร้อยแล้ว` };
}

export async function getActivityTagMap(classroomId: number): Promise<Map<string, ActivityTag[]>> {
  const rows = await prisma.studentActivity.findMany({
    where: { student: { classroomId, status: 1 } },
    orderBy: [{ studentId: "asc" }, { activityId: "asc" }],
    select: {
      studentId: true,
      activity: { select: { name: true, color: true } },
    },
  });

  const map = new Map<string, ActivityTag[]>();
  for (const row of rows) {
    const list = map.get(row.studentId) ?? [];
    list.push({ name: row.activity.name, color: row.activity.color });
    map.set(row.studentId, list);
  }
  return map;
}
