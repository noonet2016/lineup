import { prisma } from "./prisma";

export type ActivityExemption = {
  studentId: string;
  reason: string;
  weekday: null;
  startDate: null;
  endDate: null;
  status: "approved";
  isActive: 1;
  source: "activity";
};

/** Load synthetic, daily exemptions for members of active assembly-exempt activities. */
export async function getActivityExemptions(classroomId: number): Promise<ActivityExemption[]> {
  const memberships = await prisma.studentActivity.findMany({
    where: {
      student: { classroomId, status: 1 },
      activity: { isActive: 1, exemptAssembly: 1 },
    },
    select: { studentId: true, activity: { select: { name: true } } },
    orderBy: [{ studentId: "asc" }, { activityId: "asc" }],
  });
  return memberships.map(({ studentId, activity }) => ({
    studentId,
    reason: activity.name,
    weekday: null,
    startDate: null,
    endDate: null,
    status: "approved",
    isActive: 1,
    source: "activity",
  }));
}

export async function getActivityExemptionsByStudentIds(studentIds: string[]): Promise<ActivityExemption[]> {
  if (!studentIds.length) return [];
  const memberships = await prisma.studentActivity.findMany({
    where: {
      studentId: { in: studentIds },
      student: { status: 1 },
      activity: { isActive: 1, exemptAssembly: 1 },
    },
    select: { studentId: true, activity: { select: { name: true } } },
    orderBy: [{ studentId: "asc" }, { activityId: "asc" }],
  });
  return memberships.map(({ studentId, activity }) => ({
    studentId,
    reason: activity.name,
    weekday: null,
    startDate: null,
    endDate: null,
    status: "approved",
    isActive: 1,
    source: "activity",
  }));
}
