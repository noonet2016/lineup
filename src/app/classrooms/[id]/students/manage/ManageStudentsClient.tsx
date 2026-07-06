"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ActivityBadge from "@/app/_components/ActivityBadge";
import { PopupAlertModal } from "@/app/_components/PopupAlert";
import { bulkImportStudents, createStudent, deactivateStudent, renumberStudents, updateStudent } from "@/lib/actions/students";
import { setStudentActivities } from "@/lib/actions/activities";
import { resetStudentPassword } from "@/lib/actions/attendance";

type StudentActivity = { name: string; color: string };
type ActivityOption = { id: number; name: string; color: string; isActive: number };
type Student = { studentId: string; fullName: string; nickname: string | null; numberInClass: number | null; activities: StudentActivity[] };
type FormState = { studentId: string; fullName: string; nickname: string; numberInClass: string };
type ActivityEditorState = { studentId: string; fullName: string; selectedIds: number[] } | null;

const EMPTY_FORM: FormState = { studentId: "", fullName: "", nickname: "", numberInClass: "" };

function sortStudents(items: Student[]): Student[] {
  return items.slice().sort((a, b) => {
    const an = a.numberInClass === null ? Number.POSITIVE_INFINITY : a.numberInClass;
    const bn = b.numberInClass === null ? Number.POSITIVE_INFINITY : b.numberInClass;
    if (an !== bn) return an - bn;
    return a.studentId.localeCompare(b.studentId);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export default function ManageStudentsClient({
  classroomId,
  students,
  activities,
}: {
  classroomId: number;
  students: Student[];
  activities: ActivityOption[];
}) {
  const router = useRouter();
  const [list, setList] = useState<Student[]>(students);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [activityEditor, setActivityEditor] = useState<ActivityEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ studentId: string; fullName: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ studentId: string; fullName: string } | null>(null);
  const [confirmingRenumber, setConfirmingRenumber] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const activityById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((student) =>
      student.fullName.toLowerCase().includes(q) ||
      (student.nickname ? student.nickname.toLowerCase().includes(q) : false) ||
      student.studentId.toLowerCase().includes(q) ||
      (student.numberInClass !== null && String(student.numberInClass).includes(q)),
    );
  }, [list, query]);

  function startEdit(student: Student) {
    setEditingId(student.studentId);
    setEditForm({
      studentId: student.studentId,
      fullName: student.fullName,
      nickname: student.nickname || "",
      numberInClass: student.numberInClass === null ? "" : String(student.numberInClass),
    });
    setDeleteTarget(null);
    setResetTarget(null);
  }

  function openActivityEditor(student: Student) {
    setActivityEditor({
      studentId: student.studentId,
      fullName: student.fullName,
      selectedIds: activities.filter((activity) => student.activities.some((tag) => tag.name === activity.name)).map((activity) => activity.id),
    });
  }

  function submitAdd(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createStudent({ ...addForm, classroomId });
      if (result.ok) {
        const newStudent: Student = {
          studentId: addForm.studentId.trim(),
          fullName: addForm.fullName.trim(),
          nickname: addForm.nickname.trim() === "" ? null : addForm.nickname.trim(),
          numberInClass: addForm.numberInClass.trim() === "" ? null : Number(addForm.numberInClass),
          activities: [],
        };
        setList((current) => sortStudents(current.concat([newStudent])));
        setAddForm(EMPTY_FORM);
        setShowAdd(false);
      }
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function submitImport(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await bulkImportStudents(importText, classroomId);
      if (result.ok) {
        const skippedPreview = result.skipped.slice(0, 15).map((item) => `${escapeHtml(item.line)} — ${escapeHtml(item.reason)}`);
        const more = result.skipped.length > 15 ? ["..."] : [];
        const details = skippedPreview.length ? `<br>${skippedPreview.concat(more).join("<br>")}` : "";
        setImportText("");
        setShowImport(false);
        router.refresh();
        setMessage({ type: "success", text: result.message + details });
        return;
      }

      setMessage({ type: "error", text: result.message });
    });
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateStudent(editForm.studentId, { ...editForm, classroomId });
      if (result.ok) {
        const updated = list.map((student) => {
          if (student.studentId !== editForm.studentId) return student;
          return {
            ...student,
            fullName: editForm.fullName.trim(),
            nickname: editForm.nickname.trim() === "" ? null : editForm.nickname.trim(),
            numberInClass: editForm.numberInClass.trim() === "" ? null : Number(editForm.numberInClass),
          };
        });
        setList(sortStudents(updated));
        setEditingId(null);
      }
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function submitActivityEdit() {
    if (!activityEditor) return;
    setMessage(null);
    const target = activityEditor;
    startTransition(async () => {
      const result = await setStudentActivities(target.studentId, target.selectedIds);
      if (result.ok) {
        const nextActivities = target.selectedIds
          .map((id) => activityById.get(id))
          .filter((activity): activity is ActivityOption => Boolean(activity))
          .map((activity) => ({ name: activity.name, color: activity.color }));
        setList((current) =>
          current.map((student) =>
            student.studentId === target.studentId
              ? {
                  ...student,
                  activities: nextActivities,
                }
              : student,
          ),
        );
        setActivityEditor(null);
      }
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function doRenumber() {
    setMessage(null);
    startTransition(async () => {
      const result = await renumberStudents(classroomId);
      if (result.ok) {
        setList((current) => sortStudents(current).map((student, index) => ({ ...student, numberInClass: index + 1 })));
      }
      setConfirmingRenumber(false);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function doDelete(studentId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await deactivateStudent(studentId, classroomId);
      if (result.ok) {
        setList((current) => current.filter((student) => student.studentId !== studentId));
      }
      setDeleteTarget(null);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function doResetPassword(studentId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await resetStudentPassword(studentId);
      setResetTarget(null);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  const inputClass =
    "w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  return (
    <div className="space-y-6">
      <PopupAlertModal alert={message ? { type: message.type, message: message.text } : null} onClose={() => setMessage(null)} />

      <div className="glass-panel rounded-2xl p-5">
        {!showAdd ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
            >
              + เพิ่มนักเรียนใหม่
            </button>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-100 font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
            >
              📋 นำเข้าเป็นชุด
            </button>
          </div>
        ) : (
          <form onSubmit={submitAdd} className="space-y-3">
            <h3 className="text-base font-bold text-white">เพิ่มนักเรียนใหม่</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="รหัสนักเรียน"
                value={addForm.studentId}
                onChange={(e) => setAddForm({ ...addForm, studentId: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="เลขที่ในห้อง"
                value={addForm.numberInClass}
                onChange={(e) => setAddForm({ ...addForm, numberInClass: e.target.value })}
                className={inputClass}
              />
              <input
                required
                placeholder="ชื่อ-นามสกุล"
                value={addForm.fullName}
                onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                className={inputClass + " col-span-2"}
              />
              <input
                placeholder="ชื่อเล่น (ถ้ามี)"
                value={addForm.nickname}
                onChange={(e) => setAddForm({ ...addForm, nickname: e.target.value })}
                className={inputClass + " col-span-2"}
              />
            </div>
            <p className="text-xs text-slate-500">รหัสผ่านเริ่มต้นจะเป็นรหัสนักเรียน ระบบจะบังคับให้ตั้งใหม่ตอน login ครั้งแรก</p>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm">
                บันทึก
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddForm(EMPTY_FORM);
                }}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        )}
      </div>

      {showImport ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setShowImport(false)}
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitImport}
            className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-2">นำเข้านักเรียนเป็นชุด</h3>
            <p className="text-xs text-slate-400 mb-3">เลขที่ [Tab] รหัส [Tab] ชื่อ-นามสกุล [Tab] ชื่อเล่น(เว้นได้) — วางจาก Excel ได้เลย</p>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"1\t12345\tสมชาย ใจดี\tชาย"}
              className={`${inputClass} font-mono resize-y min-h-48`}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={pending || importText.trim() === ""}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                นำเข้า
              </button>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-sm"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-900 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">นักเรียนทั้งหมด ({list.length})</h2>
          {confirmingRenumber ? (
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                disabled={pending}
                onClick={doRenumber}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
              >
                ยืนยันจัดเรียง
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRenumber(false)}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending || list.length === 0}
              onClick={() => {
                setConfirmingRenumber(true);
                setDeleteTarget(null);
              }}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              จัดเรียงเลขที่ใหม่
            </button>
          )}
        </div>
        {list.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-900">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 ค้นหาชื่อ / ชื่อเล่น / รหัส / เลขที่"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
            {query.trim() && (
              <p className="text-xs text-slate-500 mt-2">พบ {visible.length} จาก {list.length} คน</p>
            )}
          </div>
        )}
        {list.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ยังไม่มีนักเรียนในห้องนี้</div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ไม่พบนักเรียนที่ตรงกับคำค้นหา</div>
        ) : (
          <ul className="divide-y divide-slate-900/60 overflow-y-auto max-h-[60vh]">
            {visible.map((student) => {
              if (editingId === student.studentId) {
                return (
                  <li key={student.studentId} className="px-5 py-4">
                    <form onSubmit={submitEdit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          placeholder="เลขที่ในห้อง"
                          value={editForm.numberInClass}
                          onChange={(e) => setEditForm({ ...editForm, numberInClass: e.target.value })}
                          className={inputClass}
                        />
                        <div className="text-xs text-slate-500 flex items-center px-1">รหัสนักเรียน: {student.studentId} (แก้ไม่ได้)</div>
                        <input
                          required
                          placeholder="ชื่อ-นามสกุล"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                          className={inputClass + " col-span-2"}
                        />
                        <input
                          placeholder="ชื่อเล่น"
                          value={editForm.nickname}
                          onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                          className={inputClass + " col-span-2"}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={pending} className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm">
                          บันทึก
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm">
                          ยกเลิก
                        </button>
                      </div>
                    </form>
                  </li>
                );
              }

              return (
                <li key={student.studentId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 font-semibold truncate">
                        {student.numberInClass ? student.numberInClass + ". " : ""}
                        {student.fullName}
                        {student.nickname ? " (" + student.nickname + ")" : ""}
                      </p>
                      <p className="text-xs text-slate-500">รหัสนักเรียน: {student.studentId}</p>
                      {student.activities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {student.activities.map((activity) => (
                            <ActivityBadge key={`${student.studentId}-${activity.name}`} name={activity.name} color={activity.color} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openActivityEditor(student)}
                      className="bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    >
                      แก้กิจกรรม
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(student)}
                      className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget({ studentId: student.studentId, fullName: student.fullName });
                        setDeleteTarget(null);
                      }}
                      className="bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-amber-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    >
                      รีเซ็ตรหัส
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget({ studentId: student.studentId, fullName: student.fullName });
                        setResetTarget(null);
                      }}
                      className="bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-rose-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    >
                      ลบ
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activityEditor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setActivityEditor(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white font-bold text-lg mb-1">แก้กิจกรรมนักเรียน</h4>
            <p className="text-slate-400 text-sm mb-4">{activityEditor.fullName}</p>
            <div className="max-h-72 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              {activities.map((activity) => {
                const checked = activityEditor.selectedIds.includes(activity.id);
                return (
                  <label key={activity.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 cursor-pointer hover:border-indigo-500/30">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ActivityBadge name={activity.name} color={activity.color} />
                        {!activity.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400">ไม่ใช้งาน</span>}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setActivityEditor((current) =>
                          current
                            ? {
                                ...current,
                                selectedIds: e.target.checked
                                  ? [...current.selectedIds, activity.id]
                                  : current.selectedIds.filter((id) => id !== activity.id),
                              }
                            : current,
                        )
                      }
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitActivityEdit} disabled={pending} className="flex-grow rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 transition-colors">
                {pending ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
              </button>
              <button onClick={() => setActivityEditor(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setDeleteTarget(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full border flex items-center justify-center text-2xl font-bold bg-rose-500/15 border-rose-500/30 text-rose-300">
              ✕
            </div>
            <h4 className="text-white font-bold text-lg mb-1.5">ลบนักเรียน</h4>
            <p className="text-slate-300 text-sm leading-relaxed">
              ต้องการลบ <strong className="text-white">{deleteTarget.fullName}</strong> (รหัส {deleteTarget.studentId}) ออกจากห้องเรียนใช่หรือไม่
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => doDelete(deleteTarget.studentId)}
                className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold py-3 transition-colors"
              >
                {pending ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-5 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setResetTarget(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full border flex items-center justify-center text-2xl font-bold bg-amber-500/15 border-amber-500/30 text-amber-300">
              !
            </div>
            <h4 className="text-white font-bold text-lg mb-1.5">รีเซ็ตรหัสผ่าน</h4>
            <p className="text-slate-300 text-sm leading-relaxed">
              ตั้งรหัสของ <strong className="text-white">{resetTarget.fullName}</strong> กลับเป็น <strong className="text-amber-300">รหัสนักเรียน</strong> ({resetTarget.studentId})<br />
              ระบบจะบังคับให้เปลี่ยนรหัสใหม่เมื่อล็อกอินครั้งถัดไป
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => doResetPassword(resetTarget.studentId)}
                className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 transition-colors"
              >
                {pending ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
              </button>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-5 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
