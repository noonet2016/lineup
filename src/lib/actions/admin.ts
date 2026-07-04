"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/teacher";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Owner-only: create a new advisor teacher account + their homeroom classroom in one step. */
export async function createTeacherWithClassroom(formData: FormData): Promise<ActionResult> {
  await requireOwner();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roomName = String(formData.get("room_name") ?? "").trim();

  if (!fullName) return { ok: false, message: "กรุณาระบุชื่อ-นามสกุลครู" };
  if (!/^[a-zA-Z0-9_.]{3,}$/.test(username)) {
    return { ok: false, message: "username ต้องเป็นภาษาอังกฤษ/ตัวเลข/._ อย่างน้อย 3 ตัวอักษร" };
  }
  if (password.length < 6) return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };
  if (!roomName) return { ok: false, message: "กรุณาระบุชื่อห้อง เช่น 5/7" };

  const existing = await prisma.teacher.findUnique({ where: { username } });
  if (existing) return { ok: false, message: `username "${username}" ถูกใช้ไปแล้ว` };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.create({
      data: { username, passwordHash, fullName, role: "advisor" },
    });
    await tx.classroom.create({ data: { roomName, advisorId: teacher.id } });
  });

  revalidatePath("/admin");
  return { ok: true, message: `เพิ่มครู "${fullName}" (ห้อง ม.${roomName}) เรียบร้อยแล้ว` };
}

/** Owner-only: edit a teacher's name/username and their homeroom's room name. */
export async function updateTeacher(teacherId: number, formData: FormData): Promise<ActionResult> {
  await requireOwner();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const roomName = String(formData.get("room_name") ?? "").trim();

  if (!fullName) return { ok: false, message: "กรุณาระบุชื่อ-นามสกุลครู" };
  if (!/^[a-zA-Z0-9_.]{3,}$/.test(username)) {
    return { ok: false, message: "username ต้องเป็นภาษาอังกฤษ/ตัวเลข/._ อย่างน้อย 3 ตัวอักษร" };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { advisedClassrooms: { orderBy: { id: "asc" }, take: 1, select: { id: true } } },
  });
  if (!teacher) return { ok: false, message: "ไม่พบบัญชีครู" };

  const dup = await prisma.teacher.findUnique({ where: { username } });
  if (dup && dup.id !== teacherId) return { ok: false, message: `username "${username}" ถูกใช้ไปแล้ว` };

  await prisma.$transaction(async (tx) => {
    await tx.teacher.update({ where: { id: teacherId }, data: { fullName, username } });
    const room = teacher.advisedClassrooms[0];
    if (room && roomName) await tx.classroom.update({ where: { id: room.id }, data: { roomName } });
  });

  revalidatePath("/admin");
  return { ok: true, message: `แก้ไขข้อมูลครู "${fullName}" เรียบร้อยแล้ว` };
}

/** Owner-only: delete a teacher and their (empty) homeroom. Refuses if any room still has students or attendance history, to protect data. */
export async function deleteTeacher(teacherId: number): Promise<ActionResult> {
  const owner = await requireOwner();
  if (teacherId === owner.teacherId) return { ok: false, message: "ลบบัญชีเจ้าของระบบไม่ได้" };

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      advisedClassrooms: { select: { id: true, _count: { select: { students: true, sessions: true } } } },
    },
  });
  if (!teacher) return { ok: false, message: "ไม่พบบัญชีครู" };
  if (teacher.role === "owner") return { ok: false, message: "ลบบัญชีเจ้าของระบบไม่ได้" };

  const blocked = teacher.advisedClassrooms.some((c) => c._count.students > 0 || c._count.sessions > 0);
  if (blocked) {
    return {
      ok: false,
      message: "ห้องของครูคนนี้มีนักเรียนหรือประวัติการเช็คชื่อแล้ว จึงลบไม่ได้ (กันข้อมูลหาย) — หากต้องการระงับ ให้เปลี่ยนรหัสผ่านแทน",
    };
  }

  const roomIds = teacher.advisedClassrooms.map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    if (roomIds.length) await tx.classroom.deleteMany({ where: { id: { in: roomIds } } });
    await tx.teacher.delete({ where: { id: teacherId } });
  });

  revalidatePath("/admin");
  return { ok: true, message: `ลบบัญชีครู "${teacher.fullName}" เรียบร้อยแล้ว` };
}

/** Owner-only: reset a teacher's login password. */
export async function resetTeacherPassword(teacherId: number, newPassword: string): Promise<ActionResult> {
  const owner = await requireOwner();
  if (teacherId === owner.teacherId) {
    return { ok: false, message: "รหัสผ่านของเจ้าของระบบ เปลี่ยนได้ที่แท็บบัญชี" };
  }
  if (newPassword.length < 6) return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) return { ok: false, message: "ไม่พบบัญชีครู" };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.teacher.update({ where: { id: teacherId }, data: { passwordHash } });

  revalidatePath("/admin");
  return { ok: true, message: `รีเซ็ตรหัสผ่านครู "${teacher.fullName}" เรียบร้อยแล้ว` };
}
