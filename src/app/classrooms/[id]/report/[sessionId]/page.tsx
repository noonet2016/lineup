import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDateInput, formatWallClockDate, formatWallClockTime } from "@/lib/time";
import { loadReportDay } from "@/lib/report";
import ReportDayClient from "./ReportDayClient";

export const dynamic = "force-dynamic";

export default async function ClassroomReportDayPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId: sessionIdRaw } = await params;
  const classroomId = Number(id);
  const sessionId = Number(sessionIdRaw);
  if (!Number.isInteger(classroomId) || !Number.isInteger(sessionId)) redirect("/classrooms");

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}`);

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { advisor: { select: { fullName: true } } },
  });
  if (!classroom || classroom.advisorId !== Number(session.id)) redirect(`/classrooms/${classroomId}`);

  const data = await loadReportDay(classroomId, sessionId);
  if (!data) redirect(`/classrooms/${classroomId}/report?error=${encodeURIComponent("ไม่พบรอบนี้ หรือไม่ใช่ห้องเรียนที่คุณดูแล")}`);

  const dateStr = formatDateInput(data.session.sessionDate);

  return (
    <ReportDayClient
      classroomId={classroomId}
      roomName={classroom.roomName}
      fullName={classroom.advisor?.fullName ?? ""}
      sessionDateLabel={formatWallClockDate(data.session.sessionDate)}
      timeRangeLabel={`${formatWallClockTime(data.session.startTime)}–${formatWallClockTime(data.session.endTime)}`}
      exportHref={`/api/classrooms/${classroomId}/report/export?start_date=${dateStr}&end_date=${dateStr}`}
      stats={data.stats}
      students={data.students.map((s) => ({
        studentId: s.studentId,
        fullName: s.fullName,
        nickname: s.nickname,
        numberInClass: s.numberInClass,
        displayStatus: s.displayStatus,
        checkTimeLabel: formatWallClockTime(s.checkTime, true),
        distanceM: s.distanceM,
        isSuspicious: s.isSuspicious,
        editReason: s.editReason,
        editorName: s.editorName,
        exemptReason: s.exemptReason,
        scanFailBadge: s.scanFailBadge,
      }))}
    />
  );
}
