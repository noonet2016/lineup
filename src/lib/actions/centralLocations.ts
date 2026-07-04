"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireTeacherClassroom } from "@/lib/teacher";
import type { ActionResult } from "./settings";

function parseCentralLocationFields(formData: FormData): { name: string; lat: number; lng: number; radius: number; isActive: number } | null {
  const name = String(formData.get("loc_name") ?? "").trim();
  const lat = Number(formData.get("loc_lat"));
  const lng = Number(formData.get("loc_lng"));
  const radius = Number(formData.get("loc_radius"));
  const isActive = formData.get("loc_active") ? 1 : 0;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isInteger(radius)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || radius <= 0) return null;
  return { name, lat, lng, radius, isActive };
}

export async function createCentralLocation(formData: FormData): Promise<ActionResult> {
  await requireOwner();
  const fields = parseCentralLocationFields(formData);
  if (!fields) return { ok: false, message: "ข้อมูลจุดเข้าแถวส่วนกลางไม่ถูกต้อง" };

  await prisma.centralLocation.create({
    data: {
      name: fields.name,
      latitude: fields.lat,
      longitude: fields.lng,
      radiusM: fields.radius,
      isActive: fields.isActive,
    },
  });

  revalidatePath("/admin");
  return { ok: true, message: `เพิ่มจุดเข้าแถวส่วนกลาง "${fields.name}" เรียบร้อยแล้ว` };
}

export async function updateCentralLocation(locationId: number, formData: FormData): Promise<ActionResult> {
  await requireOwner();
  const fields = parseCentralLocationFields(formData);
  if (!fields) return { ok: false, message: "ข้อมูลจุดเข้าแถวส่วนกลางไม่ถูกต้อง" };

  const result = await prisma.centralLocation.updateMany({
    where: { id: locationId },
    data: {
      name: fields.name,
      latitude: fields.lat,
      longitude: fields.lng,
      radiusM: fields.radius,
      isActive: fields.isActive,
    },
  });
  if (result.count === 0) return { ok: false, message: "ไม่พบจุดเข้าแถวส่วนกลางที่ต้องการแก้ไข" };

  revalidatePath("/admin");
  return { ok: true, message: `แก้ไขจุดเข้าแถวส่วนกลาง "${fields.name}" เรียบร้อยแล้ว` };
}

export async function deleteCentralLocation(locationId: number): Promise<ActionResult> {
  await requireOwner();
  const result = await prisma.centralLocation.deleteMany({ where: { id: locationId } });
  if (result.count === 0) return { ok: false, message: "ไม่พบจุดเข้าแถวส่วนกลางที่ต้องการลบ" };

  revalidatePath("/admin");
  return { ok: true, message: "ลบจุดเข้าแถวส่วนกลางเรียบร้อยแล้ว" };
}

export async function importCentralLocation(centralLocationId: number): Promise<ActionResult> {
  const teacher = await requireTeacherClassroom();
  const central = await prisma.centralLocation.findFirst({ where: { id: centralLocationId, isActive: 1 } });
  if (!central) return { ok: false, message: "ไม่พบจุดเข้าแถวส่วนกลางที่เลือก หรือจุดนี้ไม่ได้เปิดใช้งาน" };

  const existing = await prisma.checkinLocation.findFirst({
    where: { classroomId: teacher.classroomId, name: central.name },
    select: { id: true },
  });
  if (existing) return { ok: true, message: `ห้องนี้มีจุด "${central.name}" อยู่แล้ว จึงไม่ได้นำเข้าซ้ำ` };

  await prisma.checkinLocation.create({
    data: {
      classroomId: teacher.classroomId,
      name: central.name,
      latitude: central.latitude,
      longitude: central.longitude,
      radiusM: central.radiusM,
      isActive: 0,
    },
  });

  revalidatePath(`/classrooms/${teacher.classroomId}/settings`);
  return { ok: true, message: `ดึงจุดเข้าแถว "${central.name}" เข้าห้องเรียบร้อยแล้ว` };
}
