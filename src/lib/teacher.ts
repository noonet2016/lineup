import { prisma } from "./prisma";
import { requireSession } from "./session";

export type TeacherContext = { teacherId: number; classroomId: number; fullName: string };

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
