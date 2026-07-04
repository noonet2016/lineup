import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import EditStatusForm from "./EditStatusForm";

export const dynamic = "force-dynamic";

export default async function EditStatusPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}/students/${studentId}`);

  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } });
  if (!classroom || classroom.advisorId !== Number(session.id)) {
    redirect(`/classrooms/${classroomId}/students/${studentId}`);
  }

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== classroomId || student.status !== 1) notFound();
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()));
  const todaySession = await prisma.attendanceSession.findUnique({ where: { sessionDate_classroomId: { sessionDate: today, classroomId } } });
  const record = todaySession
    ? await prisma.attendanceRecord.findUnique({ where: { sessionId_studentId: { sessionId: todaySession.id, studentId } } })
    : null;

  return (
    <TeacherShell active="dashboard" fullName={classroom.advisor?.fullName ?? ""} roomName={classroom.roomName} classroomId={classroomId}>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div>
          <a href={`/classrooms/${classroomId}`} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            &larr; กลับหน้าแดชบอร์ดสรุปผล
          </a>
          <h1 className="text-3xl font-extrabold text-white mt-3">แก้ไขสถานะการเข้าแถวรายคน</h1>
          <p className="text-sm text-slate-400 mt-1">
            นักเรียน: {student.fullName} (เลขที่ {student.numberInClass ?? "-"})
          </p>
        </div>
        <EditStatusForm studentId={student.studentId} classroomId={classroomId} currentStatus={record?.status ?? "absent"} />
      </main>
    </TeacherShell>
  );
}
