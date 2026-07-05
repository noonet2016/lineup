import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PollRefresh from "@/app/_components/PollRefresh";
import LineStatusClient from "./LineStatusClient";

export const dynamic = "force-dynamic";

export default async function ClassroomLineStatusPage({ params }: { params: Promise<{ id: string }> }) {
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

  const students = await prisma.student.findMany({
    where: { classroomId, status: 1 },
    orderBy: { numberInClass: "asc" },
  });

  return (
    <>
      <PollRefresh />
      <LineStatusClient
        classroomId={classroomId}
        roomName={classroom.roomName}
        fullName={classroom.advisor?.fullName ?? ""}
        students={students.map((s) => ({
          studentId: s.studentId,
          fullName: s.fullName,
          nickname: s.nickname,
          numberInClass: s.numberInClass,
          linked: Boolean(s.lineUserId),
          lineDisplayName: s.lineDisplayName,
          linePictureUrl: s.linePictureUrl,
          lineChatId: s.lineChatId,
        }))}
      />
    </>
  );
}
