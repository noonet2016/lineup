import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/teacher";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import EditStatusForm from "./EditStatusForm";
import { LightboxProvider, LightboxThumb } from "@/app/_components/ImageLightbox";
import { studentAvatarUrl } from "@/lib/studentPhoto";

export const dynamic = "force-dynamic";

export default async function EditStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; studentId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id, studentId } = await params;
  const { filter: returnFilter } = await searchParams;
  const backHref = returnFilter ? `/classrooms/${id}?filter=${encodeURIComponent(returnFilter)}` : `/classrooms/${id}`;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}/students/${studentId}`);

  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } });
  const admin = await isAdmin();
  if (!classroom || (!admin && classroom.advisorId !== Number(session.id))) {
    redirect(`/classrooms/${classroomId}/students/${studentId}`);
  }

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.classroomId !== classroomId || student.status !== 1) notFound();
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()));
  const todaySession = await prisma.attendanceSession.findUnique({ where: { sessionDate_classroomId: { sessionDate: today, classroomId } } });
  const record = todaySession
    ? await prisma.attendanceRecord.findUnique({ where: { sessionId_studentId: { sessionId: todaySession.id, studentId } } })
    : null;

  const photoUrl = studentAvatarUrl(student.studentId, student.linePictureUrl);

  return (
    <TeacherShell active="dashboard" fullName={classroom.advisor?.fullName ?? ""} roomName={classroom.roomName} classroomId={classroomId} adminBack={admin}>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div>
          <a href={backHref} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            &larr; กลับหน้าแดชบอร์ดสรุปผล
          </a>
          <h1 className="text-3xl font-extrabold text-white mt-3">แก้ไขสถานะการเข้าแถวรายคน</h1>
          <LightboxProvider>
            <div className="mt-4 flex items-center gap-4">
              {photoUrl ? (
                <LightboxThumb
                  src={photoUrl}
                  alt={student.fullName}
                  caption={`${student.numberInClass ?? "-"}. ${student.fullName}${student.nickname ? ` (${student.nickname})` : ""}`}
                  className="w-20 h-20 border-2 border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 shrink-0 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300" aria-hidden="true">
                  {student.fullName.replace(/^(นางสาว|นาง|นาย|เด็กหญิง|เด็กชาย)\s*/, "").charAt(0) || "?"}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-lg font-bold text-white">{student.fullName}</div>
                <div className="text-sm text-slate-400">
                  เลขที่ {student.numberInClass ?? "-"} · รหัส {student.studentId}
                  {student.nickname ? ` · ชื่อเล่น ${student.nickname}` : ""}
                </div>
              </div>
            </div>
          </LightboxProvider>
        </div>
        <EditStatusForm studentId={student.studentId} classroomId={classroomId} currentStatus={record?.status ?? "absent"} returnFilter={returnFilter} />
      </main>
    </TeacherShell>
  );
}
