"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { approveLeave, rejectLeave, revertLeaveToPending } from "@/lib/actions/exemptions";
import { PopupAlertModal } from "@/app/_components/PopupAlert";

type RequestStatus = "pending" | "approved" | "rejected";

type LeaveRequest = {
  id: number;
  reason: string;
  startDate: string | null;
  endDate: string | null;
  status: RequestStatus | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  student: {
    studentId: string;
    fullName: string;
    nickname: string | null;
    numberInClass: number | null;
  };
};

function StatusBadge({ status }: { status: RequestStatus | string }) {
  const map: Record<RequestStatus, { label: string; className: string }> = {
    pending: { label: "รออนุมัติ", className: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
    approved: { label: "อนุมัติแล้ว", className: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
    rejected: { label: "ไม่อนุมัติ", className: "bg-rose-500/15 border-rose-500/30 text-rose-300" },
  };
  const entry = map[(status as RequestStatus) ?? "pending"] ?? map.pending;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${entry.className}`}>{entry.label}</span>;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "ไม่ระบุวันที่";
  if (startDate && endDate) return startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  return startDate ?? endDate ?? "ไม่ระบุวันที่";
}

export default function LeaveRequestsClient({
  classroomId,
  roomName,
  fullName,
  requests,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  requests: LeaveRequest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [items, setItems] = useState<LeaveRequest[]>(requests);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    setItems(requests);
    setNotes((current) => {
      const next: Record<number, string> = {};
      for (const item of requests) {
        if (current[item.id]) next[item.id] = current[item.id];
      }
      return next;
    });
  }, [requests]);

  const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

  function runReview(id: number, action: "approve" | "reject" | "revert") {
    setBanner(null);
    const note = notes[id]?.trim() ?? "";

    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveLeave(id, note || undefined)
          : action === "reject"
            ? await rejectLeave(id, note || undefined)
            : await revertLeaveToPending(id);
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending",
                  reviewNote: action === "revert" ? null : note || item.reviewNote,
                  reviewedAt: action === "revert" ? null : item.reviewedAt,
                }
              : item,
          ),
        );
        setNotes((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        router.refresh();
      }
    });
  }

  return (
    <TeacherShell active="dashboard" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">📝 คำขอลาเรียน</h1>
          <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
        </div>

        <PopupAlertModal alert={banner ? { type: banner.kind, message: banner.text } : null} onClose={() => setBanner(null)} />

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">รายการคำขอจากนักเรียน</h2>
              <p className="text-slate-400 text-sm mt-1">ทั้งหมด {items.length} รายการ · รอพิจารณา {pendingCount} รายการ</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-10">ยังไม่มีคำขอลาจากนักเรียน</div>
          ) : (
            <ul className="divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-hidden">
              {items.map((request) => {
                const isPending = request.status === "pending";
                const isApproved = request.status === "approved";
                const isRejected = request.status === "rejected";
                return (
                  <li key={request.id} className="bg-slate-950/30 px-4 py-4 sm:px-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <p className="text-sm font-semibold text-white">
                            {request.student.numberInClass ?? "-"}. {request.student.fullName}
                            {request.student.nickname && (
                              <span className="block text-slate-400 font-normal">({request.student.nickname})</span>
                            )}
                          </p>
                          <StatusBadge status={request.status} />
                        </div>
                        <p className="text-sm text-slate-300">
                          <span className="text-sky-400 font-medium">เหตุผล:</span> {request.reason}
                        </p>
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-500">ช่วงวันที่:</span> {formatDateRange(request.startDate, request.endDate)}
                        </p>
                        {!isPending && request.reviewedAt && (
                          <p className="text-xs text-slate-500">
                            <span className="text-slate-600">พิจารณาเมื่อ:</span> {request.reviewedAt}
                          </p>
                        )}
                        {!isPending && request.reviewNote && (
                          <p className="text-xs text-slate-400">
                            <span className="text-slate-500">หมายเหตุครู:</span> {request.reviewNote}
                          </p>
                        )}
                      </div>

                      {(isPending || isApproved || isRejected) && (
                        <div className="w-full lg:w-[360px] shrink-0 space-y-3">
                          {isPending && (
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-2">หมายเหตุ (ไม่บังคับ)</label>
                              <input
                                value={notes[request.id] ?? ""}
                                onChange={(e) => setNotes((current) => ({ ...current, [request.id]: e.target.value }))}
                                placeholder="เช่น มีใบลาแนบ / ตรวจสอบแล้ว"
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                              />
                            </div>
                          )}
                          <div className="grid sm:grid-cols-2 gap-2">
                            {(isPending || isRejected) && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => runReview(request.id, "approve")}
                                className="w-full rounded-xl px-4 py-2.5 font-bold text-white bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                อนุมัติ
                              </button>
                            )}
                            {(isPending || isApproved) && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => runReview(request.id, "reject")}
                                className="w-full rounded-xl px-4 py-2.5 font-bold text-white bg-rose-500 hover:bg-rose-600 active:bg-rose-700 shadow-lg shadow-rose-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {isApproved ? "เปลี่ยนเป็นไม่อนุมัติ" : "ไม่อนุมัติ"}
                              </button>
                            )}
                            {(isApproved || isRejected) && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => runReview(request.id, "revert")}
                                className="w-full rounded-xl px-4 py-2.5 font-bold text-white bg-slate-600 hover:bg-slate-500 active:bg-slate-700 shadow-lg shadow-slate-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                คืนเป็นรออนุมัติ
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </TeacherShell>
  );
}
