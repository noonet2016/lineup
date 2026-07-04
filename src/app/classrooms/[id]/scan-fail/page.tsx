import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PollRefresh from "@/app/_components/PollRefresh";
import ScanFailListClient from "./ScanFailListClient";
import { getUnmatchedScanFailReports } from "@/lib/actions/scanfail";
import { formatWallClockDate, nowInBangkok } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function ClassroomScanFailPage({ params }: { params: Promise<Params> }) {
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

  const reports = await getUnmatchedScanFailReports(classroomId);
  const todayLabel = formatWallClockDate(nowInBangkok().dateOnly);

  return (
    <>
      <PollRefresh />
      <ScanFailListClient
        classroomId={classroomId}
        roomName={classroom.roomName}
        fullName={classroom.advisor?.fullName ?? ""}
        reports={reports}
        todayLabel={todayLabel}
      />
    </>
  );
}
