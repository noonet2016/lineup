"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatWallClockTime, nowInBangkok } from "@/lib/time";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export type ScanFailBadgeMap = Record<string, { reportedAt: string }>;

export type UnmatchedScanFailReport = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  reportedAt: string;
  latitude: number | null;
  longitude: number | null;
};

function cleanCoordinate(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatScanFailTime(reportedAt: Date): string {
  return formatWallClockTime(reportedAt).replace(" น.", "");
}

export async function reportScanFail(
  lat?: number | null,
  lng?: number | null,
  accuracy?: number | null,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "เฉพาะนักเรียนเท่านั้น" };

  const student = await prisma.student.findUniqueOrThrow({ where: { studentId: session.id } });
  const { dateOnly: today, wallClock: now } = nowInBangkok();

  const existing = await prisma.scanFailReport.findUnique({
    where: { studentId_sessionDate: { studentId: student.studentId, sessionDate: today } },
    select: { reportedAt: true },
  });

  if (existing) {
    return {
      ok: true,
      message: `คุณได้แจ้งสแกนหน้าไม่ติดของวันนี้ไว้แล้ว (เวลา ${formatScanFailTime(existing.reportedAt)})`,
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

  revalidatePath(`/classrooms/${student.classroomId}`);

  return {
    ok: true,
    message: `บันทึกแจ้งสแกนหน้าไม่ติดของวันนี้แล้ว (เวลา ${formatScanFailTime(report.reportedAt)})`,
  };
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

  return reports.map((report) => ({
    studentId: report.studentId,
    fullName: report.student.fullName,
    nickname: report.student.nickname,
    numberInClass: report.student.numberInClass,
    reportedAt: formatScanFailTime(report.reportedAt),
    latitude: report.latitude,
    longitude: report.longitude,
  }));
}
