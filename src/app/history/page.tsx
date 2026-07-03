import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");

  const student = await prisma.student.findUnique({
    where: { studentId: session.id },
    select: { classroomId: true },
  });

  if (!student) redirect("/login");

  redirect(`/classrooms/${student.classroomId}/students/${session.id}`);
}
