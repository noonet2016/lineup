"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacherClassroom } from "@/lib/teacher";
import { holidayBlockReason } from "@/lib/dashboard";
import { nowInBangkok } from "@/lib/time";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function hmsToDate(hms: string): Date {
  const [h, m, s] = hms.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, s ?? 0));
}

/** Mirrors legacy teacher/settings.php action=generate_code. */
export async function openTodaySession(): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const { dateOnly: today } = nowInBangkok();

  const existing = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: teacher.classroomId } },
  });
  if (existing) return { ok: true, message: "รอบเช็คชื่อวันนี้เปิดอยู่แล้ว!" };

  const holiday = await holidayBlockReason(today);
  if (holiday !== null) return { ok: false, message: `วันนี้เป็นวันหยุด (${holiday}) ไม่สามารถเปิดรอบได้` };

  const settings = await prisma.systemSetting.findMany();
  const map = new Map(settings.map((s) => [s.settingKey, s.settingValue]));
  const start = map.get("check_start") ?? "07:45";
  const lateAfter = map.get("late_after") ?? "08:00";
  const end = map.get("check_end") ?? "08:15";

  await prisma.attendanceSession.create({
    data: {
      sessionDate: today,
      classroomId: teacher.classroomId,
      startTime: hmsToDate(start),
      lateAfter: hmsToDate(lateAfter),
      endTime: hmsToDate(end),
      dailyCode: "active",
    },
  });
  await prisma.attendanceLog.create({
    data: { studentId: null, eventType: "settings_changed", detail: `เปิดรอบเช็คชื่อห้อง id ${teacher.classroomId} ด้วยตนเอง` },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}`);
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "เปิดรอบเช็คชื่อเข้าแถวประจำวันนี้สำเร็จ!" };
}

/** Mirrors legacy action=update_settings. Global (school-wide), not per-classroom, matching legacy system_settings.
 *  dome_lat/dome_lng/radius_m are no longer editable here — the locations tab replaces them; those keys stay in
 *  the DB untouched as the fallback `getActiveLocation()` uses when a classroom has no active checkin_location. */
export async function updateSystemSettings(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const fields = ["check_start", "late_after", "check_end"] as const;
  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = String(formData.get(f) ?? "").trim();
    if (!v) return { ok: false, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" };
    values[f] = v;
  }

  // Optional: scan-fail alert radius (meters). Empty = fall back to the classroom check-in radius.
  const scanRadiusRaw = String(formData.get("scanfail_alert_radius_m") ?? "").trim();
  if (scanRadiusRaw !== "") {
    const scanRadius = Number(scanRadiusRaw);
    if (!Number.isInteger(scanRadius) || scanRadius <= 0) {
      return { ok: false, message: "รัศมีแจ้งสแกนหน้าต้องเป็นจำนวนเต็มบวก" };
    }
    values.scanfail_alert_radius_m = String(scanRadius);
  }

  const keysToSave = scanRadiusRaw !== "" ? [...fields, "scanfail_alert_radius_m"] : [...fields];
  await Promise.all(
    keysToSave.map((f) => prisma.systemSetting.upsert({ where: { settingKey: f }, update: { settingValue: values[f] }, create: { settingKey: f, settingValue: values[f] } })),
  );

  const { dateOnly: today } = nowInBangkok();
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionDate_classroomId: { sessionDate: today, classroomId: teacher.classroomId } },
  });
  if (session) {
    await prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        startTime: hmsToDate(values.check_start),
        lateAfter: hmsToDate(values.late_after),
        endTime: hmsToDate(values.check_end),
      },
    });
  }

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "บันทึกข้อมูลตั้งค่าระบบและรอบเช็คชื่อวันนี้สำเร็จ!" };
}

/** Mirrors legacy action=add_holiday (upsert by date). */
export async function addHoliday(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const dateStr = String(formData.get("holiday_date") ?? "").trim();
  const name = String(formData.get("holiday_name") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, message: "รูปแบบวันที่ไม่ถูกต้อง" };
  if (!name) return { ok: false, message: "กรุณาระบุชื่อวันหยุด" };

  const [y, m, d] = dateStr.split("-").map(Number);
  const holidayDate = new Date(Date.UTC(y, m - 1, d));

  await prisma.holiday.upsert({
    where: { holidayDate },
    update: { name },
    create: { holidayDate, name, createdBy: teacher.teacherId },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: `บันทึกวันหยุด "${name}" เรียบร้อยแล้ว` };
}

/** Mirrors legacy action=delete_holiday. Global (not classroom-scoped), matching legacy. */
export async function deleteHoliday(dateStr: string): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, message: "รูปแบบวันที่ไม่ถูกต้อง" };
  const [y, m, d] = dateStr.split("-").map(Number);
  const holidayDate = new Date(Date.UTC(y, m - 1, d));

  await prisma.holiday.deleteMany({ where: { holidayDate } });
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "ลบวันหยุดเรียบร้อยแล้ว" };
}

function parseLocationFields(formData: FormData): { name: string; lat: number; lng: number; radius: number } | null {
  const name = String(formData.get("loc_name") ?? "").trim();
  const lat = Number(formData.get("loc_lat"));
  const lng = Number(formData.get("loc_lng"));
  const radius = Number(formData.get("loc_radius"));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isInteger(radius)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || radius <= 0) return null;
  return { name, lat, lng, radius };
}

/** Mirrors legacy action=add_location — first location for a classroom becomes active automatically. */
export async function addLocation(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const fields = parseLocationFields(formData);
  if (!fields) return { ok: false, message: "ข้อมูลจุดเข้าแถวไม่ถูกต้อง" };

  const count = await prisma.checkinLocation.count({ where: { classroomId: teacher.classroomId } });
  await prisma.checkinLocation.create({
    data: {
      classroomId: teacher.classroomId,
      name: fields.name,
      latitude: fields.lat,
      longitude: fields.lng,
      radiusM: fields.radius,
      isActive: count === 0 ? 1 : 0,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: `เพิ่มจุดเข้าแถว "${fields.name}" เรียบร้อยแล้ว` };
}

/** Mirrors legacy action=edit_location — fixes the legacy soft-success bug: reports failure if the row wasn't found/owned. */
export async function editLocation(locationId: number, formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const fields = parseLocationFields(formData);
  if (!fields) return { ok: false, message: "ข้อมูลจุดเข้าแถวไม่ถูกต้อง" };

  const result = await prisma.checkinLocation.updateMany({
    where: { id: locationId, classroomId: teacher.classroomId },
    data: { name: fields.name, latitude: fields.lat, longitude: fields.lng, radiusM: fields.radius },
  });
  if (result.count === 0) return { ok: false, message: "ไม่พบจุดที่ต้องการแก้ไข หรือไม่ใช่ห้องของคุณ" };

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: `แก้ไขจุดเข้าแถว "${fields.name}" เรียบร้อยแล้ว` };
}

/**
 * Mirrors legacy action=set_active_location — fixes the legacy bug where the target row's
 * ownership wasn't validated before clearing every other location's is_active flag (risking a
 * classroom left with zero active locations). Here the ownership check runs inside the same
 * transaction, before anything is cleared.
 */
export async function setActiveLocation(locationId: number): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.checkinLocation.findFirst({ where: { id: locationId, classroomId: teacher.classroomId } });
    if (!target) return null;
    await tx.checkinLocation.updateMany({ where: { classroomId: teacher.classroomId }, data: { isActive: 0 } });
    await tx.checkinLocation.update({ where: { id: locationId }, data: { isActive: 1 } });
    return target;
  });

  if (!result) return { ok: false, message: "ไม่พบจุดที่เลือก หรือไม่ใช่ห้องของคุณ" };
  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "เปลี่ยนจุดเข้าแถวที่ใช้งานเรียบร้อยแล้ว" };
}

/** Mirrors legacy action=delete_location — auto-promotes the oldest remaining location to active if the deleted one was active. */
export async function deleteLocation(locationId: number): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();

  const target = await prisma.checkinLocation.findFirst({ where: { id: locationId, classroomId: teacher.classroomId } });
  if (!target) return { ok: false, message: "ไม่พบจุดที่ต้องการลบ หรือไม่ใช่ห้องของคุณ" };

  await prisma.checkinLocation.delete({ where: { id: locationId } });

  if (target.isActive === 1) {
    const next = await prisma.checkinLocation.findFirst({
      where: { classroomId: teacher.classroomId },
      orderBy: { id: "asc" },
    });
    if (next) await prisma.checkinLocation.update({ where: { id: next.id }, data: { isActive: 1 } });
  }

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: "ลบจุดเข้าแถวเรียบร้อยแล้ว" };
}
