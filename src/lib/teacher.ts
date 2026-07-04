import { prisma } from "./prisma";
import { getSession, requireSession } from "./session";

export type TeacherContext = { teacherId: number; classroomId: number; fullName: string };

/** The "owner" is the one teacher (school admin) allowed to edit school-wide settings: assembly times, holidays, dome/alert radius. Marked by Teacher.role = "owner". */
export async function requireOwner(): Promise<TeacherContext> {
  const ctx = await requireTeacherClassroom();
  const teacher = await prisma.teacher.findUnique({ where: { id: ctx.teacherId }, select: { role: true } });
  if (teacher?.role !== "owner") {
    throw new Error("เฉพาะเจ้าของระบบเท่านั้นที่แก้ไขการตั้งค่าส่วนกลางได้");
  }
  return ctx;
}

/** Read-only check for UI gating — true if the current session is the owner teacher. */
export async function isOwner(): Promise<boolean> {
  const session = await getSession();
  if (!session || session.role !== "teacher") return false;
  const teacher = await prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { role: true } });
  return teacher?.role === "owner";
}

/** Every teacher page/action in this app is scoped to the single classroom they advise (matches legacy: one teacher = one homeroom). */
export async function requireTeacherClassroom(): Promise<TeacherContext> {
  const session = await requireSession();
  if (session.role !== "teacher") throw new Error("เฉพาะครูเท่านั้น");

  const teacher = await prisma.teacher.findUnique({ where: { id: Number(session.id) } });
  if (!teacher) throw new Error("ไม่พบบัญชีครู");

  const classroom = await prisma.classroom.findFirst({ where: { advisorId: teacher.id } });
  if (!classroom) throw new Error("คุณไม่มีห้องเรียนที่ปรึกษาที่ดูแลอยู่ จึงไม่สามารถเข้าหน้านี้ได้");

  return { teacherId: teacher.id, classroomId: classroom.id, fullName: teacher.fullName };
}
