import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PollRefresh from "@/app/_components/PollRefresh";
import ScanFailListClient from "./ScanFailListClient";
import { getUnmatchedScanFailReports } from "@/lib/actions/scanfail";
import { formatDateInput, formatWallClockDate, nowInBangkok, parseDateInput } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = { id: string };
type SearchParams = { date?: string | string[] };

function resolveSelectedDate(rawDate: string | string[] | undefined): { selectedDate: string; sessionDate: Date; isToday: boolean } {
  const today = nowInBangkok().dateOnly;
  const todayInput = formatDateInput(today);
  const dateParam = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  const parsed = dateParam ? parseDateInput(dateParam) : null;
  const validDate = parsed && formatDateInput(parsed) === dateParam && dateParam <= todayInput ? parsed : today;
  const selectedDate = formatDateInput(validDate);
  return { selectedDate, sessionDate: validDate, isToday: selectedDate === todayInput };
}

export default async function ClassroomScanFailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
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

  const { selectedDate, sessionDate, isToday } = resolveSelectedDate(date);
  // Always include matched students (today + historical) so the report is a full
  // scan-fail log with a check-in status badge per row, per Trainer request.
  const reports = await getUnmatchedScanFailReports(classroomId, sessionDate, true);
  const todayDate = formatDateInput(nowInBangkok().dateOnly);
  const todayLabel = formatWallClockDate(sessionDate);

  return (
    <>
      {isToday && <PollRefresh />}
      <ScanFailListClient
        classroomId={classroomId}
        roomName={classroom.roomName}
        fullName={classroom.advisor?.fullName ?? ""}
        reports={reports}
        todayLabel={todayLabel}
        selectedDate={selectedDate}
        todayDate={todayDate}
        isToday={isToday}
      />
    </>
  );
}
