import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveLocation } from "@/lib/checkin";
import { getSession } from "@/lib/session";
import { StudentShell } from "../_components/LegacyChrome";
import CheckinClient from "./CheckinClient";

const TZ = "Asia/Bangkok";

function todayBangkokDate(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
}

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "student") redirect("/account");

  const student = await prisma.student.findUnique({
    where: { studentId: session.id },
    include: { classroom: { select: { roomName: true } } },
  });
  if (!student) redirect("/login");

  const today = todayBangkokDate();
  const todaySession = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: student.classroomId } },
  });
  const existingRecord = todaySession
    ? await prisma.attendanceRecord.findUnique({
        where: { sessionId_studentId: { sessionId: todaySession.id, studentId: student.studentId } },
      })
    : null;

  const location = await getActiveLocation(student.classroomId);

  return (
    <StudentShell active="checkin">
      <CheckinClient
        fullName={student.fullName}
        nickname={student.nickname}
        studentId={student.studentId}
        roomName={student.classroom.roomName}
        locationName={location.name}
        radius={location.radius}
        alreadyCheckedIn={Boolean(existingRecord)}
        existingStatus={existingRecord?.status ?? null}
        existingCheckTime={existingRecord?.checkTime?.toISOString() ?? null}
      />
    </StudentShell>
  );
}
