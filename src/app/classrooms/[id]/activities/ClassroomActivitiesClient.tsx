"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActivityBadge from "@/app/_components/ActivityBadge";
import { PopupAlertModal, usePopupAlert } from "@/app/_components/PopupAlert";
import { setActivityMembersInClassroom } from "@/lib/actions/activities";

type ActivityOption = { id: number; name: string; color: string };
type Student = { studentId: string; fullName: string; nickname: string | null; numberInClass: number | null; activityIds: number[] };

type EditorState = { activityId: number; name: string; color: string; selectedIds: string[]; query: string } | null;

function studentLabel(student: Student) {
  const base = student.nickname ? `${student.fullName} (${student.nickname})` : student.fullName;
  return student.numberInClass ? `${student.numberInClass}. ${base}` : base;
}

export default function ClassroomActivitiesClient({
  classroomId,
  activities,
  students: initialStudents,
}: {
  classroomId: number;
  activities: ActivityOption[];
  students: Student[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [editor, setEditor] = useState<EditorState>(null);
  const { alert, setAlert, showResult } = usePopupAlert();
  const [pending, startTransition] = useTransition();

  const memberCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const student of students) for (const activityId of student.activityIds) counts.set(activityId, (counts.get(activityId) ?? 0) + 1);
    return counts;
  }, [students]);

  function openEditor(activity: ActivityOption) {
    setEditor({
      activityId: activity.id,
      name: activity.name,
      color: activity.color,
      selectedIds: students.filter((s) => s.activityIds.includes(activity.id)).map((s) => s.studentId),
      query: "",
    });
  }

  function toggle(studentId: string) {
    setEditor((current) => {
      if (!current) return current;
      const has = current.selectedIds.includes(studentId);
      return { ...current, selectedIds: has ? current.selectedIds.filter((id) => id !== studentId) : [...current.selectedIds, studentId] };
    });
  }

  function save() {
    if (!editor) return;
    const target = editor;
    startTransition(async () => {
      const result = await setActivityMembersInClassroom(target.activityId, classroomId, target.selectedIds);
      if (result.ok) {
        const selected = new Set(target.selectedIds);
        setStudents((prev) =>
          prev.map((s) => {
            const without = s.activityIds.filter((id) => id !== target.activityId);
            return { ...s, activityIds: selected.has(s.studentId) ? [...without, target.activityId] : without };
          }),
        );
        setEditor(null);
        showResult(result);
        router.refresh();
      } else {
        showResult(result);
      }
    });
  }

  const filteredStudents = useMemo(() => {
    if (!editor) return [];
    const q = editor.query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => studentLabel(s).toLowerCase().includes(q) || s.studentId.includes(q));
  }, [editor, students]);

  return (
    <div className="space-y-4">
      <PopupAlertModal alert={alert} onClose={() => setAlert(null)} />

      {activities.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center text-slate-500">ยังไม่มีกิจกรรม — ผู้ดูแลระบบเพิ่มได้ที่หน้าจัดการระบบ</div>
      ) : (
        activities.map((activity) => (
          <div key={activity.id} className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <ActivityBadge name={activity.name} color={activity.color} />
              <span className="text-sm text-slate-400">{memberCount.get(activity.id) ?? 0} คนในห้องนี้</span>
            </div>
            <button
              type="button"
              onClick={() => openEditor(activity)}
              className="shrink-0 bg-violet-500/15 border border-violet-500/30 text-violet-200 text-sm font-bold px-4 py-2 rounded-xl hover:bg-violet-500/25 transition-colors"
            >
              จัดการสมาชิก
            </button>
          </div>
        ))
      )}

      {editor && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm" onClick={() => setEditor(null)}>
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h4 className="text-white font-bold text-lg">จัดการสมาชิก</h4>
                <ActivityBadge name={editor.name} color={editor.color} />
              </div>
              <p className="text-slate-400 text-xs mt-1">เลือกนักเรียนในห้องที่อยู่กิจกรรมนี้ ({editor.selectedIds.length} คน)</p>
              <input
                value={editor.query}
                onChange={(e) => setEditor((c) => (c ? { ...c, query: e.target.value } : c))}
                placeholder="ค้นหาชื่อ / เลขที่ / รหัส"
                className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div className="overflow-auto p-2 flex-1">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">ไม่พบนักเรียน</div>
              ) : (
                filteredStudents.map((student) => {
                  const checked = editor.selectedIds.includes(student.studentId);
                  return (
                    <label key={student.studentId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${checked ? "bg-violet-500/10" : "hover:bg-slate-800/60"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(student.studentId)} className="w-4 h-4 accent-violet-500" />
                      <span className="text-sm text-slate-200">{studentLabel(student)}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={() => setEditor(null)} className="flex-1 bg-slate-800 text-slate-200 font-bold py-2.5 rounded-xl hover:bg-slate-700 transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={save} disabled={pending} className="flex-1 bg-violet-500 text-white font-bold py-2.5 rounded-xl hover:bg-violet-600 transition-colors disabled:opacity-60">
                {pending ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
