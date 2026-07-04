"use client";

import { useState, useTransition } from "react";
import { createStudent, deactivateStudent, renumberStudents, updateStudent } from "@/lib/actions/students";
import { PopupAlertModal } from "@/app/_components/PopupAlert";

type Student = { studentId: string; fullName: string; nickname: string | null; numberInClass: number | null };

type FormState = { studentId: string; fullName: string; nickname: string; numberInClass: string };

const EMPTY_FORM: FormState = { studentId: "", fullName: "", nickname: "", numberInClass: "" };

function sortStudents(items: Student[]): Student[] {
  const copy = items.slice();
  copy.sort((a, b) => {
    const an = a.numberInClass === null ? Number.POSITIVE_INFINITY : a.numberInClass;
    const bn = b.numberInClass === null ? Number.POSITIVE_INFINITY : b.numberInClass;
    if (an !== bn) return an - bn;
    return a.studentId.localeCompare(b.studentId);
  });
  return copy;
}

export default function ManageStudentsClient({ classroomId, students }: { classroomId: number; students: Student[] }) {
  const [list, setList] = useState<Student[]>(students);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingRenumber, setConfirmingRenumber] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(s: Student) {
    setEditingId(s.studentId);
    setEditForm({
      studentId: s.studentId,
      fullName: s.fullName,
      nickname: s.nickname || "",
      numberInClass: s.numberInClass === null ? "" : String(s.numberInClass),
    });
    setConfirmingDeleteId(null);
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createStudent(addForm);
      if (result.ok) {
        const newStudent: Student = {
          studentId: addForm.studentId.trim(),
          fullName: addForm.fullName.trim(),
          nickname: addForm.nickname.trim() === "" ? null : addForm.nickname.trim(),
          numberInClass: addForm.numberInClass.trim() === "" ? null : Number(addForm.numberInClass),
        };
        setList(sortStudents(list.concat([newStudent])));
        setAddForm(EMPTY_FORM);
        setShowAdd(false);
      }
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateStudent(editForm.studentId, editForm);
      if (result.ok) {
        const updated = list.map((s) => {
          if (s.studentId !== editForm.studentId) return s;
          return {
            studentId: s.studentId,
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

  function doRenumber() {
    setMessage(null);
    startTransition(async () => {
      const result = await renumberStudents();
      if (result.ok) {
        setList(sortStudents(list).map((student, index) => ({ ...student, numberInClass: index + 1 })));
      }
      setConfirmingRenumber(false);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  function doDelete(studentId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await deactivateStudent(studentId);
      if (result.ok) {
        setList(list.filter((s) => s.studentId !== studentId));
      }
      setConfirmingDeleteId(null);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  const inputClass =
    "w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  return (
    <div className="space-y-6">
      <PopupAlertModal alert={message ? { type: message.type, message: message.text } : null} onClose={() => setMessage(null)} />

      <div className="glass-panel rounded-2xl p-5">
        {!showAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
          >
            + เพิ่มนักเรียนใหม่
          </button>
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
                setConfirmingDeleteId(null);
              }}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              จัดเรียงเลขที่ใหม่
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">ยังไม่มีนักเรียนในห้องนี้</div>
        ) : (
          <ul className="divide-y divide-slate-900/60 overflow-y-auto max-h-[60vh]">
            {list.map((s) => {
              if (editingId === s.studentId) {
                return (
                  <li key={s.studentId} className="px-5 py-4">
                    <form onSubmit={submitEdit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          placeholder="เลขที่ในห้อง"
                          value={editForm.numberInClass}
                          onChange={(e) => setEditForm({ ...editForm, numberInClass: e.target.value })}
                          className={inputClass}
                        />
                        <div className="text-xs text-slate-500 flex items-center px-1">รหัสนักเรียน: {s.studentId} (แก้ไม่ได้)</div>
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
                <li key={s.studentId} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 font-semibold truncate">
                      {s.numberInClass ? s.numberInClass + ". " : ""}
                      {s.fullName}
                      {s.nickname ? " (" + s.nickname + ")" : ""}
                    </p>
                    <p className="text-xs text-slate-500">รหัสนักเรียน: {s.studentId}</p>
                  </div>
                  {confirmingDeleteId === s.studentId ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => doDelete(s.studentId)}
                        className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(s.studentId)}
                        className="bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-rose-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      >
                        ลบ
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
