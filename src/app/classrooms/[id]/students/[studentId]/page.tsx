import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudentShell, TeacherShell } from "@/app/_components/LegacyChrome";
import { historyStatusMeta, loadStudentHistory } from "@/lib/studentHistory";
import { formatInstantDate, formatWallClockDate, formatWallClockTime, nowInBangkok } from "@/lib/time";

export const dynamic = "force-dynamic";

const MONTHS_TH = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export default async function StudentHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; studentId: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { id, studentId } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const now = new Date();
  const bangkokNow = nowInBangkok();
  const bangkokYear = bangkokNow.dateOnly.getUTCFullYear();
  const { y, m } = await searchParams;
  const year = /^\d{4}$/.test(y ?? "") ? Number(y) : bangkokYear;
  const month = /^(?:[1-9]|1[0-2])$/.test(m ?? "") ? Number(m) : bangkokNow.dateOnly.getUTCMonth() + 1;

  const data = await loadStudentHistory(studentId, year, month);
  if (!data || data.student.classroomId !== classroomId) notFound();
  const session = await getSession();
  const classroom =
    session?.role === "teacher"
      ? await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } })
      : null;

  const todayBadge = historyStatusMeta(
    data.todayStatus === "notyet" || data.todayStatus === "none" ? "none" : data.todayStatus,
  );
  const monthLabel = `${MONTHS_TH[month]} ${year + 543}`;
  const years = [bangkokYear - 2, bangkokYear - 1, bangkokYear];

  const content = (
    <main className="max-w-xl mx-auto safe-px py-8 space-y-6">
      <Link href={`/classrooms/${classroomId}`} className="text-sm text-slate-400 hover:text-white">
        ← กลับไปหน้าห้องเรียน
      </Link>

      <div>
        <p className="text-sm font-semibold tracking-wider text-cyan-400">ผลการเช็คชื่อ</p>
        <h1 className="text-xl font-bold text-white mt-1">
          {data.student.fullName}
          {data.student.nickname ? ` (${data.student.nickname})` : ""}
        </h1>
        <p className="text-xs text-slate-500 mt-1">รหัสนักเรียน: {data.student.studentId}</p>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1">สถานะวันนี้ · {formatInstantDate(now)}</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${todayBadge.className}`}>
              {data.todayHasSession ? (data.todayStatus === "notyet" ? "ยังไม่เช็ค" : todayBadge.text) : "ยังไม่เปิดรอบ"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">เวลาที่เช็ค</p>
            <p className="text-lg font-mono text-slate-200">{formatWallClockTime(data.todayTime)}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">สรุปการเข้าแถว</h2>
          <form method="GET" className="shrink-0 flex items-center gap-2">
            <select
              name="m"
              defaultValue={month}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
            >
              {MONTHS_TH.slice(1).map((label, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {label}
                </option>
              ))}
            </select>
            <select
              name="y"
              defaultValue={year}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
            >
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr + 543}
                </option>
              ))}
            </select>
            <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
              ดู
            </button>
          </form>
        </div>

        <div className="flex items-center gap-5">
          <div
            className="relative w-28 h-28 shrink-0 rounded-full"
            style={{ background: `conic-gradient(#22d3ee ${data.rate * 3.6}deg, rgba(148,163,184,0.15) 0deg)` }}
          >
            <div className="absolute inset-[10px] rounded-full bg-slate-950 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-cyan-400">{data.rate}%</span>
              <span className="text-[10px] text-slate-500">เข้าแถว</span>
            </div>
          </div>
          <div className="flex-grow space-y-2 text-sm">
            <p className="text-xs text-slate-500">
              {monthLabel} · มีรอบเช็ค {data.totalSessions} วัน
            </p>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">🟢 มาปกติ</span>
              <span className="font-bold text-emerald-400">{data.presentDays} วัน</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">🟡 สาย</span>
              <span className="font-bold text-amber-400">{data.lateDays} วัน</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">🔴 ขาด</span>
              <span className="font-bold text-rose-400">{data.absentDays} วัน</span>
            </div>
            {data.pendingDays > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">⏳ รอครูตรวจ</span>
                <span className="font-bold text-slate-300">{data.pendingDays} วัน</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900">
          <h2 className="text-base font-bold text-white">ประวัติรายวัน</h2>
          <p className="text-xs text-slate-500 mt-0.5">เรียงจากใหม่ไปเก่า (สูงสุด 90 รายการ)</p>
        </div>
        {data.history.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ยังไม่มีประวัติการเช็คชื่อ</div>
        ) : (
          <ul className="divide-y divide-slate-900/60">
            {data.history.map((row) => {
              const badge = historyStatusMeta(row.status);
              return (
                <li key={row.sessionDate.toISOString()} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-300">{formatWallClockDate(row.sessionDate)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500">{formatWallClockTime(row.checkTime)}</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );

  if (session?.role === "student" && session.id === studentId) {
    return <StudentShell active="history">{content}</StudentShell>;
  }

  if (session?.role === "teacher" && classroom?.advisorId === Number(session.id)) {
    return (
      <TeacherShell active="dashboard" fullName={classroom.advisor?.fullName ?? ""} roomName={classroom.roomName} classroomId={classroomId}>
        {content}
      </TeacherShell>
    );
  }

  return content;
}
