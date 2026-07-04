import { prisma } from "./prisma";
import { getExemptMap } from "./dashboard";
import { getScanFailMap } from "./actions/scanfail";
import { getActivityTagMap } from "./actions/activities";
import type { DashboardStatus } from "./dashboardBadge";

/** Mirrors legacy teacher/report.php's summary query: one row per attendance_session in the date range. */
export type ReportSummaryRow = {
  sessionId: number;
  sessionDate: Date;
  present: number;
  late: number;
  absent: number;
  excused: number;
  pending: number;
  flagged: number;
  totalStudents: number;
};

export type StudentReportBand = "regular" | "normal" | "frequent-absent";

export type StudentReportDayRow = {
  sessionId: number;
  sessionDate: Date;
  status: DashboardStatus;
  exemptReason: string | null;
};

export type ActivityTag = { name: string; color: string };

export type StudentReportRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  linePictureUrl: string | null;
  activities: ActivityTag[];
  sessionsExpected: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendRate: number | null;
  band: StudentReportBand;
  days: StudentReportDayRow[];
};

/** Mirrors legacy teacher/report.php's daily summary table (start_date/end_date inclusive, both UTC-midnight Bangkok dates). */
export async function loadReportSummary(classroomId: number, startDate: Date, endDate: Date): Promise<ReportSummaryRow[]> {
  const [sessions, totalStudents] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classroomId, sessionDate: { gte: startDate, lte: endDate } },
      orderBy: { sessionDate: "desc" },
      select: {
        id: true,
        sessionDate: true,
        attendanceRecords: { select: { studentId: true, status: true } },
      },
    }),
    prisma.student.count({ where: { classroomId, status: 1 } }),
  ]);

  const rows: ReportSummaryRow[] = [];
  for (const session of sessions) {
    const counts = { present: 0, late: 0, pending: 0, flagged: 0 };
    const recordedStudentIds = new Set<string>();
    for (const r of session.attendanceRecords) {
      recordedStudentIds.add(r.studentId);
      if (r.status === "present") counts.present++;
      else if (r.status === "late") counts.late++;
      else if (r.status === "pending") counts.pending++;
      else if (r.status === "flagged") counts.flagged++;
    }

    const exemptMap = await getExemptMap(classroomId, session.sessionDate);
    let excused = 0;
    if (exemptMap.size > 0) {
      const exemptStudentsInClassroom = await prisma.student.count({
        where: { classroomId, status: 1, studentId: { in: [...exemptMap.keys()], notIn: [...recordedStudentIds] } },
      });
      excused = exemptStudentsInClassroom;
    }

    const activeCheckins = counts.present + counts.late + counts.pending + counts.flagged;
    const absent = Math.max(0, totalStudents - activeCheckins - excused);

    rows.push({
      sessionId: session.id,
      sessionDate: session.sessionDate,
      present: counts.present,
      late: counts.late,
      absent,
      excused,
      pending: counts.pending,
      flagged: counts.flagged,
      totalStudents,
    });
  }
  return rows;
}

