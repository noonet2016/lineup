import { prisma } from "./prisma";
import { todayInBangkok } from "./time";

export type HistoryStatus = "present" | "late" | "absent" | "pending" | "flagged" | "notyet" | "none" | "leave";

export type LeaveKind = "activity" | "sick" | "personal" | "other";

export type HistoryDay = {
  sessionDate: Date;
  status: HistoryStatus;
  checkTime: Date | null;
  /** Present only when status === "leave": drives the coloured dot + reason label. */
  leaveKind?: LeaveKind;
  leavePending?: boolean;
  leaveReason?: string;
};

type ActiveExemption = {
  reason: string;
  weekday: number | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string; // "approved" | "pending"
};

/** `date` is a UTC-midnight Bangkok-date value (see src/lib/time.ts) — mirror dashboard.ts isoWeekday. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Bucket a free-text leave reason into a coloured category (keyword-based, no DB change). */
export function classifyLeave(reason: string): LeaveKind {
  if (/แข่|กิจกรรม|ค่าย|อบรม|หุ่นยนต์|โรบอท|robot|ประกวด|ตัวแทน|โครงการ|ดนตรี|กีฬา|นางรำ|วง/i.test(reason)) return "activity";
  if (/ป่วย|ไม่สบาย|หมอ|โรงพยาบาล|รพ\.|พบแพทย์/.test(reason)) return "sick";
  if (/ลากิจ|ธุระ|งานบ้าน|งานศพ|ธุระส่วนตัว/.test(reason)) return "personal";
  return "other";
}

/**
 * Best exemption in effect on `date` (approved wins over pending). Mirrors dashboard.ts getExemptMap
 * matching (weekday ISO 1-7, start/end range), but keeps `pending` so students see their request
 * reflected before the teacher approves it.
 */
export function matchExemption(exemptions: ActiveExemption[], date: Date): ActiveExemption | null {
  const wd = isoWeekday(date);
  let best: ActiveExemption | null = null;
  for (const e of exemptions) {
    if (e.weekday !== null && e.weekday !== wd) continue;
    if (e.startDate && e.startDate > date) continue;
    if (e.endDate && e.endDate < date) continue;
    if (e.status === "approved") return e; // approved is the strongest — take immediately
    if (!best) best = e; // remember a pending match, keep scanning for an approved one
  }
  return best;
}

export type StudentHistory = {
  student: { studentId: string; fullName: string; nickname: string | null; classroomId: number };
  todayStatus: HistoryStatus;
  todayTime: Date | null;
  todayHasSession: boolean;
  todayLeaveKind?: LeaveKind;
  todayLeavePending?: boolean;
  todayLeaveReason?: string;
  range: { startYear: number; startMonth: number; endYear: number; endMonth: number };
  totalSessions: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
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
  // All active (approved OR pending) exemptions for this student — matched per-date in JS below.
  const exemptions = (await prisma.studentExemption.findMany({
    where: { studentId, isActive: 1, status: { in: ["approved", "pending"] } },
    select: { reason: true, weekday: true, startDate: true, endDate: true, status: true },
  })) as ActiveExemption[];

  const [rangeSessions, historyTotal, history] = await Promise.all([
    // Whole selected range (with this student's record) so leave days can be subtracted from "absent".
    prisma.attendanceSession.findMany({
      where: { classroomId: student.classroomId, sessionDate: { gte: monthStart, lte: monthEnd } },
      select: {
        sessionDate: true,
        attendanceRecords: { where: { studentId }, select: { status: true } },
      },
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

  const totalSessions = rangeSessions.length;
  const cnt = { present: 0, late: 0, pending: 0, flagged: 0, leave: 0 };
  for (const s of rangeSessions) {
    const st = s.attendanceRecords[0]?.status;
    if (st === "present" || st === "late" || st === "pending" || st === "flagged") {
      cnt[st] += 1;
    } else if (matchExemption(exemptions, s.sessionDate)) {
      // No present/late record, but an approved/pending exemption covers this day → leave, not absent.
      cnt.leave += 1;
    }
  }
  const presentDays = cnt.present;
  const lateDays = cnt.late;
  const attended = presentDays + lateDays;
  const absentDays = Math.max(0, totalSessions - attended - cnt.pending - cnt.flagged - cnt.leave);
  const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  // Today: if there is no present/late record yet but an exemption covers today, show leave (not "ยังไม่เช็ค"/ขาด).
  let todayLeave: ActiveExemption | null = null;
  if (todayStatus === "notyet" || todayStatus === "none") {
    todayLeave = matchExemption(exemptions, today);
    if (todayLeave) todayStatus = "leave";
  }

  return {
    student,
    todayStatus,
    todayTime,
    todayHasSession,
    todayLeaveKind: todayLeave ? classifyLeave(todayLeave.reason) : undefined,
    todayLeavePending: todayLeave ? todayLeave.status === "pending" : undefined,
    todayLeaveReason: todayLeave?.reason,
    range: { startYear, startMonth, endYear, endMonth },
    totalSessions,
    presentDays,
    lateDays,
    absentDays,
    leaveDays: cnt.leave,
    pendingDays: cnt.pending + cnt.flagged,
    rate,
    historyTotal,
    historyPage: page,
    historyPageSize: HISTORY_PAGE_SIZE,
    history: history.map((h) => {
      const record = h.attendanceRecords[0];
      if (record) {
        return { sessionDate: h.sessionDate, status: record.status as HistoryStatus, checkTime: record.checkTime };
      }
      // No record → an approved/pending exemption turns "ขาด" into a coloured leave dot.
      const ex = matchExemption(exemptions, h.sessionDate);
      if (ex) {
        return {
          sessionDate: h.sessionDate,
          status: "leave" as HistoryStatus,
          checkTime: null,
          leaveKind: classifyLeave(ex.reason),
          leavePending: ex.status === "pending",
          leaveReason: ex.reason,
        };
      }
      return { sessionDate: h.sessionDate, status: "absent" as HistoryStatus, checkTime: null };
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
    case "leave":
      return { text: "ลา/กิจกรรม", className: "bg-sky-500/10 border-sky-500/20 text-sky-300" };
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

/** Coloured dot + label for a leave day. `pending` (student asked, teacher not yet approved) dims it. */
export function leaveMeta(
  kind: LeaveKind = "other",
  pending = false,
): { text: string; dotClass: string; className: string } {
  const base: Record<LeaveKind, { text: string; dot: string; pill: string }> = {
    activity: { text: "ไปกิจกรรม", dot: "bg-purple-400", pill: "bg-purple-500/10 border-purple-500/25 text-purple-300" },
    sick: { text: "ลาป่วย", dot: "bg-sky-400", pill: "bg-sky-500/10 border-sky-500/25 text-sky-300" },
    personal: { text: "ลากิจ", dot: "bg-amber-400", pill: "bg-amber-500/10 border-amber-500/25 text-amber-300" },
    other: { text: "ลาอื่นๆ", dot: "bg-slate-300", pill: "bg-slate-500/10 border-slate-500/25 text-slate-300" },
  };
  const m = base[kind];
  return {
    text: pending ? `${m.text} (รออนุมัติ)` : m.text,
    dotClass: pending ? `${m.dot} opacity-50` : m.dot,
    className: pending ? `${m.pill} opacity-70 border-dashed` : m.pill,
  };
}
