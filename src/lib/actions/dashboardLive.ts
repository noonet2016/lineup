"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { loadDashboard, type DashboardData, type DashboardFilter } from "@/lib/dashboard";

/** Mirrors legacy teacher/dashboard_data.php: same data as the page's initial load, for 30s client polling. */
export async function fetchDashboardSnapshot(classroomId: number, filter: DashboardFilter): Promise<DashboardData> {
  // Ownership gate — only the advising teacher may poll a classroom's live roster/stats.
  const session = await requireSession();
  if (session.role !== "teacher") throw new Error("เฉพาะครูเท่านั้น");
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { advisorId: true },
  });
  if (!classroom || classroom.advisorId !== Number(session.id)) {
    throw new Error("ไม่มีสิทธิ์เข้าถึงข้อมูลห้องเรียนนี้");
  }
  return loadDashboard(classroomId, filter);
}