/** Builds the orthogonal report angle: one row per active student across every session in the range. */
export async function loadStudentReport(classroomId: number, startDate: Date, endDate: Date): Promise<StudentReportRow[]> {
  const [sessions, students, activityTagMap] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classroomId, sessionDate: { gte: startDate, lte: endDate } },
      orderBy: { sessionDate: "desc" },
      select: {
        id: true,
        sessionDate: true,
        attendanceRecords: { select: { studentId: true, status: true } },
      },
    }),
    prisma.student.findMany({
      where: { classroomId, status: 1 },
      orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
      select: {
        studentId: true,
        fullName: true,
        nickname: true,
        numberInClass: true,
        linePictureUrl: true,
        createdAt: true,
      },
    }),
    getActivityTagMap(classroomId),
  ]);

  const rows = new Map<string, StudentReportRow>();
  for (const student of students) {
    rows.set(student.studentId, {
      studentId: student.studentId,
      fullName: student.fullName,
      nickname: student.nickname,
      numberInClass: student.numberInClass,
      linePictureUrl: student.linePictureUrl,
      activities: activityTagMap.get(student.studentId) ?? [],
      sessionsExpected: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      attendRate: null,
      band: "normal",
      days: [],
    });
  }

  for (const session of sessions) {
    const exemptMap = await getExemptMap(classroomId, session.sessionDate);
    const recordMap = new Map(session.attendanceRecords.map((record) => [record.studentId, record.status]));

    for (const student of students) {
      const row = rows.get(student.studentId);
      const enrolledDate = new Date(Date.UTC(student.createdAt.getUTCFullYear(), student.createdAt.getUTCMonth(), student.createdAt.getUTCDate()));
      if (!row || session.sessionDate < enrolledDate) continue;

      const recordStatus = recordMap.get(student.studentId);
      if (recordStatus) {
        const status = recordStatus as DashboardStatus;
        if (status === "late") row.late++;
        else if (status === "absent") row.absent++;
        else row.present++;
        row.sessionsExpected++;
        row.days.push({ sessionId: session.id, sessionDate: session.sessionDate, status, exemptReason: null });
        continue;
      }

      if (exemptMap.has(student.studentId)) {
        row.excused++;
        row.days.push({
          sessionId: session.id,
          sessionDate: session.sessionDate,
          status: "excused",
          exemptReason: exemptMap.get(student.studentId) ?? null,
        });
      } else {
        row.absent++;
        row.sessionsExpected++;
        row.days.push({ sessionId: session.id, sessionDate: session.sessionDate, status: "absent", exemptReason: null });
      }
    }
  }

  for (const row of rows.values()) {
    const attended = row.present + row.late;
    row.attendRate = row.sessionsExpected === 0 ? null : attended / row.sessionsExpected;
    if (row.attendRate === null || row.attendRate >= 0.95 || row.absent === 0) row.band = "regular";
    else if (row.attendRate < 0.8) row.band = "frequent-absent";
    else row.band = "normal";
  }

  return [...rows.values()];
}

export type ReportDayRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  displayStatus: DashboardStatus;
  checkTime: Date | null;
  distanceM: number | null;
  isSuspicious: boolean;
  editReason: string | null;
  editorName: string | null;
  exemptReason: string | null;
  scanFailBadge: string | null;
};

export type ReportDayStats = { present: number; late: number; absent: number; excused: number; pending: number; flagged: number };

export type ReportDayData = {
  session: { id: number; sessionDate: Date; startTime: Date; endTime: Date };
  students: ReportDayRow[];
  stats: ReportDayStats;
};

