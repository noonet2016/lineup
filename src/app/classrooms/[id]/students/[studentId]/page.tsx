import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudentShell, TeacherShell } from "@/app/_components/LegacyChrome";
import { historyStatusMeta, leaveMeta, loadStudentHistory } from "@/lib/studentHistory";
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
  searchParams: Promise<{ sy?: string; sm?: string; ey?: string; em?: string; p?: string }>;
}) {
  const { id, studentId } = await params;
  const classroomId = Number(id);
  if (!Number.isInteger(classroomId)) notFound();

  const now = new Date();
  const bangkokNow = nowInBangkok();
  const bangkokYear = bangkokNow.dateOnly.getUTCFullYear();
  const bangkokMonth = bangkokNow.dateOnly.getUTCMonth() + 1;
  const { sy, sm, ey, em, p } = await searchParams;
  const historyPage = /^\d+$/.test(p ?? "") ? Math.max(1, Number(p)) : 1;
  const parseYear = (v?: string) => (/^\d{4}$/.test(v ?? "") ? Number(v) : bangkokYear);
  const parseMonth = (v?: string) => (/^(?:[1-9]|1[0-2])$/.test(v ?? "") ? Number(v) : bangkokMonth);

  let startYear = parseYear(sy);
  let startMonth = parseMonth(sm);
  let endYear = parseYear(ey);
  let endMonth = parseMonth(em);
  // ensure start <= end
  if (startYear * 12 + startMonth > endYear * 12 + endMonth) {
    [startYear, endYear] = [endYear, startYear];
    [startMonth, endMonth] = [endMonth, startMonth];
  }

  const data = await loadStudentHistory(studentId, startYear, startMonth, endYear, endMonth, historyPage);
  if (!data || data.student.classroomId !== classroomId) notFound();
  const session = await getSession();
  if (!session) redirect("/login");

  const classroom =
    session.role === "teacher"
      ? await prisma.classroom.findUnique({ where: { id: classroomId }, include: { advisor: { select: { fullName: true } } } })
      : null;

  const isOwnStudent = session.role === "student" && session.id === studentId;
  const isAdvisor = session.role === "teacher" && classroom?.advisorId === Number(session.id);
  if (!isOwnStudent && !isAdvisor) redirect(`/classrooms/${classroomId}`);

  const todayBadge = historyStatusMeta(
    data.todayStatus === "notyet" || data.todayStatus === "none" ? "none" : data.todayStatus,
  );
  const startLabel = `${MONTHS_TH[startMonth]} ${startYear + 543}`;
  const endLabel = `${MONTHS_TH[endMonth]} ${endYear + 543}`;
  const monthLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  const years = [bangkokYear - 2, bangkokYear - 1, bangkokYear];

  const totalPages = Math.max(1, Math.ceil(data.historyTotal / data.historyPageSize));
  const curPage = Math.min(data.historyPage, totalPages);
  const rangeQS = `sm=${startMonth}&sy=${startYear}&em=${endMonth}&ey=${endYear}`;
  const pageHref = (pg: number) => `?${rangeQS}&p=${pg}#daily`;

  const content = (
    <main className="max-w-full mx-auto safe-px py-8 space-y-6">
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
            {data.todayStatus === "leave" ? (
              (() => {
                const lm = leaveMeta(data.todayLeaveKind, data.todayLeavePending);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${lm.className}`}>
                    <span className={`w-2 h-2 rounded-full ${lm.dotClass}`} />
                    {data.todayLeaveReason || lm.text}
                  </span>
                );
              })()
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${todayBadge.className}`}>
                {data.todayHasSession ? (data.todayStatus === "notyet" ? "ยังไม่เช็ค" : todayBadge.text) : "ยังไม่เปิดรอบ"}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">เวลาที่เช็ค</p>
            <p className="text-lg font-mono text-slate-200">{formatWallClockTime(data.todayTime)}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-5">
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white">สรุปการเข้าแถว</h2>
          <form method="GET" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-14 shrink-0">ตั้งแต่</span>
              <select
                name="sm"
                defaultValue={startMonth}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
              >
                {MONTHS_TH.slice(1).map((label, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                name="sy"
                defaultValue={startYear}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr + 543}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-14 shrink-0">ถึง</span>
              <select
                name="em"
                defaultValue={endMonth}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
              >
                {MONTHS_TH.slice(1).map((label, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                name="ey"
                defaultValue={endYear}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-200"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr + 543}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">
              ดูช่วงที่เลือก
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
            {data.leaveDays > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-300">🔵 ลา/กิจกรรม</span>
                <span className="font-bold text-sky-300">{data.leaveDays} วัน</span>
              </div>
            )}
            {data.pendingDays > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">⏳ รอครูตรวจ</span>
                <span className="font-bold text-slate-300">{data.pendingDays} วัน</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="daily" className="glass-panel rounded-2xl overflow-hidden scroll-mt-16">
        <div className="px-5 py-4 border-b border-slate-900">
          <h2 className="text-base font-bold text-white">ประวัติรายวัน</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เรียงจากใหม่ไปเก่า · ทั้งหมด {data.historyTotal} วัน
            {totalPages > 1 ? ` · หน้า ${curPage}/${totalPages}` : ""}
          </p>
        </div>
        {data.history.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ยังไม่มีประวัติการเช็คชื่อ</div>
        ) : (
          <ul className="divide-y divide-slate-900/60">
            {data.history.map((row) => {
              const lm = row.status === "leave" ? leaveMeta(row.leaveKind, row.leavePending) : null;
              const badge = historyStatusMeta(row.status);
              return (
                <li key={row.sessionDate.toISOString()} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-300">{formatWallClockDate(row.sessionDate)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500">
                      {lm ? row.leaveReason ?? "" : formatWallClockTime(row.checkTime)}
                    </span>
                    {lm ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${lm.className}`}>
                        <span className={`w-2 h-2 rounded-full ${lm.dotClass}`} />
                        {lm.text}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                        {badge.text}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-900">
            {curPage > 1 ? (
              <Link href={pageHref(curPage - 1)} className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg">
                ← ก่อนหน้า
              </Link>
            ) : (
              <span className="text-slate-600 text-sm px-4 py-2">← ก่อนหน้า</span>
            )}
            <span className="text-xs text-slate-500">หน้า {curPage} / {totalPages}</span>
            {curPage < totalPages ? (
              <Link href={pageHref(curPage + 1)} className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg">
                ถัดไป →
              </Link>
            ) : (
              <span className="text-slate-600 text-sm px-4 py-2">ถัดไป →</span>
            )}
          </div>
        )}
      </div>
    </main>
  );

  if (isOwnStudent) {
    return <StudentShell active="history">{content}</StudentShell>;
  }

  return (
    <TeacherShell active="dashboard" fullName={classroom?.advisor?.fullName ?? ""} roomName={classroom?.roomName ?? ""} classroomId={classroomId}>
      {content}
    </TeacherShell>
  );
}
