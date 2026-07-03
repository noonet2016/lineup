import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClassroomsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const classrooms = await prisma.classroom.findMany({
    orderBy: { roomName: "asc" },
    include: {
      advisor: { select: { fullName: true } },
      _count: { select: { students: true } },
    },
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
  );
}
