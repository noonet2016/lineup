import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDateInput, formatWallClockDate, parseDateInput, todayInBangkok } from "@/lib/time";
import { loadReportSummary, loadStudentReport } from "@/lib/report";
import ReportClient from "./ReportClient";
import StudentReportClient from "./StudentReportClient";

export const dynamic = "force-dynamic";

export default async function ClassroomReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start_date?: string; end_date?: string; error?: string; view?: string }>;
}) {
  const { id } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) redirect("/classrooms");

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}`);

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { advisor: { select: { fullName: true } } },
  });
  if (!classroom || classroom.advisorId !== Number(session.id)) redirect(`/classrooms/${classroomId}`);

  const { start_date, end_date, error, view } = await searchParams;
  const today = todayInBangkok();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const startDate = (start_date && parseDateInput(start_date)) || monthStart;
  const endDate = (end_date && parseDateInput(end_date)) || today;

  if (view === "student") {
    const rows = await loadStudentReport(classroomId, startDate, endDate);
    return (
      <StudentReportClient
        classroomId={classroomId}
        roomName={classroom.roomName}
        fullName={classroom.advisor?.fullName ?? ""}
        startDate={formatDateInput(startDate)}
        endDate={formatDateInput(endDate)}
        errorMessage={error ?? null}
        rows={rows.map((row) => ({
          ...row,
          days: row.days.map((day) => ({
            ...day,
            sessionDate: formatDateInput(day.sessionDate),
            sessionDateLabel: formatWallClockDate(day.sessionDate),
          })),
        }))}
      />
    );
  }

  const reportRows = await loadReportSummary(classroomId, startDate, endDate);

  return (
    <ReportClient
      classroomId={classroomId}
      roomName={classroom.roomName}
      fullName={classroom.advisor?.fullName ?? ""}
      startDate={formatDateInput(startDate)}
      endDate={formatDateInput(endDate)}
      errorMessage={error ?? null}
      rows={reportRows.map((r) => ({
        sessionId: r.sessionId,
        sessionDate: formatDateInput(r.sessionDate),
        sessionDateLabel: formatWallClockDate(r.sessionDate),
        present: r.present,
        late: r.late,
        absent: r.absent,
        excused: r.excused,
        pending: r.pending,
        flagged: r.flagged,
        totalStudents: r.totalStudents,
      }))}
    />
  );
}
