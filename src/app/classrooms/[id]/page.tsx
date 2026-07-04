import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { holidayBlockReason, loadDashboard, type DashboardFilter } from "@/lib/dashboard";
import { formatWallClockDate, todayInBangkok } from "@/lib/time";
import { getSession } from "@/lib/session";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import DashboardLive from "./DashboardLive";
import PullToRefresh from "@/app/_components/PullToRefresh";

export const dynamic = "force-dynamic";

const isValidFilter = (value: string | undefined): value is DashboardFilter =>
  value === "all" ||
  value === "present" ||
  value === "late" ||
  value === "absent" ||
  value === "pending" ||
  value === "flagged" ||
  value === "excused" ||
  value === "edited" ||
  value === "pending_review";

export default async function ClassroomDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; success?: string }>;
}) {
  const { id } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { advisor: { select: { fullName: true } } },
  });
  if (!classroom) notFound();

  const { filter: rawFilter, success } = await searchParams;
  const filter: DashboardFilter = isValidFilter(rawFilter) ? rawFilter : "absent";

  const today = todayInBangkok();
  const [holiday, data, session] = await Promise.all([
    holidayBlockReason(today),
    loadDashboard(classroomId, filter),
    getSession(),
  ]);

  if (!session) redirect("/login");

  const { sessionOpen } = data;
  const isAdvisor = session.role === "teacher" && classroom.advisorId === Number(session.id);

  const page = (
    <main className="max-w-full mx-auto safe-px py-8 space-y-6">
      <PullToRefresh />
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
      )}
      {holiday && (
        <div className="glass-panel rounded-2xl p-5 border-l-4 border-l-indigo-500 flex items-center gap-4">
          <span className="text-3xl">🏖️</span>
          <div>
            <h2 className="text-lg font-bold text-white">วันนี้เป็นวันหยุด · {holiday}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              ไม่มีการเช็คชื่อเข้าแถวในวันนี้ — สถานะ &quot;ขาด&quot; ด้านล่างเป็นเพียงค่าตั้งต้น จะไม่ถูกบันทึกหรือนับเป็นสถิติ
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">เช็คชื่อเข้าแถวห้อง ม.{classroom.roomName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            ประจำวันที่ {formatWallClockDate(today)} | อัปเดทข้อมูลทุก 15 วินาที
            {!sessionOpen && " · ยังไม่เปิดรอบวันนี้"}
          </p>
          {!isAdvisor && <p className="text-xs text-slate-500 mt-1">มุมมองอ่านอย่างเดียว (read-only)</p>}
        </div>
        <div className="flex items-center gap-2">
          {isAdvisor && !sessionOpen && (
            <a
              href={`/classrooms/${classroomId}/settings`}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              + เปิดรอบวันนี้
            </a>
          )}
          {isAdvisor && (
            <a
              href={`/classrooms/${classroomId}/settings`}
              className="shrink-0 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-indigo-400 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              ตั้งค่าห้องเรียน
            </a>
          )}
        </div>
      </div>

      <DashboardLive classroomId={classroomId} filter={filter} initialData={data} isAdvisor={Boolean(isAdvisor)} todayLabel={formatWallClockDate(today)} />
    </main>
  );

  if (isAdvisor) {
    return (
      <TeacherShell active="dashboard" fullName={classroom.advisor?.fullName ?? ""} roomName={classroom.roomName} classroomId={classroom.id}>
        {page}
      </TeacherShell>
    );
  }

  return page;
}
