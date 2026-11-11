"use client";

type Overview = {
  today: { present: number; absent: number; leave: number; late: number; rate: number };
  classrooms: { roomName: string; studentCount: number; rate: number }[];
  trend: { label: string; rate: number }[];
  topAbsentees: { studentId: string; fullName: string; roomName: string; absentCount: number }[];
  health: { noLineCount: number; openScanFailCount: number };
};

export default function OverviewClient({ overview }: { overview: Overview }) {
  return (
    <main className="max-w-full mx-auto safe-px py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">📊 ภาพรวม</h1>
        <p className="text-slate-400 text-sm mt-1">สรุปการเข้าแถวและสถานะระบบ</p>
      </div>

      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div><h2 className="text-lg font-bold text-white">สรุปวันนี้ทุกห้อง</h2><p className="text-xs text-slate-400 mt-1">อัตราการมาเรียนจากรายการเช็คชื่อที่เปิดแล้ว</p></div>
          <span className="rounded-xl bg-emerald-500 px-4 py-2 text-xl font-extrabold text-white">{overview.today.rate}%</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["มาปกติ", overview.today.present, "text-emerald-300 border-emerald-500/25 bg-emerald-500/10"],
            ["สาย", overview.today.late, "text-amber-300 border-amber-500/25 bg-amber-500/10"],
            ["ลา", overview.today.leave, "text-sky-300 border-sky-500/25 bg-sky-500/10"],
            ["ขาด", overview.today.absent, "text-rose-300 border-rose-500/25 bg-rose-500/10"],
          ].map(([label, value, colors]) => <div key={String(label)} className={`rounded-2xl border p-4 ${colors}`}><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>)}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white">แนวโน้มการมาเรียน 7 วัน</h2>
        <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
          {overview.trend.map((day) => <div key={day.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"><span className="text-xs font-bold text-cyan-300">{day.rate}%</span><div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-indigo-600 to-cyan-400 shadow-[0_0_12px_-2px_rgba(34,211,238,0.5)] transition-[height] duration-500" style={{ height: `${Math.max(day.rate, 2)}%` }} /></div>)}
        </div>
        <div className="mt-2 flex gap-2 border-t border-slate-800 pt-2 sm:gap-3">{overview.trend.map((day) => <span key={day.label} className="min-w-0 flex-1 text-center text-xs text-slate-400">{day.label}</span>)}</div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-6 shadow-2xl"><h2 className="text-lg font-bold text-white mb-4">เปรียบเทียบรายห้อง</h2><div className="space-y-2">{overview.classrooms.map((room) => <div key={room.roomName} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-4 py-3"><div><p className="font-semibold text-white">ม.{room.roomName}</p><p className="text-xs text-slate-400">{room.studentCount} คน</p></div><span className="font-bold text-cyan-300">{room.rate}%</span></div>)}</div></section>
        <section className="glass-panel rounded-2xl p-6 shadow-2xl"><h2 className="text-lg font-bold text-white mb-4">นักเรียนขาดบ่อยที่สุด</h2>{overview.topAbsentees.length ? <ol className="space-y-2">{overview.topAbsentees.map((student, index) => <li key={student.studentId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-4 py-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{index + 1}. {student.fullName}</p><p className="text-xs text-slate-400">ม.{student.roomName} · {student.studentId}</p></div><span className="shrink-0 font-bold text-rose-300">{student.absentCount} วัน</span></li>)}</ol> : <p className="text-sm text-slate-400">ยังไม่มีข้อมูลการขาด</p>}</section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2"><div className="glass-panel rounded-2xl border border-amber-500/25 p-5"><p className="text-sm font-semibold text-amber-200">ยังไม่เชื่อม LINE</p><p className="mt-1 text-3xl font-extrabold text-white">{overview.health.noLineCount}</p><p className="text-xs text-slate-400 mt-1">นักเรียนที่ยังไม่มี lineUserId</p></div><div className="glass-panel rounded-2xl border border-rose-500/25 p-5"><p className="text-sm font-semibold text-rose-200">Scan fail ที่ยังไม่ตรวจ</p><p className="mt-1 text-3xl font-extrabold text-white">{overview.health.openScanFailCount}</p><p className="text-xs text-slate-400 mt-1">scan_fail_reports ที่ยังเปิดอยู่</p></div></section>
    </main>
  );
}
