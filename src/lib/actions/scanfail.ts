"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatWallClockTime, nowInBangkok } from "@/lib/time";
import { getActiveLocation } from "@/lib/checkin";
import { haversineDistance } from "@/lib/geo";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export type ScanFailGeo = { distanceMeters: number | null; outsideRadius: boolean; radius: number };

export type ReportScanFailResult =
  | ({ ok: true; message: string; reportedAt: string } & ScanFailGeo)
  | { ok: false; message: string };

export type ScanFailBadgeMap = Record<string, { reportedAt: string }>;

export type UnmatchedScanFailReport = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  reportedAt: string;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  outsideRadius: boolean;
  radius: number;
};

function cleanCoordinate(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatScanFailTime(reportedAt: Date): string {
  return formatWallClockTime(reportedAt).replace(" น.", "");
}

/** Distance of a report's coords vs the classroom check-in point, and whether it's beyond the configured alert radius. */
export async function computeScanFailGeo(
  classroomId: number,
  lat: number | null,
  lng: number | null,
): Promise<ScanFailGeo> {
  const location = await getActiveLocation(classroomId);
  const alertSetting = await prisma.systemSetting.findUnique({ where: { settingKey: "scanfail_alert_radius_m" } });
  const parsedAlert = Number(alertSetting?.settingValue);
  const alertRadius = Number.isFinite(parsedAlert) && parsedAlert > 0 ? parsedAlert : location.radius;
  const distanceMeters =
    lat !== null && lng !== null ? Math.round(haversineDistance(lat, lng, location.lat, location.lng)) : null;
  return { distanceMeters, outsideRadius: distanceMeters !== null && distanceMeters > alertRadius, radius: alertRadius };
}

export async function reportScanFail(
  lat?: number | null,
  lng?: number | null,
  accuracy?: number | null,
): Promise<ReportScanFailResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const student = await prisma.student.findUniqueOrThrow({ where: { studentId: session.id } });
  const { dateOnly: today, wallClock: now } = nowInBangkok();

  const existing = await prisma.scanFailReport.findUnique({
    where: { studentId_sessionDate: { studentId: student.studentId, sessionDate: today } },
    select: { reportedAt: true, latitude: true, longitude: true },
  });

  if (existing) {
    const geo = await computeScanFailGeo(student.classroomId, existing.latitude, existing.longitude);
    return {
      ok: true,
      message: `คุณได้แจ้งสแกนหน้าไม่ติดของวันนี้ไว้แล้ว (เวลา ${formatScanFailTime(existing.reportedAt)})`,
      reportedAt: formatScanFailTime(existing.reportedAt),
      ...geo,
    };
  }

  const report = await prisma.scanFailReport.create({
    data: {
      studentId: student.studentId,
      sessionDate: today,
      reportedAt: now,
      latitude: cleanCoordinate(lat),
      longitude: cleanCoordinate(lng),
      accuracy: cleanCoordinate(accuracy),
    },
    select: { reportedAt: true },
  });

  await prisma.attendanceLog.create({
    data: {
      studentId: student.studentId,
      eventType: "settings_changed",
      detail: `นักเรียนแจ้งสแกนหน้าไม่ติด เวลา ${formatScanFailTime(report.reportedAt)}`,
    },
  });

  const geo = await computeScanFailGeo(student.classroomId, cleanCoordinate(lat), cleanCoordinate(lng));

  revalidatePath(`/classrooms/${student.classroomId}`);

  return {
    ok: true,
    message: `บันทึกแจ้งสแกนหน้าไม่ติดของวันนี้แล้ว (เวลา ${formatScanFailTime(report.reportedAt)})`,
    reportedAt: formatScanFailTime(report.reportedAt),
    ...geo,
  };
}

export async function getMyScanFailToday(): Promise<{ reportedAt: string } | null> {
  const session = await requireSession();
  if (session.role !== "student") return null;

  const { dateOnly: today } = nowInBangkok();
  const existing = await prisma.scanFailReport.findUnique({
    where: { studentId_sessionDate: { studentId: session.id, sessionDate: today } },
    select: { reportedAt: true },
  });
  return existing ? { reportedAt: formatScanFailTime(existing.reportedAt) } : null;
}

export async function cancelMyScanFail(): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const student = await prisma.student.findUniqueOrThrow({ where: { studentId: session.id } });
  const { dateOnly: today } = nowInBangkok();

  const existing = await prisma.scanFailReport.findUnique({
    where: { studentId_sessionDate: { studentId: student.studentId, sessionDate: today } },
    select: { id: true },
  });
  if (!existing) return { ok: true, message: "ไม่มีการแจ้งสแกนหน้าไม่ติดของวันนี้" };

  await prisma.scanFailReport.delete({ where: { id: existing.id } });
  await prisma.attendanceLog.create({
    data: {
      studentId: student.studentId,
      eventType: "settings_changed",
      detail: "นักเรียนยกเลิกการแจ้งสแกนหน้าไม่ติด",
    },
  });

  revalidatePath(`/classrooms/${student.classroomId}`);
  return { ok: true, message: "ยกเลิกการแจ้งสแกนหน้าไม่ติดแล้ว" };
}

export async function getScanFailMap(classroomId: number): Promise<ScanFailBadgeMap> {
  const { dateOnly: today } = nowInBangkok();
  const reports = await prisma.scanFailReport.findMany({
    where: { sessionDate: today, student: { classroomId, status: 1 } },
    select: { studentId: true, reportedAt: true },
  });

  const map: ScanFailBadgeMap = {};
  for (const report of reports) {
    map[report.studentId] = { reportedAt: formatScanFailTime(report.reportedAt) };
  }
  return map;
}

export async function getUnmatchedScanFailReports(classroomId: number): Promise<UnmatchedScanFailReport[]> {
  const { dateOnly: today } = nowInBangkok();
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId } },
    select: { id: true },
  });
  const studentWhere = session
    ? { classroomId, status: 1, attendanceRecords: { none: { sessionId: session.id } } }
    : { classroomId, status: 1 };

  const reports = await prisma.scanFailReport.findMany({
    where: {
      sessionDate: today,
      student: studentWhere,
    },
    orderBy: { reportedAt: "asc" },
    select: {
      studentId: true,
      reportedAt: true,
      latitude: true,
      longitude: true,
      student: { select: { fullName: true, nickname: true, numberInClass: true } },
    },
  });

  const location = await getActiveLocation(classroomId);
  // Separate, configurable alert radius; empty/invalid falls back to the classroom check-in radius.
  const alertSetting = await prisma.systemSetting.findUnique({ where: { settingKey: "scanfail_alert_radius_m" } });
  const parsedAlert = Number(alertSetting?.settingValue);
  const alertRadius = Number.isFinite(parsedAlert) && parsedAlert > 0 ? parsedAlert : location.radius;

  return reports.map((report) => {
    const hasCoords = report.latitude !== null && report.longitude !== null;
    const distanceMeters = hasCoords
      ? Math.round(haversineDistance(report.latitude!, report.longitude!, location.lat, location.lng))
      : null;
    return {
      studentId: report.studentId,
      fullName: report.student.fullName,
      nickname: report.student.nickname,
      numberInClass: report.student.numberInClass,
      reportedAt: formatScanFailTime(report.reportedAt),
      latitude: report.latitude,
      longitude: report.longitude,
      distanceMeters,
      outsideRadius: distanceMeters !== null && distanceMeters > alertRadius,
      radius: alertRadius,
    };
  });
}
