import { prisma } from "./prisma";
import { getSession, requireSession } from "./session";

export type TeacherContext = { teacherId: number; classroomId: number; fullName: string };
type AdminContext = Omit<TeacherContext, "classroomId">;

/** The admin is the system manager allowed to edit school-wide settings: assembly times, holidays, dome/alert radius. Marked by Teacher.role = "admin". */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await requireSession();
  if (session.role !== "teacher") throw new Error("เฉพาะครูเท่านั้น");

  const teacher = await prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { id: true, fullName: true, role: true } });
  if (teacher?.role !== "admin") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขการตั้งค่าส่วนกลางได้");
  }
  return { teacherId: teacher.id, fullName: teacher.fullName };
}

/** Read-only check for UI gating — true if the current session is the admin teacher. */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session || session.role !== "teacher") return false;
  const teacher = await prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { role: true } });
  return teacher?.role === "admin";
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

/** Allows the classroom advisor or the system admin to manage one target classroom. */
export async function requireClassroomManager(classroomId: number): Promise<TeacherContext> {
  const session = await requireSession();
  if (session.role !== "teacher") throw new Error("เฉพาะครูเท่านั้น");

  const [teacher, classroom] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { id: true, fullName: true, role: true } }),
    prisma.classroom.findUnique({ where: { id: classroomId }, select: { advisorId: true, roomName: true } }),
  ]);
  if (!teacher) throw new Error("ไม่พบบัญชีครู");
  if (!classroom) throw new Error("ไม่พบห้องเรียน");

  if (teacher.role !== "admin" && classroom.advisorId !== teacher.id) {
    throw new Error("คุณไม่มีสิทธิ์จัดการห้องเรียนนี้");
  }

  return { teacherId: teacher.id, classroomId, fullName: teacher.fullName };
}
