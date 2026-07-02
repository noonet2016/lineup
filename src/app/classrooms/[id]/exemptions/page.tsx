import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatWallClockDate, todayInBangkok } from "@/lib/time";
import ExemptionsClient from "./ExemptionsClient";

export const dynamic = "force-dynamic";

export default async function ClassroomExemptionsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [students, exemptions] = await Promise.all([
    prisma.student.findMany({ where: { classroomId, status: 1 }, orderBy: { numberInClass: "asc" } }),
    prisma.studentExemption.findMany({
      where: { student: { classroomId } },
      include: { student: { select: { studentId: true, fullName: true, nickname: true, numberInClass: true } } },
      orderBy: [{ id: "desc" }],
    }),
  ]);

  const todayLabel = formatWallClockDate(todayInBangkok());

  return (
    <ExemptionsClient
      classroomId={classroomId}
      roomName={classroom.roomName}
      fullName={classroom.advisor?.fullName ?? ""}
      todayLabel={todayLabel}
      students={students.map((s) => ({ studentId: s.studentId, fullName: s.fullName, nickname: s.nickname, numberInClass: s.numberInClass }))}
      exemptions={exemptions.map((e) => ({
        id: e.id,
        studentId: e.student.studentId,
        studentName: e.student.fullName,
        nickname: e.student.nickname,
        numberInClass: e.student.numberInClass,
        reason: e.reason,
        weekday: e.weekday,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : null,
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
        isActive: e.isActive === 1,
      }))}
    />
  );
}
