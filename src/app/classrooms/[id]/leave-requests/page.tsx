import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PollRefresh from "@/app/_components/PollRefresh";
import { formatWallClockTime } from "@/lib/time";
import LeaveRequestsClient from "./LeaveRequestsClient";

// Short Thai date "dd/mm/พ.ศ." from a wall-clock-carried Date (UTC fields, no TZ shift).
function thaiShortDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const be = date.getUTCFullYear() + 543;
  return `${dd}/${mm}/${be}`;
}

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function ClassroomLeaveRequestsPage({ params }: { params: Promise<Params> }) {
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

  const requests = await prisma.studentExemption.findMany({
    where: { requestedByStudent: 1, student: { classroomId } },
    select: {
      id: true,
      reason: true,
      startDate: true,
      endDate: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      student: {
        select: {
          studentId: true,
          fullName: true,
          nickname: true,
          numberInClass: true,
        },
      },
    },
  });

  const statusWeight: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
  const sortedRequests = [...requests].sort((a, b) => {
    const statusDiff = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <>
      <PollRefresh />
      <LeaveRequestsClient
        classroomId={classroomId}
        roomName={classroom.roomName}
        fullName={classroom.advisor?.fullName ?? ""}
        requests={sortedRequests.map((request) => ({
          id: request.id,
          reason: request.reason,
          startDate: request.startDate ? thaiShortDate(request.startDate) : null,
          endDate: request.endDate ? thaiShortDate(request.endDate) : null,
          status: request.status,
          reviewNote: request.reviewNote,
          reviewedAt: request.reviewedAt
            ? `${thaiShortDate(request.reviewedAt)} เวลา ${formatWallClockTime(request.reviewedAt, true)}`
            : null,
          createdAt: request.createdAt.toISOString(),
          student: {
            studentId: request.student.studentId,
            fullName: request.student.fullName,
            nickname: request.student.nickname,
            numberInClass: request.student.numberInClass,
          },
        }))}
      />
    </>
  );
}
