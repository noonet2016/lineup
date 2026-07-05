"use server";

import { prisma } from "./prisma";
import { holidayBlockReason } from "./dashboard";
import { requireSession } from "./session";
import { formatWallClockDate, formatWallClockTime, nowInBangkok } from "./time";
import { haversineDistance } from "./geo";

/** Prisma @db.Time(0) columns come back as Date objects with only the time-of-day meaningful; read it in UTC (no TZ shift). */
function timeToHms(time: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())}:${pad(time.getUTCSeconds())}`;
}

function hmsToDate(hms: string): Date {
  const [h, m, s] = hms.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, s ?? 0));
}

export type ActiveLocation = { name: string; lat: number; lng: number; radius: number };

/** Mirrors legacy lib/location.php get_active_location(): the classroom's active check-in point, else the school-wide dome fallback. */
export async function getActiveLocation(classroomId: number): Promise<ActiveLocation> {
  const loc = await prisma.checkinLocation.findFirst({
    where: { classroomId, isActive: 1 },
    orderBy: { id: "desc" },
  });
  if (loc) {
    return { name: loc.name, lat: Number(loc.latitude), lng: Number(loc.longitude), radius: loc.radiusM };
  }

  const settings = await prisma.systemSetting.findMany();
  const map = new Map(settings.map((s) => [s.settingKey, s.settingValue]));
  return {
    name: "โดมโรงเรียน",
    lat: Number(map.get("dome_lat") ?? 17.1968614),
    lng: Number(map.get("dome_lng") ?? 104.0849387),
    radius: Number(map.get("radius_m") ?? 400),
  };
}

/**
 * Effective time window for a classroom: per-room override (classrooms.check_start/late_after/check_end)
 * falls back to the school-wide system_settings, then hard defaults. Mirrors resolveClassroomTimes() in
 * settings.ts so auto-opening a session on student check-in uses the SAME room times as the teacher's
 * manual "open round" — previously this read only the school defaults, ignoring per-room times.
 */
async function getTimeWindow(classroomId: number): Promise<{ start: string; lateAfter: string; end: string }> {
  const [classroom, settings] = await Promise.all([
    prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { checkStart: true, lateAfter: true, checkEnd: true },
    }),
    prisma.systemSetting.findMany(),
  ]);
  const map = new Map(settings.map((s) => [s.settingKey, s.settingValue]));
  return {
    start: classroom?.checkStart ?? map.get("check_start") ?? "07:45",
    lateAfter: classroom?.lateAfter ?? map.get("late_after") ?? "08:00",
    end: classroom?.checkEnd ?? map.get("check_end") ?? "08:15",
  };
}

async function logEvent(studentId: string | null, eventType: string, detail: string): Promise<void> {
  await prisma.attendanceLog.create({ data: { studentId, eventType, detail } });
}

export type LocateResult =
  | { inRadius: true; gpsWeak: false; distance: number; message: string }
  | { gpsWeak: true; distance: number | null; message: string }
  | { inRadius: false; gpsWeak: false; distance: number; message: string };

/** Mirrors legacy student/checkin_locate.php step 1: distance-only preview, no DB write except the out-of-radius log. */
export async function locateCheckin(lat: number | null, lng: number | null, accuracy: number | null): Promise<LocateResult> {
  const session = await requireSession();
  if (session.role !== "student") throw new Error("เฉพาะนักเรียนเท่านั้น");

  const student = await prisma.student.findUniqueOrThrow({ where: { studentId: session.id } });
  const location = await getActiveLocation(student.classroomId);

  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { gpsWeak: true, distance: null, message: "พิกัด GPS อ่อนหรือไม่แม่นยำ จะส่งให้ครูที่ปรึกษายืนยัน" };
  }

  const distance = haversineDistance(lat, lng, location.lat, location.lng);

  if (accuracy !== null && accuracy > 100) {
    return { gpsWeak: true, distance: Math.round(distance), message: "สัญญาณ GPS ของท่านมีความคลาดเคลื่อนสูง จะถูกจัดอยู่ในสถานะรอตรวจ" };
  }

  if (distance <= location.radius) {
    return { inRadius: true, gpsWeak: false, distance: Math.round(distance), message: "คุณอยู่ในพื้นที่เข้าแถวที่กำหนดเรียบร้อยแล้ว" };
  }

  await logEvent(student.studentId, "out_of_radius", `พิกัด: (${lat}, ${lng}) ห่างจากโรงเรียน ${Math.round(distance)} เมตร เกินกว่ารัศมีที่กำหนดที่ ${location.radius} เมตร`);
  return { inRadius: false, gpsWeak: false, distance: Math.round(distance), message: "คุณไม่ได้อยู่ในรัศมีที่กำหนด" };
}

export type SubmitResult = { ok: true; message: string } | { ok: false; message: string };

const STATUS_LABEL: Record<string, string> = {
  present: "มาปกติ",
  late: "สาย",
  pending: "รอตรวจสอบ (สัญญาณพิกัดขัดข้อง)",
  flagged: "รอตรวจสอบ (อยู่นอกรัศมีที่ตั้งไว้)",
};

function formatThaiDateTime(date: Date): string {
  return `${formatWallClockDate(date)} ${formatWallClockTime(date, true)}`;
}

/**
 * Mirrors legacy student/checkin_submit.php step 2: re-derives distance from the coordinates the client
 * just captured (no server-side "pending GPS" session state — the client re-sends what it captured),
 * auto-opens today's session within the time window, decides present/late/pending/flagged, and inserts
 * the attendance_record. No device-approval gate (that legacy system is intentionally dropped — LINE
 * Login identity binding from M3 is the replacement).
 */
export async function submitCheckin(lat: number | null, lng: number | null, accuracy: number | null): Promise<SubmitResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const student = await prisma.student.findUniqueOrThrow({ where: { studentId: session.id } });
  const { dateOnly: today, hms: nowHms, wallClock: checkTime } = nowInBangkok();

  const holiday = await holidayBlockReason(today);
  let attendanceSession = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: student.classroomId } },
  });

  if (!attendanceSession) {
    if (holiday !== null) {
      await logEvent(student.studentId, "out_of_time", `พยายามเช็คชื่อในวันหยุด (${holiday})`);
      return { ok: false, message: `วันนี้เป็นวันหยุด (${holiday}) จึงไม่มีการเช็คชื่อเข้าแถว` };
    }

    const { start, lateAfter, end } = await getTimeWindow(student.classroomId);
    if (nowHms < start) return { ok: false, message: `ยังไม่ถึงเวลาเริ่มบันทึกเข้าแถว (${start.slice(0, 5)} น.)` };
    if (nowHms > end) return { ok: false, message: `หมดเวลาเช็คชื่อเข้าแถวของวันนี้แล้ว ปิดระบบเมื่อเวลา ${end.slice(0, 5)} น.` };

    attendanceSession = await prisma.attendanceSession.create({
      data: {
        sessionDate: today,
        classroomId: student.classroomId,
        startTime: hmsToDate(start),
        lateAfter: hmsToDate(lateAfter),
        endTime: hmsToDate(end),
        dailyCode: "active",
      },
    });
    await logEvent(null, "settings_changed", `ระบบทำการเปิดรอบลงทะเบียนเข้าแถวห้อง id ${student.classroomId} อัตโนมัติในวันเรียน`);
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: attendanceSession.id, studentId: student.studentId } },
  });
  if (existing) {
    const label = STATUS_LABEL[existing.status] ?? existing.status;
    return {
      ok: true,
      message: `คุณได้ทำการเช็คชื่อเข้าแถวในวันนี้เรียบร้อยแล้ว<br>สถานะ: <strong>${label}</strong>${existing.checkTime ? `<br><span class="text-sm text-emerald-400 font-semibold mt-2 block">เมื่อ: ${formatThaiDateTime(existing.checkTime)}</span>` : ""}`,
    };
  }

  const startHms = timeToHms(attendanceSession.startTime);
  const lateAfterHms = timeToHms(attendanceSession.lateAfter);
  const endHms = timeToHms(attendanceSession.endTime);

  if (nowHms < startHms) {
    await logEvent(student.studentId, "out_of_time", `พยายามเช็คชื่อก่อนเวลาเริ่ม (${nowHms} < ${startHms})`);
    return { ok: false, message: `ยังไม่ถึงเวลาเริ่มบันทึกเข้าแถว (${startHms.slice(0, 5)} น.)` };
  }
  if (nowHms > endHms) {
    await logEvent(student.studentId, "out_of_time", `พยายามเช็คชื่อหลังปิดระบบ (${nowHms} > ${endHms})`);
    return { ok: false, message: `หมดเวลาเช็คชื่อในวันนี้แล้ว ปิดระบบเมื่อเวลา ${endHms.slice(0, 5)} น.` };
  }

  const timeStatus = nowHms >= lateAfterHms ? "late" : "present";

  let finalStatus = timeStatus;
  let isSuspicious = false;
  let distance: number | null = null;
  const gpsWeak = lat === null || lng === null || (accuracy !== null && accuracy > 100);

  if (gpsWeak) {
    await logEvent(student.studentId, "gps_denied", "พยายามเช็คชื่อด้วยสัญญาณ GPS อ่อนหรือไม่มีพิกัด — ถูกปฏิเสธ ต้องแก้ไขสิทธิ์ตำแหน่งก่อน");
    return {
      ok: false,
      message: "ไม่สามารถตรวจสอบพิกัดของคุณได้ กรุณาตรวจสอบว่าเปิดสิทธิ์การเข้าถึงตำแหน่ง (Location Permission) แล้ว และลองใหม่อีกครั้ง",
    };
  }

  const location = await getActiveLocation(student.classroomId);
  distance = haversineDistance(lat!, lng!, location.lat, location.lng);
  if (distance > location.radius) {
    finalStatus = "flagged";
    isSuspicious = true;
    await logEvent(student.studentId, "out_of_radius", `เช็คอินนอกรัศมี: ห่าง ${Math.round(distance)} เมตร สภาพถูกจัดไว้ให้รอครูตรวจ`);
  }

  await prisma.attendanceRecord.create({
    data: {
      sessionId: attendanceSession.id,
      studentId: student.studentId,
      status: finalStatus,
      checkTime,
      latitude: lat,
      longitude: lng,
      distanceM: distance !== null ? Math.round(distance) : null,
      isSuspicious: isSuspicious ? 1 : 0,
    },
  });

  await logEvent(student.studentId, "checkin_success", `เช็คชื่อสำเร็จ สถานะ: ${finalStatus} ระยะห่าง: ${distance !== null ? `${Math.round(distance)} ม.` : "ไม่ระบุ"}`);

  const label = STATUS_LABEL[finalStatus] ?? finalStatus;
  return {
    ok: true,
    message: `บันทึกเช็คชื่อเข้าแถวสำเร็จ: สถานะของคุณคือ "<strong>${label}</strong>"<br><span class="text-sm text-emerald-400 font-semibold mt-2 block">เมื่อ: ${formatThaiDateTime(checkTime)}</span>`,
  };
}
