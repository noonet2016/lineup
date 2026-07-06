"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { LightboxProvider, LightboxThumb, useLightbox } from "@/app/_components/ImageLightbox";
import ActivityBadge from "@/app/_components/ActivityBadge";
import { dashBadge, type DashboardStatus } from "@/lib/dashboardBadge";
import type { ActivityTag } from "@/lib/report";

type StudentReportBand = "regular" | "normal" | "frequent-absent";

type StudentReportDay = {
  sessionId: number;
  sessionDate: string;
  sessionDateLabel: string;
  status: DashboardStatus;
  exemptReason: string | null;
};

type StudentReportRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  linePictureUrl: string | null;
  activities: ActivityTag[];
  sessionsExpected: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendRate: number | null;
  band: StudentReportBand;
  days: StudentReportDay[];
};

type SortKey = "numberInClass" | "fullName" | "attendRate" | "absent" | "late" | "sessionsExpected";

const BAND_META: Record<StudentReportBand, { text: string; className: string }> = {
  regular: { text: "สม่ำเสมอ", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  normal: { text: "ปกติ", className: "bg-slate-500/10 border-slate-500/20 text-slate-300" },
  "frequent-absent": { text: "ขาดบ่อย", className: "bg-rose-500/10 border-rose-500/20 text-rose-400" },
};

function formatRate(rate: number | null) {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function compareRateDesc(a: StudentReportRow, b: StudentReportRow) {
  const aRate = a.attendRate ?? Number.POSITIVE_INFINITY;
  const bRate = b.attendRate ?? Number.POSITIVE_INFINITY;
  return bRate - aRate || a.absent - b.absent || (a.numberInClass ?? 9999) - (b.numberInClass ?? 9999);
}

function studentName(row: StudentReportRow) {
  return row.nickname ? `${row.fullName} (${row.nickname})` : row.fullName;
}

/** Avatar usable INSIDE a <button> card: a span (not a nested button) that opens the shared lightbox on click. */
function CardAvatar({ row }: { row: StudentReportRow }) {
  const { open } = useLightbox();
  const initial = (row.nickname ?? row.fullName).trim().charAt(0) || "?";
  if (!row.linePictureUrl) {
    return (
      <span className="shrink-0 w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold">
        {initial}
      </span>
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="ดูรูปโปรไฟล์ขนาดใหญ่"
      onClick={(e) => {
        e.stopPropagation();
        open({ src: row.linePictureUrl!, caption: studentName(row) });
      }}
      className="shrink-0 w-11 h-11 rounded-full overflow-hidden cursor-zoom-in border border-slate-700 hover:ring-2 hover:ring-cyan-400/50 transition-transform active:scale-95"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={row.linePictureUrl} alt="" className="w-full h-full object-cover" />
    </span>
  );
}

function StudentCard({ row, onOpen }: { row: StudentReportRow; onOpen: (row: StudentReportRow) => void }) {
  const band = BAND_META[row.band];
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="w-full text-left glass-panel rounded-2xl p-4 border border-slate-800/70 hover:border-indigo-500/40 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <CardAvatar row={row} />
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-mono">{row.numberInClass ? `เลขที่ ${row.numberInClass}` : row.studentId}</div>
            <div className="mt-1 text-white font-bold leading-snug whitespace-nowrap">{studentName(row)}</div>
            {row.activities.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.activities.map((activity) => (
                  <ActivityBadge key={`${row.studentId}-${activity.name}`} name={activity.name} color={activity.color} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`inline-flex border rounded-full px-2.5 py-1 text-xs font-bold ${band.className}`}>{band.text}</span>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400">
            ›
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-slate-950/60 p-2">
          <div className="text-xs text-slate-500">มา</div>
          <div className="font-mono font-bold text-emerald-400">{row.present}</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-2">
          <div className="text-xs text-slate-500">สาย</div>
          <div className="font-mono font-bold text-amber-400">{row.late}</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-2">
          <div className="text-xs text-slate-500">ขาด</div>
          <div className="font-mono font-bold text-rose-400">{row.absent}</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-2">
          <div className="text-xs text-slate-500">%มา</div>
          <div className="font-mono font-bold text-white">{formatRate(row.attendRate)}</div>
        </div>
      </div>
    </button>
  );
}

export default function StudentReportClient({
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
  rows: StudentReportRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<StudentReportRow | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [activeBand, setActiveBand] = useState<StudentReportBand | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("attendRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function submitFilter(formData: FormData) {
    const start = String(formData.get("start_date") ?? "");
    const end = String(formData.get("end_date") ?? "");
    router.push(`/classrooms/${classroomId}/report?view=student&start_date=${start}&end_date=${end}`);
  }

  const exportHref = `/api/classrooms/${classroomId}/report/export?start_date=${startDate}&end_date=${endDate}`;
  const dailyHref = `/classrooms/${classroomId}/report?start_date=${startDate}&end_date=${endDate}`;
  const studentHref = `/classrooms/${classroomId}/report?view=student&start_date=${startDate}&end_date=${endDate}`;

  const hasSessionData = rows.some((row) => row.days.length > 0);
  const stats = useMemo(
    () =>
      hasSessionData
        ? {
            regular: rows.filter((row) => row.band === "regular").length,
            normal: rows.filter((row) => row.band === "normal").length,
            frequent: rows.filter((row) => row.band === "frequent-absent").length,
          }
        : { regular: 0, normal: 0, frequent: 0 },
    [hasSessionData, rows],
  );

  // "ขาดบ่อย" section: sort most-absent -> least-absent (tie-break: lower attendance rate first).
  const frequentRows = useMemo(
    () =>
      rows
        .filter((row) => row.band === "frequent-absent")
        .sort((a, b) => (b.absent ?? 0) - (a.absent ?? 0) || compareRateDesc(b, a)),
    [rows],
  );
  const regularRows = useMemo(() => rows.filter((row) => row.band === "regular").sort(compareRateDesc), [rows]);
  const normalRows = useMemo(() => rows.filter((row) => row.band === "normal").sort(compareRateDesc), [rows]);
  const bandSections: { band: StudentReportBand; title: string; rows: StudentReportRow[] }[] = [
    { band: "frequent-absent", title: "ขาดบ่อย", rows: frequentRows },
    { band: "regular", title: "สม่ำเสมอ", rows: regularRows },
    { band: "normal", title: "ปกติ", rows: normalRows },
  ];
  const visibleSections = activeBand ? bandSections.filter((s) => s.band === activeBand) : bandSections.filter((s) => s.band !== "normal");
  const tableRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let result = 0;
      if (sortKey === "fullName") result = a.fullName.localeCompare(b.fullName, "th");
      else if (sortKey === "attendRate") result = (a.attendRate ?? Number.POSITIVE_INFINITY) - (b.attendRate ?? Number.POSITIVE_INFINITY);
      else result = (a[sortKey] ?? 9999) - (b[sortKey] ?? 9999);
      return sortDir === "asc" ? result : -result;
    });
  }, [rows, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "fullName" ? "asc" : "desc");
    }
  }

  return (
    <TeacherShell active="report" fullName={fullName} roomName={roomName} classroomId={classroomId}>
     <LightboxProvider>
      <main className="max-w-full safe-px py-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">รายงานผลการเข้าแถว</h1>
          <p className="text-slate-400 text-sm mt-1">สรุปข้อมูลรายคนของนักเรียนในห้องที่ปรึกษา ม.{roomName}</p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{errorMessage}</div>
        )}

        <div className="glass-panel rounded-2xl p-2 shadow-xl flex gap-2">
          <a href={dailyHref} className="flex-1 text-center rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-900/70">
            รายวัน
          </a>
          <a href={studentHref} className="flex-1 text-center rounded-xl px-4 py-2.5 text-sm font-bold bg-indigo-500 text-white shadow-md">
            รายคน
          </a>
        </div>

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
              <a href={exportHref} className="flex-grow md:flex-grow-0 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md text-center">
                ส่งออก CSV
              </a>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {([
            { band: "regular" as const, label: "สม่ำเสมอ", count: stats.regular, valueClass: "text-emerald-400", activeRing: "border-emerald-500/60 ring-2 ring-emerald-500/30" },
            { band: "frequent-absent" as const, label: "ขาดบ่อย", count: stats.frequent, valueClass: "text-rose-400", activeRing: "border-rose-500/60 ring-2 ring-rose-500/30" },
            { band: "normal" as const, label: "ปกติ", count: stats.normal, valueClass: "text-slate-200", activeRing: "border-slate-400/60 ring-2 ring-slate-400/20" },
          ]).map((tile) => {
            const active = activeBand === tile.band;
            return (
              <button
                key={tile.band}
                type="button"
                onClick={() => setActiveBand((cur) => (cur === tile.band ? null : tile.band))}
                className={`glass-panel rounded-2xl p-4 text-left border transition-all active:scale-[0.98] ${active ? tile.activeRing : "border-slate-800/70 hover:border-slate-600"}`}
              >
                <div className="text-xs text-slate-400">{tile.label}</div>
                <div className={`text-2xl font-mono font-extrabold ${tile.valueClass}`}>{tile.count}</div>
              </button>
            );
          })}
        </div>

        {activeBand && (
          <button type="button" onClick={() => setActiveBand(null)} className="text-indigo-400 font-bold text-sm hover:text-indigo-300">
            ✕ ล้างตัวกรอง — แสดงทุกกลุ่ม
          </button>
        )}

        {!hasSessionData ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 shadow-xl">ยังไม่มีข้อมูล</div>
        ) : (
          <>
            {visibleSections.map((s) => (
              <section key={s.band} className="space-y-3">
                <h2 className="text-lg font-extrabold text-white">{s.title}</h2>
                {s.rows.length === 0 ? <div className="text-sm text-slate-500">ไม่มีนักเรียนในกลุ่มนี้</div> : s.rows.map((row) => <StudentCard key={row.studentId} row={row} onOpen={setSelected} />)}
              </section>
            ))}

            <section className="space-y-3">
              <button type="button" onClick={() => setShowAll((value) => !value)} className="text-indigo-400 font-bold text-sm hover:text-indigo-300">
                {showAll ? "▾ ซ่อนทั้งหมด" : "▸ ดูทั้งหมด"}
              </button>
              {showAll && (
                <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-auto max-h-[65vh]">
                    <table className="min-w-full divide-y divide-slate-900 text-left text-sm">
                      <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
                        <tr>
                          {[
                            ["numberInClass", "เลขที่"],
                            ["fullName", "ชื่อ"],
                            ["attendRate", "%มา"],
                            ["sessionsExpected", "วันที่ต้องมา"],
                            ["absent", "ขาด"],
                            ["late", "สาย"],
                          ].map(([key, label]) => (
                            <th key={key} className="px-4 py-4 font-bold">
                              <button type="button" onClick={() => toggleSort(key as SortKey)} className="hover:text-white">
                                {label}
                              </button>
                            </th>
                          ))}
                          <th className="px-4 py-4 font-bold text-right">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/40">
                        {tableRows.map((row) => {
                          const band = BAND_META[row.band];
                          return (
                            <tr key={row.studentId} className="hover:bg-indigo-500/5 transition-colors">
                              <td className="px-4 py-4 font-mono text-slate-400">{row.numberInClass ?? "-"}</td>
                              <td className="px-4 py-4 text-white font-semibold whitespace-nowrap">{studentName(row)}</td>
                              <td className="px-4 py-4 font-mono font-bold text-white">{formatRate(row.attendRate)}</td>
                              <td className="px-4 py-4 font-mono text-slate-300">{row.sessionsExpected}</td>
                              <td className="px-4 py-4 font-mono font-bold text-rose-400">{row.absent}</td>
                              <td className="px-4 py-4 font-mono font-bold text-amber-400">{row.late}</td>
                              <td className="px-4 py-4 text-right">
                                <button type="button" onClick={() => setSelected(row)} className={`inline-flex border rounded-full px-3 py-1.5 text-xs font-bold ${band.className}`}>
                                  {band.text}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="p-5 border-b border-slate-900 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {selected.linePictureUrl ? (
                  <LightboxThumb src={selected.linePictureUrl} caption={studentName(selected)} className="w-12 h-12 border border-slate-700" />
                ) : (
                  <span className="shrink-0 w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold">
                    {(selected.nickname ?? selected.fullName).trim().charAt(0) || "?"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-mono">{selected.numberInClass ? `เลขที่ ${selected.numberInClass}` : selected.studentId}</div>
                  <h3 className="text-xl font-extrabold text-white mt-1">{studentName(selected)}</h3>
                  {selected.activities.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selected.activities.map((activity) => (
                        <ActivityBadge key={`${selected.studentId}-${activity.name}`} name={activity.name} color={activity.color} />
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-slate-400 mt-1">%มา {formatRate(selected.attendRate)} · ขาด {selected.absent} · ลา {selected.excused}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="shrink-0 w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white">
                ×
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh] divide-y divide-slate-900/70">
              {selected.days.length === 0 ? (
                <div className="p-8 text-center text-slate-500">ยังไม่มีข้อมูล</div>
              ) : (
                selected.days.map((day) => {
                  const badge = dashBadge(day.status);
                  return (
                    <div key={`${selected.studentId}-${day.sessionId}`} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-white font-semibold">{day.sessionDateLabel}</div>
                        {day.exemptReason && <div className="text-xs text-slate-500 mt-1">{day.exemptReason}</div>}
                      </div>
                      <span className={`shrink-0 inline-flex border rounded-full px-3 py-1.5 text-xs font-bold ${badge.className}`}>{badge.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
     </LightboxProvider>
    </TeacherShell>
  );
}
