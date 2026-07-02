import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseDateInput, todayInBangkok } from "@/lib/time";
import { buildReportCsvRows } from "@/lib/report";

function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvLine(fields: (string | number)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

/** Mirrors legacy teacher/report.php's action=export_csv: UTF-8 BOM + one CSV row per session_date x student. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) return new NextResponse("Not found", { status: 404 });

  const session = await getSession();
  if (!session || session.role !== "teacher") return new NextResponse("Unauthorized", { status: 401 });

  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom || classroom.advisorId !== Number(session.id)) return new NextResponse("Forbidden", { status: 403 });

  const { searchParams } = req.nextUrl;
  const today = todayInBangkok();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const startDate = parseDateInput(searchParams.get("start_date") ?? "") ?? monthStart;
  const endDate = parseDateInput(searchParams.get("end_date") ?? "") ?? today;

  const rows = await buildReportCsvRows(classroomId, startDate, endDate);

  let csv = "﻿";
  csv += csvLine([
    "วันที่บันทึก",
    "ห้องเรียน",
    "เลขที่",
    "รหัสนักเรียน",
    "ชื่อ-นามสกุล",
    "สถานะการเช็คชื่อ",
    "เวลาที่เช็ค",
    "ระยะทางพิกัด (เมตร)",
    "สถานะน่าสงสัย (1=ผิดปกติ)",
    "เหตุผลแก้ไขโดยครู",
    "ครูผู้แก้ไข",
  ]);
  for (const row of rows) {
    csv += csvLine([
      row.sessionDate,
      row.roomName,
      row.numberInClass ?? "-",
      row.studentId,
      row.fullName,
      row.statusText,
      row.checkTime,
      row.distanceM,
      row.suspiciousText,
      row.editReason,
      row.editorName,
    ]);
  }

  const safeRoomName = classroom.roomName.replace(/[\\/]/g, "-");
  const filename = `report_m${safeRoomName}_${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
