import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isOwner } from "@/lib/teacher";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import ManageStudentsClient from "./ManageStudentsClient";

export const dynamic = "force-dynamic";

export default async function ManageStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}`);

  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } });
  if (!classroom) redirect(`/classrooms/${classroomId}`);
  const canManage = classroom.advisorId === Number(session.id) || (await isOwner());
  if (!canManage) redirect(`/classrooms/${classroomId}`);

  const students = await prisma.student.findMany({
    where: { classroomId, status: 1 },
    orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
    select: { studentId: true, fullName: true, nickname: true, numberInClass: true },
  });

  return (
    <TeacherShell active="dashboard" fullName={classroom.advisor?.fullName ?? ""} roomName={classroom.roomName} classroomId={classroomId}>
      <main className="max-w-3xl mx-auto safe-px py-8 space-y-6">
        <div>
          <a href={`/classrooms/${classroomId}`} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            &larr; กลับหน้าแดชบอร์ดสรุปผล
          </a>
          <h1 className="text-2xl font-extrabold text-white mt-2">จัดการรายชื่อนักเรียน ห้อง ม.{classroom.roomName}</h1>
        </div>
        <ManageStudentsClient classroomId={classroomId} students={students} />
      </main>
    </TeacherShell>
  );
}
