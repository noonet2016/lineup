import { prisma } from "./prisma";
import { todayInBangkok } from "./time";
import { getScanFailMap } from "./actions/scanfail";
import { getActivityTagMap, type ActivityTag } from "./actions/activities";

export type { DashboardStatus } from "./dashboardBadge";
export { dashBadge } from "./dashboardBadge";
import type { DashboardStatus } from "./dashboardBadge";

export type DashboardFilter =
  | "all"
  | "present"
  | "late"
  | "absent"
  | "pending"
  | "flagged"
  | "excused"
  | "edited"
  | "scanfail"
  | "pending_review";

export type DashboardRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  activities: ActivityTag[];
  lineChatId: string | null;
  displayStatus: DashboardStatus;
  checkTime: Date | null;
  distanceM: number | null;
  latitude: number | null;
  longitude: number | null;
  isSuspicious: boolean;
  editReason: string | null;
  exemptReason: string | null;
  exemptLabel: string;
  scanFailBadge: string | null;
};

export type DashboardStats = {
  present: number;
  late: number;
  absent: number;
  pending: number;
  flagged: number;
  review: number;
  edited: number;
  excused: number;
  scanfail: number;
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: "จ",
  2: "อ",
  3: "พ",
  4: "พฤ",
  5: "ศ",
  6: "ส",
  7: "อา",
};

/** `date` is a UTC-midnight Bangkok-date value (see src/lib/time.ts) — use UTC getters, not local ones. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Mirrors legacy lib/exemption.php get_exempt_map(): exemptions in effect for classroom_id on `date`. */
export async function getExemptMap(classroomId: number, date: Date): Promise<Map<string, string>> {
  const weekday = isoWeekday(date);
  const exemptions = await prisma.studentExemption.findMany({
    where: {
      isActive: 1,
      status: "approved",
      student: { classroomId },
      OR: [{ weekday: null }, { weekday }],
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: date } }] },
        { OR: [{ endDate: null }, { endDate: { gte: date } }] },
      ],
    },
    select: { studentId: true, reason: true },
  });
  const map = new Map<string, string>();
  for (const e of exemptions) map.set(e.studentId, e.reason);
  return map;
}

/** Mirrors legacy lib/exemption.php get_exempt_labels(): all active exemptions valid today, for name badges. */
async function getExemptLabels(classroomId: number): Promise<Map<string, string>> {
  const today = todayInBangkok();
  const exemptions = await prisma.studentExemption.findMany({
    where: {
      isActive: 1,
      status: "approved",
      student: { classroomId },
      OR: [
        { startDate: null },
        { startDate: { lte: today } },
      ],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: today } }] }],
    },
    select: { studentId: true, reason: true, weekday: true },
    orderBy: { id: "asc" },
  });
  const grouped = new Map<string, string[]>();
  for (const e of exemptions) {
    let label = e.reason;
    if (e.weekday) label += `(${WEEKDAY_LABEL[e.weekday] ?? ""})`;
    const list = grouped.get(e.studentId) ?? [];
    list.push(label);
    grouped.set(e.studentId, list);
  }
  const labels = new Map<string, string>();
  for (const [studentId, list] of grouped) labels.set(studentId, list.join(", "));
  return labels;
}

/** Mirrors legacy lib/holiday.php holiday_block_reason(): Sat/Sun auto, else lookup `holidays` table. */
export async function holidayBlockReason(date: Date): Promise<string | null> {
  // TEST-ONLY switch: when set, ignore weekend/holiday blocking so check-in can be
  // exercised on a Sat/Sun/holiday. Runtime env (set in Plesk panel, no rebuild).
  // MUST be unset again after testing, or weekends would allow real check-ins.
  if (process.env.TEST_ALLOW_CHECKIN_ANYDAY === "1") return null;
  const weekday = isoWeekday(date);
  if (weekday === 6) return "วันเสาร์";
  if (weekday === 7) return "วันอาทิตย์";
  const holiday = await prisma.holiday.findUnique({ where: { holidayDate: date } });
  return holiday?.name ?? null;
}

export type DashboardData = {
  students: DashboardRow[];
  stats: DashboardStats;
  allCount: number;
  sessionOpen: boolean;
};

/** Mirrors legacy lib/dashboard_render.php dashboard_load(): today's roster + attendance stats for a classroom. */
export async function loadDashboard(classroomId: number, filter: DashboardFilter): Promise<DashboardData> {
  const today = todayInBangkok();

  const session = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId } },
    select: { id: true },
  });
  const sessionId = session?.id ?? 0;

  const [exemptMap, exemptLabels, scanFailMap, activityTagMap, students] = await Promise.all([
    getExemptMap(classroomId, today),
    getExemptLabels(classroomId),
    getScanFailMap(classroomId),
    getActivityTagMap(classroomId),
    prisma.student.findMany({
      where: { classroomId, status: 1 },
      orderBy: [{ numberInClass: "asc" }, { studentId: "asc" }],
      select: {
        studentId: true,
        fullName: true,
        nickname: true,
        numberInClass: true,
        lineChatId: true,
        attendanceRecords: {
          where: { sessionId },
          select: {
            status: true,
            checkTime: true,
            distanceM: true,
            latitude: true,
            longitude: true,
            isSuspicious: true,
            editReason: true,
          },
        },
      },
    }),
  ]);

  const stats: DashboardStats = {
    present: 0,
    late: 0,
    absent: 0,
    pending: 0,
    flagged: 0,
    review: 0,
    edited: 0,
    excused: 0,
    scanfail: 0,
  };

  const rows: DashboardRow[] = [];
  let allCount = 0;

  for (const student of students) {
    const record = sessionId ? student.attendanceRecords[0] : undefined;
    const hasScanFail = Boolean(record && scanFailMap[student.studentId]);
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

    if (displayStatus in stats) {
      stats[displayStatus as keyof DashboardStats]++;
    }
    if (displayStatus === "pending" || displayStatus === "flagged") stats.review++;
    if (record?.editReason) stats.edited++;
    if (hasScanFail) stats.scanfail++;
    allCount++;

    let show = true;
    if (filter === "pending_review") {
      show = displayStatus === "pending" || displayStatus === "flagged";
    } else if (filter === "edited") {
      show = Boolean(record?.editReason);
    } else if (filter === "scanfail") {
      show = hasScanFail;
    } else if (filter !== "all") {
      show = displayStatus === filter;
    }

    if (show) {
      rows.push({
        studentId: student.studentId,
        fullName: student.fullName,
        nickname: student.nickname,
        numberInClass: student.numberInClass,
        activities: activityTagMap.get(student.studentId) ?? [],
        lineChatId: student.lineChatId,
        displayStatus,
        checkTime: record?.checkTime ?? null,
        distanceM: record?.distanceM ?? null,
        latitude: record?.latitude != null ? Number(record.latitude) : null,
        longitude: record?.longitude != null ? Number(record.longitude) : null,
        isSuspicious: Boolean(record?.isSuspicious),
        editReason: record?.editReason ?? null,
        exemptReason,
        exemptLabel: exemptLabels.get(student.studentId) ?? "",
        scanFailBadge: hasScanFail ? `⚠️ สแกนหน้าไม่ติด · แจ้ง ${scanFailMap[student.studentId].reportedAt}` : null,
      });
    }
  }

  return { students: rows, stats, allCount, sessionOpen: Boolean(session) };
}
