import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AdminShell } from "../../_components/LegacyChrome";
import AdminClient from "../AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect("/checkin");
  const me = await prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { id: true, fullName: true, role: true } });
  if (!me || me.role !== "admin") redirect("/account");

  const [teachers, activities, students, centralSettings, classroomOverrideCount] = await Promise.all([
    prisma.teacher.findMany({ orderBy: { id: "asc" }, select: { id: true, username: true, fullName: true, role: true, advisedClassrooms: { select: { id: true, roomName: true, _count: { select: { students: true, sessions: true } } }, orderBy: { id: "asc" } } } }),
    prisma.schoolActivity.findMany({ orderBy: [{ id: "asc" }], select: { id: true, name: true, color: true, isActive: true, exemptAssembly: true, _count: { select: { members: true } }, members: { select: { studentId: true } } } }),
    prisma.student.findMany({ where: { status: 1 }, orderBy: [{ classroomId: "asc" }, { numberInClass: "asc" }, { studentId: "asc" }], select: { studentId: true, fullName: true, nickname: true, classroom: { select: { id: true, roomName: true } } } }),
    prisma.systemSetting.findMany({ where: { settingKey: { in: ["dome_lat", "dome_lng", "radius_m", "scanfail_alert_radius_m", "check_start", "late_after", "check_end"] } } }),
    prisma.classroom.count({ where: { locations: { some: { isActive: 1 } } } }),
  ]);
  const settings = new Map(centralSettings.map((setting) => [setting.settingKey, setting.settingValue]));
  const centralScanFailRadius = Number(settings.get("scanfail_alert_radius_m"));

  return (
    <AdminShell active="settings" fullName={me.fullName}>
      <AdminClient
        adminId={me.id}
        teachers={teachers.map((teacher) => ({ id: teacher.id, username: teacher.username, fullName: teacher.fullName, role: teacher.role, rooms: teacher.advisedClassrooms.map((classroom) => classroom.roomName), roomsDetailed: teacher.advisedClassrooms.map((classroom) => ({ id: classroom.id, roomName: classroom.roomName })), studentCount: teacher.advisedClassrooms.reduce((count, classroom) => count + classroom._count.students, 0), sessionCount: teacher.advisedClassrooms.reduce((count, classroom) => count + classroom._count.sessions, 0) }))}
        activities={activities.map((activity) => ({ id: activity.id, name: activity.name, color: activity.color, isActive: activity.isActive, exemptAssembly: activity.exemptAssembly, memberIds: activity.members.map((member) => member.studentId), memberCount: activity._count.members }))}
        students={students.map((student) => ({ studentId: student.studentId, fullName: student.fullName, nickname: student.nickname, classroomId: student.classroom.id, roomName: student.classroom.roomName }))}
        centralPoint={{ lat: Number(settings.get("dome_lat") ?? 17.1968614), lng: Number(settings.get("dome_lng") ?? 104.0849387), radiusM: Number(settings.get("radius_m") ?? 400), overrideCount: classroomOverrideCount }}
        centralScanFailRadiusM={Number.isInteger(centralScanFailRadius) && centralScanFailRadius > 0 ? centralScanFailRadius : null}
        generalSettings={{ checkStart: settings.get("check_start") ?? "07:45", lateAfter: settings.get("late_after") ?? "08:00", checkEnd: settings.get("check_end") ?? "08:15" }}
      />
    </AdminShell>
  );
}
