"use client";

import { useRouter } from "next/navigation";

type LeaveRow = {
  studentId: string;
  numberInClass: number | null;
  fullName: string;
  nickname: string | null;
  pending: boolean;
  label: string;
  dotClass: string;
  badgeClass: string;
};

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export default function ClassroomTodayClient({
  roomName,
  selectedDate,
  selectedDateLabel,
  todayDate,
  rows,
}: {
  roomName: string;
  selectedDate: string;
  selectedDateLabel: string;
  todayDate: string;
  rows: LeaveRow[];
}) {
  const router = useRouter();

  function go(date: string) {
    router.push(`/classroom-today?date=${date}`);
  }

  return (
    <main className="mx-auto w-full max-w-md py-6 space-y-5">
      <section className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">ม.{roomName}</p>
          <h1 className="text-2xl font-extrabold text-white">📅 วันนี้ในห้อง</h1>
          <p className="text-sm text-slate-400">{selectedDateLabel}</p>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] gap-2">
          <button
            type="button"
            onClick={() => go(shiftDate(selectedDate, -1))}
            className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-500"
            aria-label="วันก่อนหน้า"
          >
            ◀
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => go(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          />
          <button
            type="button"
            onClick={() => go(shiftDate(selectedDate, 1))}
            className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-500"
            aria-label="วันถัดไป"
          >
            ▶
          </button>
        </div>

        <button
          type="button"
          onClick={() => go(todayDate)}
          disabled={selectedDate === todayDate}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          วันนี้
        </button>
      </section>

      <section className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-900 px-5 py-4">
          <h2 className="text-base font-bold text-white">เพื่อนที่ลา/ไปกิจกรรม</h2>
          <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
            รวม {rows.length} คน
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm font-medium text-slate-400">วันนี้ไม่มีคนลา</div>
        ) : (
          <ul className="divide-y divide-slate-900/70">
            {rows.map((row) => (
              <li key={row.studentId} className={`px-5 py-4 ${row.pending ? "opacity-75" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-slate-300">
                    {row.numberInClass ?? "-"}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="break-words text-sm font-bold text-slate-100">{row.fullName}</p>
                      {row.nickname && <p className="break-words text-xs text-slate-400">({row.nickname})</p>}
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${row.badgeClass}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${row.dotClass}`} />
                      {row.label}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
