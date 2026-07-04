import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { TeacherShell } from "../_components/LegacyChrome";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect("/checkin");

  const me = await prisma.teacher.findUnique({
    where: { id: Number(session.id) },
    select: { id: true, fullName: true, role: true, advisedClassrooms: { select: { id: true, roomName: true }, orderBy: { id: "asc" } } },
  });
  if (!me || me.role !== "owner") {
    const own = await prisma.classroom.findFirst({ where: { advisorId: Number(session.id) }, select: { id: true } });
    redirect(own ? `/classrooms/${own.id}` : "/account");
  }

  const myClassroom = me.advisedClassrooms[0];

  const teachers = await prisma.teacher.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      advisedClassrooms: {
        select: { id: true, roomName: true, _count: { select: { students: true, sessions: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  return (
    <TeacherShell
      active="settings"
      fullName={me.fullName}
      roomName={myClassroom?.roomName ?? ""}
      classroomId={myClassroom?.id ?? 0}
    >
      <AdminClient
        ownerId={me.id}
        teachers={teachers.map((t) => ({
          id: t.id,
          username: t.username,
          fullName: t.fullName,
          role: t.role,
          rooms: t.advisedClassrooms.map((c) => c.roomName),
          studentCount: t.advisedClassrooms.reduce((n, c) => n + c._count.students, 0),
          sessionCount: t.advisedClassrooms.reduce((n, c) => n + c._count.sessions, 0),
        }))}
      />
    </TeacherShell>
  );
}