/** Mirrors legacy teacher/report_day.php: per-student detail for one specific attendance_session. */
export async function loadReportDay(classroomId: number, sessionId: number): Promise<ReportDayData | null> {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, classroomId },
    select: { id: true, sessionDate: true, startTime: true, endTime: true },
  });
  if (!session) return null;

  const [exemptMap, scanFailMap, students] = await Promise.all([
    getExemptMap(classroomId, session.sessionDate),
    getScanFailMap(classroomId),
    prisma.student.findMany({
      where: { classroomId, status: 1 },
      orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
      select: {
        studentId: true,
        fullName: true,
        nickname: true,
        numberInClass: true,
        attendanceRecords: {
          where: { sessionId },
          select: {
            status: true,
            checkTime: true,
            distanceM: true,
            isSuspicious: true,
            editReason: true,
            editor: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const stats: ReportDayStats = { present: 0, late: 0, absent: 0, excused: 0, pending: 0, flagged: 0 };
  const rows: ReportDayRow[] = [];

  for (const student of students) {
    const record = student.attendanceRecords[0];
    let displayStatus: DashboardStatus;
    let exemptReason: string | null = null;

    if (record) {
      displayStatus = record.status as DashboardStatus;
    } else if (exemptMap.has(student.studentId)) {
      displayStatus = "excused";
      exemptReason = exemptMap.get(student.studentId) ?? null;
    } else {
      displayStatus = "absent";
    }

    if (displayStatus in stats) stats[displayStatus as keyof ReportDayStats]++;

    rows.push({
      studentId: student.studentId,
      fullName: student.fullName,
      nickname: student.nickname,
      numberInClass: student.numberInClass,
      displayStatus,
      checkTime: record?.checkTime ?? null,
      distanceM: record?.distanceM ?? null,
      isSuspicious: Boolean(record?.isSuspicious),
      editReason: record?.editReason ?? null,
      editorName: record?.editor?.fullName ?? null,
      exemptReason,
      scanFailBadge: record && scanFailMap[student.studentId] ? `⚠️ สแกนหน้าไม่ติด · แจ้ง ${scanFailMap[student.studentId].reportedAt}` : null,
    });
  }

  return { session, students: rows, stats };
}

export type ReportCsvRow = {
  sessionDate: string;
  roomName: string;
  numberInClass: number | null;
  studentId: string;
  fullName: string;
  statusText: string;
  checkTime: string;
  distanceM: number | string;
  suspiciousText: string;
  editReason: string;
  editorName: string;
};

const STATUS_LABEL_TH: Record<string, string> = {
  present: "มาปกติ",
  late: "สาย",
  absent: "ขาด",
  pending: "รอตรวจ (พิกัดอ่อน)",
  flagged: "นอกรัศมี",
};

/** Mirrors legacy report.php's export_csv SQL: one row per session_date x student across the range. */
export async function buildReportCsvRows(classroomId: number, startDate: Date, endDate: Date): Promise<ReportCsvRow[]> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { roomName: true } });
  const roomName = classroom?.roomName ?? "-";

  const sessions = await prisma.attendanceSession.findMany({
    where: { classroomId, sessionDate: { gte: startDate, lte: endDate } },
    orderBy: { sessionDate: "desc" },
    select: { id: true, sessionDate: true },
  });

  const students = await prisma.student.findMany({
    where: { classroomId, status: 1 },
    orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
    select: { studentId: true, fullName: true, numberInClass: true },
  });

  const rows: ReportCsvRow[] = [];
  for (const session of sessions) {
    const exemptMap = await getExemptMap(classroomId, session.sessionDate);
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId: session.id },
      select: {
        studentId: true,
        status: true,
        checkTime: true,
        distanceM: true,
        isSuspicious: true,
        ipAddress: true,
        editReason: true,
        editor: { select: { fullName: true } },
      },
    });
    const recordMap = new Map(records.map((r) => [r.studentId, r]));
    const dateStr = session.sessionDate.toISOString().slice(0, 10);

    for (const student of students) {
      const record = recordMap.get(student.studentId);
      let statusText: string;
      if (!record && exemptMap.has(student.studentId)) {
        statusText = `ลา/กิจกรรม (${exemptMap.get(student.studentId)})`;
      } else {
        statusText = STATUS_LABEL_TH[record?.status ?? "absent"] ?? record?.status ?? "ขาด";
      }

      rows.push({
        sessionDate: dateStr,
        roomName,
        numberInClass: student.numberInClass,
        studentId: student.studentId,
        fullName: student.fullName,
        statusText,
        checkTime: record?.checkTime
          ? `${String(record.checkTime.getUTCHours()).padStart(2, "0")}:${String(record.checkTime.getUTCMinutes()).padStart(2, "0")}:${String(record.checkTime.getUTCSeconds()).padStart(2, "0")}`
          : "-",
        distanceM: record?.distanceM ?? "-",
        suspiciousText: record?.isSuspicious ? "1 (ผิดปกติ)" : "0",
        editReason: record?.editReason ?? "-",
        editorName: record?.editor?.fullName ?? "-",
      });
    }
  }
  return rows;
}
