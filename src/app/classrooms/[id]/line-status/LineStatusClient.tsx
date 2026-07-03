"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { unlinkStudentLine } from "@/lib/actions/lineStatus";

type StudentRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  linked: boolean;
  lineDisplayName: string | null;
  linePictureUrl: string | null;
};

function Banner({ text, kind }: { text: string; kind: "success" | "error" }) {
  return (
    <div
      className={`p-3 rounded-xl text-sm border ${kind === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
    >
      {text}
    </div>
  );
}

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
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">🔗 สถานะผูก LINE</h1>
          <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
        </div>
        {banner && <div className="max-w-3xl mx-auto"><Banner text={banner.text} kind={banner.kind} /></div>}

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">นักเรียน ({linkedCount}/{students.length} ผูกแล้ว)</h2>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              🟢 LINE Login
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-6">นักเรียนต้องผูกบัญชี LINE ก่อนถึงจะเข้าสู่ระบบและเช็คอินได้</p>

          {students.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-6">ยังไม่มีนักเรียนในห้องนี้</div>
          ) : (
            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[70vh] pr-1">
              {students.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-900 bg-slate-950/30">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.linked && s.linePictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.linePictureUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-800" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-500 shrink-0">?</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white break-words">
                        เลขที่ {s.numberInClass ?? "-"} · {s.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">เลขประจำตัว {s.studentId}{s.nickname ? ` · ชื่อเล่น ${s.nickname}` : ""}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {s.linked ? `LINE: ${s.lineDisplayName ?? "(ไม่ทราบชื่อ)"}` : "ยังไม่ได้ผูกบัญชี LINE"}
                      </div>
                      {!s.linked && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">ยังไม่ผูก</span>
                      )}
                    </div>
                  </div>
                  {s.linked && (
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">ผูกแล้ว</span>
                      <button disabled={pending} onClick={() => handleUnlink(s.studentId)} className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all">
                        ยกเลิกผูก
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </TeacherShell>
  );
}
