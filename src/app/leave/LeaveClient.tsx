"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ThaiDatePicker from "@/app/_components/ThaiDatePicker";
import { requestLeave, cancelMyLeave } from "@/lib/actions/leave";

type LeaveRequest = {
  id: number;
  reason: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const REASON_OPTIONS = ["ลาป่วย", "ลากิจ", "ร.ด.", "ไปแข่งขัน/กิจกรรม", "อื่นๆ"];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "รออนุมัติ", className: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  approved: { label: "อนุมัติแล้ว", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  rejected: { label: "ไม่อนุมัติ", className: "bg-rose-500/10 border-rose-500/20 text-rose-400" },
};

const inputClass =
  "w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

function dateText(start: string | null, end: string | null): string {
  if (!start && !end) return "-";
  if (start && end && start === end) return start;
  return `${start ?? "?"} – ${end ?? "?"}`;
}

export default function LeaveClient({ requests }: { requests: LeaveRequest[] }) {
  const router = useRouter();
  const [reasonChoice, setReasonChoice] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState("");
  const todayISO = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }), []);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [date, setDate] = useState(todayISO);
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const reason = reasonChoice === "อื่นๆ" ? customReason.trim() : reasonChoice;
    if (!reason) {
      setMessage({ type: "error", text: "กรุณาระบุเหตุผลการลา" });
      return;
    }
    const fd = new FormData();
    fd.set("reason", reason);
    fd.set("mode", mode);
    if (mode === "single") {
      fd.set("date", date);
    } else {
      fd.set("startDate", startDate);
      fd.set("endDate", endDate);
    }
    startTransition(async () => {
      const result = await requestLeave(fd);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) {
        setCustomReason("");
        setDate(todayISO);
        setStartDate(todayISO);
        setEndDate(todayISO);
        // Re-fetch the server component so the new row shows with its real DB id
        // (needed for a working "ยกเลิก" button).
        router.refresh();
      }
    });
  }

  function cancel(id: number) {
    setMessage(null);
    startTransition(async () => {
      const result = await cancelMyLeave(id);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <main className="max-w-md mx-auto safe-px py-10 space-y-6">
      <h1 className="text-2xl font-extrabold text-white">ยื่นขอลา / ขอยกเว้นเข้าแถว</h1>

      {message && (
        <div
          className={
            "p-3 rounded-xl text-sm border text-center " +
            (message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400")
          }
        >
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">เหตุผลการลา</label>
          <select value={reasonChoice} onChange={(e) => setReasonChoice(e.target.value)} className={inputClass}>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {reasonChoice === "อื่นๆ" && (
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="ระบุเหตุผล"
              maxLength={100}
              className={inputClass}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">ช่วงการลา</label>
          <div className="grid grid-cols-2 gap-2">
            {(["single", "range"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "py-2 rounded-xl text-sm font-semibold border transition-colors " +
                  (mode === m
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white")
                }
              >
                {m === "single" ? "ลาวันเดียว" : "ลาหลายวัน"}
              </button>
            ))}
          </div>
        </div>

        {mode === "single" ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">วันที่ลา</label>
            <ThaiDatePicker value={date} onChange={setDate} min={todayISO} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">วันเริ่ม</label>
              <ThaiDatePicker value={startDate} onChange={setStartDate} min={todayISO} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">วันสิ้นสุด</label>
              <ThaiDatePicker value={endDate} onChange={setEndDate} min={todayISO} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
        >
          {pending ? "กำลังส่ง..." : "ส่งคำขอลา"}
        </button>
      </form>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900">
          <h2 className="text-base font-bold text-white">คำขอลาของฉัน</h2>
        </div>
        {requests.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ยังไม่มีคำขอลา</div>
        ) : (
          <ul className="divide-y divide-slate-900/60">
            {requests.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? { label: r.status, className: "bg-slate-700/30 border-slate-700 text-slate-300" };
              return (
                <li key={r.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{r.reason}</p>
                      <p className="text-xs text-slate-500">{dateText(r.startDate, r.endDate)}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>{badge.label}</span>
                  </div>
                  {r.status === "rejected" && r.reviewNote && (
                    <p className="text-xs text-rose-400">เหตุผลที่ไม่อนุมัติ: {r.reviewNote}</p>
                  )}
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => cancel(r.id)}
                      disabled={pending}
                      className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      ยกเลิกคำขอ
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
