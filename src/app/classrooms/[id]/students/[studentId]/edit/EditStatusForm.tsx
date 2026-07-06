"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentStatus } from "@/lib/actions/attendance";
import { PopupAlertModal } from "@/app/_components/PopupAlert";

const STATUS_OPTIONS = [
  { value: "present", label: "มาปกติ", accent: "accent-emerald-500", text: "text-emerald-400", hover: "hover:border-emerald-500/40", wide: false },
  { value: "late", label: "สาย", accent: "accent-amber-500", text: "text-amber-400", hover: "hover:border-amber-500/40", wide: false },
  { value: "absent", label: "ขาด", accent: "accent-rose-500", text: "text-rose-400", hover: "hover:border-rose-500/40", wide: false },
  { value: "flagged", label: "นอกรัศมี", accent: "accent-orange-500", text: "text-orange-400", hover: "hover:border-orange-500/40", wide: false },
  { value: "pending", label: "รอตรวจ", accent: "accent-slate-500", text: "text-slate-400", hover: "hover:border-slate-500/40", wide: true },
];

const STATUS_NAMES: Record<string, string> = {
  present: "มาปกติ (Present)",
  late: "สาย (Late)",
  absent: "ขาด (Absent)",
  pending: "รอตรวจสอบ (Pending)",
  flagged: "นอกรัศมี (Flagged)",
};

export default function EditStatusForm({ studentId, classroomId, currentStatus, returnFilter }: { studentId: string; classroomId: number; currentStatus: string; returnFilter?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submitStatus(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateStudentStatus(studentId, status, reason);
      if (result.ok) {
        const params = new URLSearchParams();
        if (returnFilter) params.set("filter", returnFilter);
        params.set("success", result.message);
        router.push(`/classrooms/${classroomId}?${params.toString()}`);
      } else {
        setMessage({ type: "error", text: result.message });
      }
    });
  }

  return (
    <div className="space-y-6">
      <PopupAlertModal alert={message ? { type: message.type, message: message.text } : null} onClose={() => setMessage(null)} />
      <div className="glass-panel rounded-2xl p-8 shadow-2xl relative">
      <form onSubmit={submitStatus} className="space-y-6">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between">
          <span className="text-slate-400">สถานะที่บันทึกก่อนหน้า:</span>
          <span className="font-bold text-white font-mono">{STATUS_NAMES[currentStatus] ?? currentStatus}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">ปรับเปลี่ยนสถานะการลงเวลาใหม่</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className={`cursor-pointer border border-slate-800 ${opt.hover} rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all text-center select-none bg-slate-900/50 ${opt.wide ? "col-span-2 sm:col-span-1" : ""}`}>
                <input type="radio" name="status" value={opt.value} checked={status === opt.value} onChange={() => setStatus(opt.value)} className={opt.accent} />
                <span className={`text-xs font-semibold ${opt.text}`}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="edit_reason" className="block text-sm font-medium text-slate-300 mb-2">ระบุเหตุผลความจำเป็นในการแก้ไข (บังคับระบุ)</label>
          <textarea
            id="edit_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="ตัวอย่างเช่น: นักเรียนแจ้งโทรศัพท์มือถือจับสัญญาณ GPS ไม่สำเร็จ / ท้องเสียเข้าห้องน้ำที่ตึกเรียน"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-lg"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไขสถานะ"}
        </button>
      </form>
      </div>
    </div>
  );
}
