import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { holidayBlockReason } from "@/lib/dashboard";
import { formatWallClockDate, nowInBangkok } from "@/lib/time";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function ClassroomSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect(`/classrooms/${classroomId}`);

  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } });
  if (!classroom || classroom.advisorId !== Number(session.id)) redirect(`/classrooms/${classroomId}`);

  const { dateOnly: today } = nowInBangkok();
  const [settingsRows, todaySession, holiday, holidays, locations] = await Promise.all([
    prisma.systemSetting.findMany(),
    prisma.attendanceSession.findUnique({ where: { sessionDate_classroomId: { sessionDate: today, classroomId } } }),
    holidayBlockReason(today),
    prisma.holiday.findMany({ where: { holidayDate: { gte: today } }, orderBy: { holidayDate: "asc" } }),
    prisma.checkinLocation.findMany({ where: { classroomId }, orderBy: [{ isActive: "desc" }, { id: "asc" }] }),
  ]);

  const settings = Object.fromEntries(settingsRows.map((s) => [s.settingKey, s.settingValue]));

  return (
    <SettingsClient
      classroomId={classroomId}
      roomName={classroom.roomName}
      fullName={classroom.advisor?.fullName ?? ""}
      settings={{
        dome_lat: settings.dome_lat ?? "17.1968614",
        dome_lng: settings.dome_lng ?? "104.0849387",
        radius_m: settings.radius_m ?? "400",
        check_start: settings.check_start ?? "07:45",
        late_after: settings.late_after ?? "08:00",
        check_end: settings.check_end ?? "08:15",
      }}
      sessionOpen={Boolean(todaySession)}
      holiday={holiday}
      holidays={holidays.map((h) => ({ dateStr: h.holidayDate.toISOString().slice(0, 10), label: formatWallClockDate(h.holidayDate), name: h.name }))}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        lat: Number(l.latitude),
        lng: Number(l.longitude),
        radius: l.radiusM,
        isActive: l.isActive === 1,
      }))}
    />
  );
}
