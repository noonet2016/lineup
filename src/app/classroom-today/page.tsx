import { redirect } from "next/navigation";
import ClassroomTodayClient from "./ClassroomTodayClient";
import { StudentShell } from "@/app/_components/LegacyChrome";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { classifyLeave, leaveMeta, matchExemption } from "@/lib/studentHistory";
import { formatDateInput, formatWallClockDate, nowInBangkok, parseDateInput } from "@/lib/time";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function ClassroomTodayPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");

  const student = await prisma.student.findUnique({
    where: { studentId: session.id },
    select: {
      classroomId: true,
      classroom: { select: { roomName: true } },
    },
  });
  if (!student) redirect("/login");

  const params = await searchParams;
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const today = nowInBangkok().dateOnly;
  const selectedDay = dateParam ? parseDateInput(dateParam) ?? today : today;

  const students = await prisma.student.findMany({
    where: { classroomId: student.classroomId, status: 1 },
    orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
    select: {
      studentId: true,
      fullName: true,
      nickname: true,
      numberInClass: true,
      exemptions: {
        where: { isActive: 1, status: { in: ["approved", "pending"] } },
        select: { reason: true, weekday: true, startDate: true, endDate: true, status: true },
      },
    },
  });

  const leaveRows = students.flatMap((classmate) => {
    const exemption = matchExemption(classmate.exemptions, selectedDay);
    if (!exemption) return [];
    const kind = classifyLeave(exemption.reason);
    const pending = exemption.status === "pending";
    const meta = leaveMeta(kind, pending);
    return [
      {
        studentId: classmate.studentId,
        numberInClass: classmate.numberInClass,
        fullName: classmate.fullName,
        nickname: classmate.nickname,
        pending,
        label: meta.text,
        dotClass: meta.dotClass,
        badgeClass: meta.className,
      },
    ];
  });

  return (
    <StudentShell active="classroomToday">
      <ClassroomTodayClient
        roomName={student.classroom.roomName}
        selectedDate={formatDateInput(selectedDay)}
        selectedDateLabel={formatWallClockDate(selectedDay)}
        todayDate={formatDateInput(today)}
        rows={leaveRows}
      />
    </StudentShell>
  );
}
