"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { PopupAlertModal } from "@/app/_components/PopupAlert";
import { LightboxProvider, LightboxThumb } from "@/app/_components/ImageLightbox";
import { setStudentLineChatId, unlinkStudentLine } from "@/lib/actions/lineStatus";
import { lineChatUrl } from "@/lib/lineChatId";

type StudentRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  linked: boolean;
  lineDisplayName: string | null;
  linePictureUrl: string | null;
  lineChatId: string | null;
};

export default function LineStatusClient({
  classroomId,
  roomName,
  fullName,
  students,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  students: StudentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [query, setQuery] = useState("");
  const [editingLineChatId, setEditingLineChatId] = useState<string | null>(null);
  const [lineChatValue, setLineChatValue] = useState("");

  const q = query.trim().toLowerCase();
  const visible = q
    ? students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname ?? "").toLowerCase().includes(q) ||
          (s.lineChatId ?? "").toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          String(s.numberInClass ?? "").includes(q),
      )
    : students;

  function startLineChatEdit(student: StudentRow) {
    setBanner(null);
    setEditingLineChatId(student.studentId);
    setLineChatValue(student.lineChatId ?? "");
  }

  function handleSaveLineChatId(studentId: string) {
    setBanner(null);
    startTransition(async () => {
      const result = await setStudentLineChatId(studentId, lineChatValue);
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      if (result.ok) setEditingLineChatId(null);
      router.refresh();
    });
  }

  function handleUnlink(studentId: string) {
    setBanner(null);
    startTransition(async () => {
      const result = await unlinkStudentLine(studentId);
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      router.refresh();
    });
  }

  const linkedCount = students.filter((s) => s.linked).length;

  return (
    <TeacherShell active="devices" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <LightboxProvider>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">🔗 สถานะผูก LINE</h1>
          <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
        </div>
        <PopupAlertModal alert={banner ? { type: banner.kind, message: banner.text } : null} onClose={() => setBanner(null)} />

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">นักเรียน ({linkedCount}/{students.length} ผูกแล้ว)</h2>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              🟢 LINE Login
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-4">นักเรียนต้องผูกบัญชี LINE ก่อนถึงจะเข้าสู่ระบบและเช็คอินได้</p>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 ค้นหาชื่อ / ชื่อเล่น / เลขที่ / เลขประจำตัว"
            className="w-full mb-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />

          {students.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-6">ยังไม่มีนักเรียนในห้องนี้</div>
          ) : visible.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-6">ไม่พบนักเรียนที่ตรงกับ &ldquo;{query}&rdquo;</div>
          ) : (
            <ul className="flex flex-col gap-3 overflow-y-auto overflow-x-hidden max-h-[70vh] pr-1">
              {visible.map((s) => (
                <li key={s.studentId} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-900 bg-slate-950/30">
                  {s.linked && s.linePictureUrl ? (
                    <LightboxThumb
                      src={s.linePictureUrl}
                      alt={s.fullName}
                      caption={`${s.numberInClass ?? "-"}. ${s.fullName}${s.nickname ? ` (${s.nickname})` : ""}`}
                      className="w-9 h-9 border border-slate-800 mt-0.5"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-500 shrink-0 mt-0.5">?</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-400">เลขที่ {s.numberInClass ?? "-"}</div>
                      {s.linked ? (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">ผูกแล้ว</span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">ยังไม่ผูก</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-white whitespace-nowrap">{s.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono break-words">เลขประจำตัว {s.studentId}{s.nickname ? ` · ชื่อเล่น ${s.nickname}` : ""}</div>
                    <div className="text-xs text-slate-500 break-words">
                      {s.linked ? `LINE: ${s.lineDisplayName ?? "(ไม่ทราบชื่อ)"}` : "ยังไม่ได้ผูกบัญชี LINE"}
                    </div>
                    <div className="mt-2">
                      {editingLineChatId === s.studentId ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={lineChatValue}
                            onChange={(e) => setLineChatValue(e.target.value)}
                            placeholder="LINE ID เช่น jao.nakubb"
                            className="min-w-0 flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleSaveLineChatId(s.studentId)}
                              className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold disabled:opacity-60"
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setEditingLineChatId(null)}
                              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-60"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : s.lineChatId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={lineChatUrl(s.lineChatId)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            💬 LINE ID: {s.lineChatId}
                          </a>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => startLineChatEdit(s)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-60"
                            aria-label={`แก้ไข LINE ID ของ ${s.fullName}`}
                            title="แก้ไข LINE ID"
                          >
                            ✎
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => startLineChatEdit(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold disabled:opacity-60"
                        >
                          ＋ เพิ่ม LINE ID
                        </button>
                      )}
                    </div>
                    {s.linked && (
                      <button disabled={pending} onClick={() => handleUnlink(s.studentId)} className="mt-1.5 text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all">
                        ยกเลิกผูก
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      </LightboxProvider>
    </TeacherShell>
  );
}
