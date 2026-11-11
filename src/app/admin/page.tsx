import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { todayInBangkok } from "@/lib/time";
import { AdminShell } from "../_components/LegacyChrome";
import OverviewClient from "./OverviewClient";
import { studentAvatarUrl } from "@/lib/studentPhoto";
import { getActivityExemptionsByStudentIds } from "@/lib/activityExemptions";

export const dynamic = "force-dynamic";

function dateDaysBefore(date: Date, days: number): Date { return new Date(date.getTime() - days * 24 * 60 * 60 * 1000); }
type AttendanceStatus = "present" | "late" | "absent" | "excused" | "pending" | "flagged";
type AttendanceSummary = { present: number; late: number; absent: number; leave: number };
type OverviewSession = { classroomId: number; sessionDate: Date; attendanceRecords: { studentId: string; status: string }[] };
type OverviewExemption = { studentId: string; weekday: number | null; startDate: Date | null; endDate: Date | null };

function isExemptOnDate(exemption: OverviewExemption, date: Date): boolean {
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return (exemption.weekday === null || exemption.weekday === weekday) && (exemption.startDate === null || exemption.startDate.getTime() <= date.getTime()) && (exemption.endDate === null || exemption.endDate.getTime() >= date.getTime());
}
function deriveAttendanceStatus(studentId: string, session: OverviewSession, exemptionsByStudent: Map<string, OverviewExemption[]>): AttendanceStatus {
  const record = session.attendanceRecords.find((item) => item.studentId === studentId);
  if (record) return record.status as AttendanceStatus;
  return exemptionsByStudent.get(studentId)?.some((exemption) => isExemptOnDate(exemption, session.sessionDate)) ? "excused" : "absent";
}
function summarizeSessions(sessions: OverviewSession[], studentIdsByClassroom: Map<number, string[]>, exemptionsByStudent: Map<string, OverviewExemption[]>): AttendanceSummary {
  const summary: AttendanceSummary = { present: 0, late: 0, absent: 0, leave: 0 };
  for (const session of sessions) for (const studentId of studentIdsByClassroom.get(session.classroomId) ?? []) {
    const status = deriveAttendanceStatus(studentId, session, exemptionsByStudent);
    if (status === "present") summary.present += 1; else if (status === "late") summary.late += 1; else if (status === "excused") summary.leave += 1; else if (status === "absent") summary.absent += 1;
  }
  return summary;
}
function attendanceRate(summary: AttendanceSummary): number { const eligibleCount = summary.present + summary.late + summary.absent; return eligibleCount ? Math.round(((summary.present + summary.late) / eligibleCount) * 100) : 0; }

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect("/checkin");
  const me = await prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { fullName: true, role: true } });
  if (!me || me.role !== "admin") redirect("/account");

  const today = todayInBangkok();
  const recentWindowStart = dateDaysBefore(today, 29);
  const [classrooms, students, exemptions, activityExemptions, noLineCount, openScanFailCount] = await Promise.all([
    prisma.classroom.findMany({ orderBy: { id: "asc" }, select: { id: true, roomName: true, _count: { select: { students: { where: { status: 1 } } } }, sessions: { select: { classroomId: true, sessionDate: true, attendanceRecords: { select: { studentId: true, status: true } } } } } }),
    prisma.student.findMany({ where: { status: 1 }, orderBy: [{ classroomId: "asc" }, { numberInClass: "asc" }, { studentId: "asc" }], select: { studentId: true, fullName: true, nickname: true, numberInClass: true, linePictureUrl: true, classroom: { select: { id: true, roomName: true } } } }),
    prisma.studentExemption.findMany({ where: { isActive: 1, status: "approved" }, select: { studentId: true, weekday: true, startDate: true, endDate: true } }),
    prisma.student.findMany({ where: { status: 1 }, select: { studentId: true } }).then((rows) => getActivityExemptionsByStudentIds(rows.map((row) => row.studentId))),
    prisma.student.count({ where: { lineUserId: null } }),
    prisma.scanFailReport.count({ where: { acknowledgedAt: null } }),
  ]);
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  const studentIdsByClassroom = new Map<number, string[]>();
  for (const student of students) studentIdsByClassroom.set(student.classroom.id, [...(studentIdsByClassroom.get(student.classroom.id) ?? []), student.studentId]);
  const exemptionsByStudent = new Map<string, OverviewExemption[]>();
  for (const exemption of exemptions) exemptionsByStudent.set(exemption.studentId, [...(exemptionsByStudent.get(exemption.studentId) ?? []), exemption]);
  for (const exemption of activityExemptions) exemptionsByStudent.set(exemption.studentId, [...(exemptionsByStudent.get(exemption.studentId) ?? []), exemption]);
  const allSessions = classrooms.flatMap((classroom) => classroom.sessions);
  const todaySummary = summarizeSessions(allSessions.filter((item) => item.sessionDate.getTime() === today.getTime()), studentIdsByClassroom, exemptionsByStudent);
  const trend = Array.from({ length: 7 }, (_, index) => { const date = dateDaysBefore(today, 6 - index); return { label: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`, rate: attendanceRate(summarizeSessions(allSessions.filter((item) => item.sessionDate.getTime() === date.getTime()), studentIdsByClassroom, exemptionsByStudent)) }; });
  const absentCounts = new Map<string, number>();
  for (const sessionItem of allSessions) if (sessionItem.sessionDate.getTime() >= recentWindowStart.getTime() && sessionItem.sessionDate.getTime() <= today.getTime()) for (const studentId of studentIdsByClassroom.get(sessionItem.classroomId) ?? []) if (deriveAttendanceStatus(studentId, sessionItem, exemptionsByStudent) === "absent") absentCounts.set(studentId, (absentCounts.get(studentId) ?? 0) + 1);
  const topAbsentees = [...absentCounts.entries()].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).slice(0, 10).flatMap(([studentId, absentCount]) => { const student = studentById.get(studentId); return student ? [{ studentId: student.studentId, fullName: student.fullName, nickname: student.nickname, numberInClass: student.numberInClass, photoUrl: studentAvatarUrl(student.studentId, student.linePictureUrl), roomName: student.classroom.roomName, absentCount }] : []; });

  return <AdminShell active="overview" fullName={me.fullName}><OverviewClient overview={{ today: { ...todaySummary, rate: attendanceRate(todaySummary) }, classrooms: classrooms.map((classroom) => ({ roomName: classroom.roomName, studentCount: classroom._count.students, rate: attendanceRate(summarizeSessions(classroom.sessions, studentIdsByClassroom, exemptionsByStudent)) })), trend, topAbsentees, health: { noLineCount, openScanFailCount } }} /></AdminShell>;
}
