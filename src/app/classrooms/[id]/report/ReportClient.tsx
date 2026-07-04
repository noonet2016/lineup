"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";

type ReportRow = {
  sessionId: number;
  sessionDate: string;
  sessionDateLabel: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  pending: number;
  flagged: number;
  totalStudents: number;
};

export default function ReportClient({
  classroomId,
  roomName,
  fullName,
  startDate,
  endDate,
  errorMessage,
  rows,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  startDate: string;
  endDate: string;
  errorMessage: string | null;
  rows: ReportRow[];
}) {
  const router = useRouter();

  function submitFilter(formData: FormData) {
    const start = String(formData.get("start_date") ?? "");
    const end = String(formData.get("end_date") ?? "");
    router.push(`/classrooms/${classroomId}/report?start_date=${start}&end_date=${end}`);
  }

  const exportHref = `/api/classrooms/${classroomId}/report/export?start_date=${startDate}&end_date=${endDate}`;

  return (
    <TeacherShell active="report" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-full! mx-auto safe-px py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">รายงานผลการเข้าแถว</h1>
          <p className="text-slate-400 text-sm mt-1">สรุปข้อมูลสถิติของนักเรียนในห้องที่ปรึกษา ม.{roomName}</p>
        </div>

        <div className="flex gap-2">
          <span className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white shadow-md">รายวัน</span>
          <a
            href={`/classrooms/${classroomId}/report?view=student&start_date=${startDate}&end_date=${endDate}`}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            รายคน
          </a>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{errorMessage}</div>
        )}

        <div className="glass-panel rounded-2xl p-6 shadow-xl">
          <form action={submitFilter} className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-auto">
              <label htmlFor="start_date" className="block text-sm font-medium text-slate-400 mb-2">ตั้งแต่วันที่</label>
              <input type="date" id="start_date" name="start_date" required defaultValue={startDate} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div className="w-full md:w-auto">
              <label htmlFor="end_date" className="block text-sm font-medium text-slate-400 mb-2">ถึงวันที่</label>
              <input type="date" id="end_date" name="end_date" required defaultValue={endDate} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div className="flex w-full md:w-auto gap-3">
              <button type="submit" className="flex-grow md:flex-grow-0 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-[0.98]">
                ค้นหาข้อมูล
              </button>
              <a
                href={exportHref}
                className="flex-grow md:flex-grow-0 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                ส่งออก CSV
              </a>
            </div>
          </form>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-auto max-h-[65vh]">
            <table className="min-w-full divide-y divide-slate-900 text-left text-sm">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold">วันที่บันทึก</th>
                  <th className="px-6 py-4 font-bold text-center">มาปกติ (คน)</th>
                  <th className="px-6 py-4 font-bold text-center">มาสาย (คน)</th>
                  <th className="px-6 py-4 font-bold text-center">ขาดเรียน (คน)</th>
                  <th className="px-6 py-4 font-bold text-center">ลา/กิจกรรม (คน)</th>
                  <th className="px-6 py-4 font-bold text-center">GPS อ่อน (รอครูตรวจ)</th>
                  <th className="px-6 py-4 font-bold text-center">นอกรัศมี (รอครูตรวจ)</th>
                  <th className="px-6 py-4 font-bold text-center">รวมนักเรียนทั้งหมด</th>
                  <th className="px-6 py-4 font-bold text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      ไม่พบสถิติการเช็คชื่อเข้าแถวในช่วงเวลาที่เลือก
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const detailHref = `/classrooms/${classroomId}/report/${row.sessionId}`;
                  return (
                    <tr
                      key={row.sessionId}
                      className="hover:bg-indigo-500/5 transition-colors cursor-pointer"
                      onClick={() => router.push(detailHref)}
                    >
                      <td className="px-6 py-4 text-white font-semibold font-mono">{row.sessionDateLabel}</td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-400 font-mono">{row.present}</td>
                      <td className="px-6 py-4 text-center font-bold text-amber-400 font-mono">{row.late}</td>
                      <td className="px-6 py-4 text-center font-bold text-rose-400 font-mono">{row.absent}</td>
                      <td className="px-6 py-4 text-center font-bold text-sky-400 font-mono">{row.excused}</td>
                      <td className="px-6 py-4 text-center text-slate-400 font-mono">{row.pending}</td>
                      <td className="px-6 py-4 text-center text-orange-400 font-mono">{row.flagged}</td>
                      <td className="px-6 py-4 text-center text-slate-500 font-mono">{row.totalStudents} คน</td>
                      <td className="px-6 py-4 text-right">
                        <a
                          href={detailHref}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          ดูรายคน &rarr;
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </TeacherShell>
  );
}
