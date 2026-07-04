"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PopupAlertModal, usePopupAlert } from "@/app/_components/PopupAlert";
import { createTeacherWithClassroom, deleteTeacher, resetTeacherPassword, updateTeacher } from "@/lib/actions/admin";

type TeacherRow = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  rooms: string[];
  roomsDetailed: { id: number; roomName: string }[];
  studentCount: number;
  sessionCount: number;
};

export default function AdminClient({ ownerId, teachers }: { ownerId: number; teachers: TeacherRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { alert, setAlert, showResult } = usePopupAlert();
  const [resetFor, setResetFor] = useState<TeacherRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showAddPw, setShowAddPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [editFor, setEditFor] = useState<TeacherRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<TeacherRow | null>(null);

  function submitEdit(formData: FormData) {
    if (!editFor) return;
    const target = editFor;
    startTransition(async () => {
      const result = await updateTeacher(target.id, formData);
      showResult(result);
      if (result.ok) {
        setEditFor(null);
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    if (!deleteFor) return;
    const target = deleteFor;
    startTransition(async () => {
      const result = await deleteTeacher(target.id);
      showResult(result);
      setDeleteFor(null);
      if (result.ok) router.refresh();
    });
  }

  function addTeacher(formData: FormData) {
    startTransition(async () => {
      const result = await createTeacherWithClassroom(formData);
      showResult(result);
      if (result.ok) {
        (document.getElementById("add-teacher-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      }
    });
  }

  function submitReset() {
    if (!resetFor) return;
    const target = resetFor;
    startTransition(async () => {
      const result = await resetTeacherPassword(target.id, newPw);
      showResult(result);
      if (result.ok) {
        setResetFor(null);
        setNewPw("");
        router.refresh();
      }
    });
  }

  return (
    <main className="max-w-4xl mx-auto safe-px py-8 space-y-6">
      <PopupAlertModal alert={alert} onClose={() => setAlert(null)} />

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">👥 จัดการครู &amp; ห้องเรียน</h1>
        <p className="text-slate-400 text-sm mt-1">เฉพาะเจ้าของระบบ — เพิ่มบัญชีครูและห้องที่ปรึกษา</p>
      </div>

      {/* Add teacher + classroom */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-5">เพิ่มครูใหม่ + ห้องที่ปรึกษา</h2>
        <form id="add-teacher-form" action={addTeacher} className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ชื่อ - นามสกุล ครู</span>
            <input name="full_name" required placeholder="เช่น ครูสมชาย ใจดี" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ชื่อห้อง (roomName)</span>
            <input name="room_name" required placeholder="เช่น 5/7" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">Username (สำหรับล็อกอิน)</span>
            <input name="username" required autoComplete="off" placeholder="เช่น somchai (a-z, 0-9)" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">รหัสผ่านเริ่มต้น (≥ 6 ตัว)</span>
            <div className="relative">
              <input
                name="password"
                type={showAddPw ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="ครูเปลี่ยนเองได้ภายหลัง"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 pr-12 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="button" onClick={() => setShowAddPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300 text-xs font-semibold">
                {showAddPw ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-60">
              {pending ? "กำลังบันทึก..." : "+ เพิ่มครู + ห้อง"}
            </button>
            <p className="text-[11px] text-slate-500 mt-2">ครูที่เพิ่มจะเป็น &ldquo;ที่ปรึกษา&rdquo; ของห้องที่สร้าง — ล็อกอินแล้วตั้งจุดเช็คอิน + เพิ่มนักเรียนของห้องตัวเองได้ทันที</p>
          </div>
        </form>
      </section>

      {/* Teacher list */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">ครูทั้งหมด ({teachers.length})</h2>
        <ul className="divide-y divide-slate-900/60">
          {teachers.map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white break-words">{t.fullName}</span>
                  {t.role === "owner" && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">เจ้าของระบบ</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-mono">@{t.username}</p>
                <p className="text-[11px] text-slate-400">ห้อง: {t.rooms.length ? t.rooms.map((r) => `ม.${r}`).join(", ") : "— ยังไม่มีห้อง"}</p>
                {t.roomsDetailed.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.roomsDetailed.map((room) => (
                      <Link
                        key={room.id}
                        href={`/classrooms/${room.id}/students/manage`}
                        className="inline-flex items-center rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                      >
                        จัดการนักเรียน ม.{room.roomName}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {t.id !== ownerId && (
                  <button
                    onClick={() => { setResetFor(t); setNewPw(""); }}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-all"
                  >
                    รีเซ็ตรหัส
                  </button>
                )}
                <button
                  onClick={() => setEditFor(t)}
                  className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                >
                  แก้ไข
                </button>
                {t.id !== ownerId && (
                  <button
                    onClick={() => setDeleteFor(t)}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all"
                  >
                    ลบ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Reset password modal */}
      {resetFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setResetFor(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white font-bold text-lg mb-1">รีเซ็ตรหัสผ่าน</h4>
            <p className="text-slate-400 text-sm mb-4">{resetFor.fullName} (@{resetFor.username})</p>
            <div className="relative">
              <input
                type={showResetPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoFocus
                minLength={6}
                placeholder="รหัสผ่านใหม่ (≥ 6 ตัว)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 pr-12 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="button" onClick={() => setShowResetPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300 text-xs font-semibold">
                {showResetPw ? "ซ่อน" : "แสดง"}
              </button>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitReset} disabled={pending || newPw.length < 6} className="flex-grow rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 transition-colors">
                {pending ? "กำลังบันทึก..." : "ยืนยันรีเซ็ต"}
              </button>
              <button onClick={() => setResetFor(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit teacher modal */}
      {editFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setEditFor(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white font-bold text-lg mb-4">แก้ไขข้อมูลครู</h4>
            <form action={submitEdit} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1.5">ชื่อ - นามสกุล</span>
                <input name="full_name" required defaultValue={editFor.fullName} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1.5">Username</span>
                <input name="username" required autoComplete="off" defaultValue={editFor.username} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-400 mb-1.5">ชื่อห้อง</span>
                <input name="room_name" defaultValue={editFor.rooms[0] ?? ""} placeholder="เช่น 5/7" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={pending} className="flex-grow rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 transition-colors">
                  {pending ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button type="button" onClick={() => setEditFor(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setDeleteFor(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full border bg-rose-500/15 border-rose-500/30 text-rose-300 flex items-center justify-center text-2xl">🗑️</div>
            <h4 className="text-white font-bold text-lg mb-1.5">ลบบัญชีครู?</h4>
            <p className="text-slate-300 text-sm">
              {deleteFor.fullName} (@{deleteFor.username}) · ห้อง {deleteFor.rooms.length ? deleteFor.rooms.map((r) => `ม.${r}`).join(", ") : "—"}
            </p>
            {deleteFor.studentCount > 0 || deleteFor.sessionCount > 0 ? (
              <p className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                ⚠️ ห้องนี้มีนักเรียน {deleteFor.studentCount} คน / ประวัติเช็คชื่อ {deleteFor.sessionCount} วัน — ระบบจะไม่ลบให้ (กันข้อมูลหาย) หากต้องการระงับใช้รีเซ็ตรหัสผ่านแทน
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-400">ห้องยังว่าง (ไม่มีนักเรียน/ประวัติ) — ลบบัญชีครูและห้องนี้ได้</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={confirmDelete}
                disabled={pending || deleteFor.studentCount > 0 || deleteFor.sessionCount > 0}
                className="flex-grow rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 transition-colors"
              >
                {pending ? "กำลังลบ..." : "ลบถาวร"}
              </button>
              <button onClick={() => setDeleteFor(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
