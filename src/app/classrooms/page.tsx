import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AdminShell } from "@/app/_components/LegacyChrome";

export const dynamic = "force-dynamic";

export default async function ClassroomsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "teacher") redirect("/checkin");

  const teacher = await prisma.teacher.findUnique({
    where: { id: Number(session.id) },
    select: { fullName: true, role: true, advisedClassrooms: { select: { id: true }, orderBy: { id: "asc" }, take: 1 } },
  });
  if (!teacher) redirect("/account");
  if (teacher.role !== "admin") {
    const ownRoom = teacher.advisedClassrooms[0];
    redirect(ownRoom ? `/classrooms/${ownRoom.id}` : "/account");
  }

  const classrooms = await prisma.classroom.findMany({
    orderBy: { roomName: "asc" },
    include: {
      advisor: { select: { fullName: true } },
      _count: { select: { students: true } },
    },
  });

  return (
    <AdminShell active="classrooms" fullName={teacher.fullName}>
    <main className="max-w-full mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold text-white">ห้องเรียนทั้งหมด</h1>
      <div className="grid gap-3">
        {classrooms.length === 0 && (
          <p className="text-slate-500">ยังไม่มีห้องเรียนในระบบ</p>
        )}
        {classrooms.map((room) => (
          <Link
            key={room.id}
            href={`/classrooms/${room.id}`}
            className="glass-panel rounded-2xl p-5 flex items-center justify-between hover:bg-slate-900/30 transition-all border border-slate-900"
          >
            <div>
              <h2 className="text-lg font-bold text-white">ม.{room.roomName}</h2>
              <p className="text-sm text-slate-400">
                ครูที่ปรึกษา: {room.advisor?.fullName ?? "ไม่ระบุ"}
              </p>
            </div>
            <span className="text-sm text-slate-400">{room._count.students} คน</span>
          </Link>
        ))}
      </div>
    </main>
    </AdminShell>
  );
}
