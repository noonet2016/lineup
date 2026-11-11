import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/teacher";
import { formatDateInput, formatWallClockDate, nowInBangkok, parseDateInput, todayInBangkok } from "@/lib/time";
import ExemptionsClient from "./ExemptionsClient";
import { studentAvatarUrl } from "@/lib/studentPhoto";

export const dynamic = "force-dynamic";

/** Mon=1 … Sun=7, from a wall-clock Date (UTC fields). */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Does this exemption apply on `day`? Same rule as matchExemption in lib/studentHistory. */
function appliesOn(e: { weekday: number | null; startDate: Date | null; endDate: Date | null }, day: Date): boolean {
  if (e.weekday !== null && e.weekday !== isoWeekday(day)) return false;
  if (e.startDate && e.startDate > day) return false;
  if (e.endDate && e.endDate < day) return false;
  return true;
}

export default async function ClassroomExemptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string | string[]; view?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewAll = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === "all";
  const today = nowInBangkok().dateOnly;
  const todayDate = formatDateInput(today);
  const rawDate = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const parsed = rawDate ? parseDateInput(rawDate) : null;
  const selectedDay = parsed && formatDateInput(parsed) === rawDate ? parsed : today;
  const selectedDate = formatDateInput(selectedDay);
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) redirect("/classrooms");

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}`);

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { advisor: { select: { fullName: true } } },
  });
  const admin = await isAdmin();
  if (!classroom || (!admin && classroom.advisorId !== Number(session.id))) redirect(`/classrooms/${classroomId}`);

  const [students, exemptions] = await Promise.all([
    prisma.student.findMany({ where: { classroomId, status: 1 }, orderBy: { numberInClass: "asc" } }),
    prisma.studentExemption.findMany({
      where: { student: { classroomId } },
      include: { student: { select: { studentId: true, fullName: true, nickname: true, numberInClass: true } } },
      orderBy: [{ id: "desc" }],
    }),
  ]);

  const todayLabel = formatWallClockDate(todayInBangkok());
  // Default view = only what is in effect on the selected day (active + matching date/weekday).
  const shown = viewAll ? exemptions : exemptions.filter((e) => e.isActive === 1 && appliesOn(e, selectedDay));

  return (
    <ExemptionsClient
      classroomId={classroomId}
      roomName={classroom.roomName}
      fullName={classroom.advisor?.fullName ?? ""}
      todayLabel={todayLabel}
      adminBack={admin}
      viewAll={viewAll}
      selectedDate={selectedDate}
      selectedDateLabel={formatWallClockDate(selectedDay)}
      todayDate={todayDate}
      totalCount={exemptions.length}
      students={students.map((s) => ({ studentId: s.studentId, fullName: s.fullName, nickname: s.nickname, numberInClass: s.numberInClass }))}
      exemptions={shown.map((e) => ({
        id: e.id,
        studentId: e.student.studentId,
        studentName: e.student.fullName,
        nickname: e.student.nickname,
        numberInClass: e.student.numberInClass,
        photoUrl: studentAvatarUrl(e.student.studentId, null),
        reason: e.reason,
        weekday: e.weekday,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : null,
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
        isActive: e.isActive === 1,
      }))}
    />
  );
}
