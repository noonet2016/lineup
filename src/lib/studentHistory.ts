import { prisma } from "./prisma";
import { todayInBangkok } from "./time";

export type HistoryStatus = "present" | "late" | "absent" | "pending" | "flagged" | "notyet" | "none";

export type HistoryDay = {
  sessionDate: Date;
  status: HistoryStatus;
  checkTime: Date | null;
};

export type StudentHistory = {
  student: { studentId: string; fullName: string; nickname: string | null; classroomId: number };
  todayStatus: HistoryStatus;
  todayTime: Date | null;
  todayHasSession: boolean;
  range: { startYear: number; startMonth: number; endYear: number; endMonth: number };
  totalSessions: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  pendingDays: number;
  rate: number;
  history: HistoryDay[];
  historyTotal: number;
  historyPage: number;
  historyPageSize: number;
};

export const HISTORY_PAGE_SIZE = 30;

/** Mirrors legacy student/history.php: today's status + monthly summary + last-90 daily history for one student. */
export async function loadStudentHistory(
  studentId: string,
  startYear: number,
  startMonth: number,
  endYear: number = startYear,
  endMonth: number = startMonth,
  historyPage: number = 1,
): Promise<StudentHistory | null> {
  const student = await prisma.student.findUnique({
    where: { studentId },
    select: { studentId: true, fullName: true, nickname: true, classroomId: true },
  });
  if (!student) return null;

  const today = todayInBangkok();
  const todaySession = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: student.classroomId } },
    select: { id: true },
  });

  let todayStatus: HistoryStatus = "none";
  let todayTime: Date | null = null;
  const todayHasSession = Boolean(todaySession);
  if (todaySession) {
    const record = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: todaySession.id, studentId } },
      select: { status: true, checkTime: true },
    });
    if (record) {
      todayStatus = record.status as HistoryStatus;
      todayTime = record.checkTime;
    } else {
      todayStatus = "notyet";
    }
  }

  const monthStart = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(endYear, endMonth, 0));

  const page = Math.max(1, historyPage);
  const [totalSessions, statusCounts, historyTotal, history] = await Promise.all([
    prisma.attendanceSession.count({
      where: { classroomId: student.classroomId, sessionDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        studentId,
        session: { classroomId: student.classroomId, sessionDate: { gte: monthStart, lte: monthEnd } },
      },
      _count: { _all: true },
    }),
    prisma.attendanceSession.count({
      where: { classroomId: student.classroomId },
    }),
    prisma.attendanceSession.findMany({
      where: { classroomId: student.classroomId },
      orderBy: { sessionDate: "desc" },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        sessionDate: true,
        attendanceRecords: {
          where: { studentId },
          select: { status: true, checkTime: true },
        },
      },
    }),
  ]);

  const cnt = { present: 0, late: 0, pending: 0, flagged: 0 };
  for (const row of statusCounts) {
    if (row.status in cnt) cnt[row.status as keyof typeof cnt] = row._count._all;
  }
  const presentDays = cnt.present;
  const lateDays = cnt.late;
  const attended = presentDays + lateDays;
  const absentDays = Math.max(0, totalSessions - attended - cnt.pending - cnt.flagged);
  const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  return {
    student,
    todayStatus,
    todayTime,
    todayHasSession,
    range: { startYear, startMonth, endYear, endMonth },
    totalSessions,
    presentDays,
    lateDays,
    absentDays,
    pendingDays: cnt.pending + cnt.flagged,
    rate,
    historyTotal,
    historyPage: page,
    historyPageSize: HISTORY_PAGE_SIZE,
    history: history.map((h) => {
      const record = h.attendanceRecords[0];
      return {
        sessionDate: h.sessionDate,
        status: (record?.status as HistoryStatus) ?? "absent",
        checkTime: record?.checkTime ?? null,
      };
    }),
  };
}

export function historyStatusMeta(status: HistoryStatus): { text: string; className: string } {
  switch (status) {
    case "present":
      return { text: "มาปกติ", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
    case "late":
      return { text: "สาย", className: "bg-amber-500/10 border-amber-500/20 text-amber-400" };
    case "absent":
      return { text: "ขาด", className: "bg-rose-500/10 border-rose-500/20 text-rose-400" };
    case "flagged":
      return { text: "นอกรัศมี", className: "bg-orange-500/10 border-orange-500/20 text-orange-400" };
    case "pending":
      return { text: "รอตรวจ", className: "bg-slate-500/10 border-slate-500/20 text-slate-400" };
    case "notyet":
      return { text: "ยังไม่เช็ค", className: "bg-slate-700/20 border-slate-700/40 text-slate-400" };
    default:
      return { text: "ยังไม่เปิดรอบ", className: "bg-slate-700/20 border-slate-700/40 text-slate-400" };
  }
}
