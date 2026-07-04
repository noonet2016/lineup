"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActivityBadge from "@/app/_components/ActivityBadge";
import { PopupAlertModal, usePopupAlert } from "@/app/_components/PopupAlert";
import { assignActivityMembers, createActivity, deleteActivity, updateActivity } from "@/lib/actions/activities";
import { createTeacherWithClassroom, deleteTeacher, resetTeacherPassword, updateTeacher } from "@/lib/actions/admin";
import { createCentralLocation, deleteCentralLocation, updateCentralLocation } from "@/lib/actions/centralLocations";

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

type ActivityRow = {
  id: number;
  name: string;
  color: string;
  isActive: number;
  memberIds: string[];
  memberCount: number;
};

type StudentRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  classroomId: number;
  roomName: string;
};

type ActivityForm = { name: string; color: string; isActive: boolean };
type CentralLocationRow = { id: number; name: string; lat: number; lng: number; radius: number; isActive: boolean };
type CentralLocationForm = { name: string; lat: string; lng: string; radius: string; isActive: boolean };

const DEFAULT_ACTIVITY_FORM: ActivityForm = { name: "", color: "slate", isActive: true };
const DEFAULT_CENTRAL_LOCATION_FORM: CentralLocationForm = { name: "", lat: "", lng: "", radius: "400", isActive: true };
const COLOR_OPTIONS = ["fuchsia", "amber", "lime", "sky", "violet", "rose", "slate"] as const;

function studentLabel(student: StudentRow) {
  const nickname = student.nickname ? ` (${student.nickname})` : "";
  return `${student.fullName}${nickname} · ม.${student.roomName} · ${student.studentId}`;
}

export default function AdminClient({
  ownerId,
  teachers,
  activities: initialActivities,
  centralLocations: initialCentralLocations,
  students,
}: {
  ownerId: number;
  teachers: TeacherRow[];
  activities: ActivityRow[];
  centralLocations: CentralLocationRow[];
  students: StudentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { alert, setAlert, showResult } = usePopupAlert();
  const [resetFor, setResetFor] = useState<TeacherRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showAddPw, setShowAddPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [editFor, setEditFor] = useState<TeacherRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<TeacherRow | null>(null);
  const [tab, setTab] = useState<"teachers" | "activities" | "locations">("teachers");
  const [activities, setActivities] = useState<ActivityRow[]>(initialActivities);
  const [centralLocations, setCentralLocations] = useState<CentralLocationRow[]>(initialCentralLocations);
  const [newActivity, setNewActivity] = useState<ActivityForm>(DEFAULT_ACTIVITY_FORM);
  const [newCentralLocation, setNewCentralLocation] = useState<CentralLocationForm>(DEFAULT_CENTRAL_LOCATION_FORM);
  const [editActivity, setEditActivity] = useState<{ id: number; form: ActivityForm } | null>(null);
  const [editCentralLocation, setEditCentralLocation] = useState<{ id: number; form: CentralLocationForm } | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<number | null>(null);
  const [deleteCentralLocationId, setDeleteCentralLocationId] = useState<number | null>(null);
  const [memberEditor, setMemberEditor] = useState<{ id: number; name: string; selectedIds: string[]; query: string } | null>(null);

  const activityById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  useEffect(() => {
    setCentralLocations(initialCentralLocations);
  }, [initialCentralLocations]);

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

  function createNewActivity(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createActivity(newActivity.name, newActivity.color);
      showResult(result);
      if (result.ok) {
        setNewActivity(DEFAULT_ACTIVITY_FORM);
        router.refresh();
      }
    });
  }

  function centralLocationFormData(form: CentralLocationForm) {
    const formData = new FormData();
    formData.set("loc_name", form.name);
    formData.set("loc_lat", form.lat);
    formData.set("loc_lng", form.lng);
    formData.set("loc_radius", form.radius);
    if (form.isActive) formData.set("loc_active", "1");
    return formData;
  }

  function createNewCentralLocation(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCentralLocation(centralLocationFormData(newCentralLocation));
      showResult(result);
      if (result.ok) {
        setNewCentralLocation(DEFAULT_CENTRAL_LOCATION_FORM);
        router.refresh();
      }
    });
  }

  function saveCentralLocationEdit() {
    if (!editCentralLocation) return;
    const target = editCentralLocation;
    startTransition(async () => {
      const result = await updateCentralLocation(target.id, centralLocationFormData(target.form));
      showResult(result);
      if (result.ok) {
        setEditCentralLocation(null);
        router.refresh();
      }
    });
  }

  function confirmDeleteCentralLocation() {
    if (deleteCentralLocationId === null) return;
    const target = centralLocations.find((location) => location.id === deleteCentralLocationId);
    if (!target) {
      setDeleteCentralLocationId(null);
      return;
    }

    startTransition(async () => {
      const result = await deleteCentralLocation(target.id);
      showResult(result);
      if (result.ok) {
        setCentralLocations((current) => current.filter((location) => location.id !== target.id));
        setDeleteCentralLocationId(null);
      }
    });
  }

  function saveActivityEdit() {
    if (!editActivity) return;
    const target = editActivity;
    startTransition(async () => {
      const result = await updateActivity(target.id, target.form.name, target.form.color, target.form.isActive);
      showResult(result);
      if (result.ok) {
        setEditActivity(null);
        router.refresh();
      }
    });
  }

  function saveMembers() {
    if (!memberEditor) return;
    const target = memberEditor;
    startTransition(async () => {
      const result = await assignActivityMembers(target.id, target.selectedIds);
      showResult(result);
      if (result.ok) {
        setActivities((current) =>
          current.map((activity) =>
            activity.id === target.id
              ? {
                  ...activity,
                  memberIds: target.selectedIds,
                  memberCount: target.selectedIds.length,
                }
              : activity,
          ),
        );
        setMemberEditor(null);
      }
    });
  }

  function confirmDeleteActivity() {
    if (deleteActivityId === null) return;
    const target = activities.find((activity) => activity.id === deleteActivityId);
    if (!target) {
      setDeleteActivityId(null);
      return;
    }

    startTransition(async () => {
      const result = await deleteActivity(target.id);
      showResult(result);
      if (result.ok) {
        setActivities((current) => current.filter((activity) => activity.id !== target.id));
        setDeleteActivityId(null);
      }
    });
  }

  function openMemberEditor(activity: ActivityRow) {
    setMemberEditor({
      id: activity.id,
      name: activity.name,
      selectedIds: activity.memberIds,
      query: "",
    });
  }

  const filteredMemberStudents = useMemo(() => {
    if (!memberEditor) return [];
    const q = memberEditor.query.trim().toLowerCase();
    return students.filter((student) => {
      if (!q) return true;
      return (
        student.fullName.toLowerCase().includes(q) ||
        (student.nickname ?? "").toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q) ||
        student.roomName.toLowerCase().includes(q)
      );
    });
  }, [memberEditor, students]);

  return (
    <main className="max-w-full mx-auto safe-px py-8 space-y-6">
      <PopupAlertModal alert={alert} onClose={() => setAlert(null)} />

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">⚙️ จัดการระบบ</h1>
        <p className="text-slate-400 text-sm mt-1">เฉพาะเจ้าของระบบ</p>
      </div>

      <div className="glass-panel rounded-2xl p-2 shadow-xl flex gap-2">
        <button
          type="button"
          onClick={() => setTab("teachers")}
          className={`flex-1 text-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${tab === "teachers" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-900/70"}`}
        >
          👥 จัดการครู &amp; ห้องเรียน
        </button>
        <button
          type="button"
          onClick={() => setTab("activities")}
          className={`flex-1 text-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${tab === "activities" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-900/70"}`}
        >
          🎗️ กิจกรรมนักเรียน
        </button>
        <button
          type="button"
          onClick={() => setTab("locations")}
          className={`flex-1 text-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${tab === "locations" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-900/70"}`}
        >
          📍 จุดเข้าแถวส่วนกลาง
        </button>
      </div>

      {tab === "teachers" && (
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
      )}

      {tab === "activities" && (
      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">กิจกรรมของโรงเรียน ({activities.length})</h2>
            <p className="text-xs text-slate-400 mt-1">กำหนดชื่อและสี แล้วค่อยจัดนักเรียนเข้ากิจกรรม</p>
          </div>
        </div>

        <form onSubmit={createNewActivity} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] items-end mb-5">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ชื่อกิจกรรม</span>
            <input
              value={newActivity.name}
              onChange={(e) => setNewActivity((current) => ({ ...current, name: e.target.value }))}
              placeholder="เช่น วงโยธวาทิต"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">สี</span>
            <select
              value={newActivity.color}
              onChange={(e) => setNewActivity((current) => ({ ...current, color: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending || !newActivity.name.trim()} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
            + เพิ่มกิจกรรม
          </button>
        </form>

        <ul className="space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              {editActivity?.id === activity.id ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] items-end">
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-2">ชื่อกิจกรรม</span>
                    <input
                      value={editActivity.form.name}
                      onChange={(e) =>
                        setEditActivity((current) => (current ? { ...current, form: { ...current.form, name: e.target.value } } : current))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-400 mb-2">สี</span>
                    <select
                      value={editActivity.form.color}
                      onChange={(e) =>
                        setEditActivity((current) => (current ? { ...current, form: { ...current.form, color: e.target.value } } : current))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {COLOR_OPTIONS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={editActivity.form.isActive}
                      onChange={(e) =>
                        setEditActivity((current) => (current ? { ...current, form: { ...current.form, isActive: e.target.checked } } : current))
                      }
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                    />
                    ใช้งานอยู่
                  </label>
                  <div className="sm:col-span-3 flex gap-2">
                    <button type="button" onClick={saveActivityEdit} disabled={pending} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
                      บันทึก
                    </button>
                    <button type="button" onClick={() => setEditActivity(null)} className="bg-slate-900 border border-slate-800 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActivityBadge name={activity.name} color={activity.color} />
                      {!activity.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400">ไม่ใช้งาน</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">สมาชิก {activity.memberCount} คน</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openMemberEditor(activity)}
                      className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-all"
                    >
                      จัดการสมาชิก
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActivity({ id: activity.id, form: { name: activity.name, color: activity.color, isActive: Boolean(activity.isActive) } })}
                      className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteActivityId(activity.id)}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      )}

      {tab === "locations" && (
      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">จุดเข้าแถวส่วนกลาง ({centralLocations.length})</h2>
            <p className="text-xs text-slate-400 mt-1">ครูที่ปรึกษาจะดึงรายการที่เปิดใช้งานไปคัดลอกเข้าห้องได้</p>
          </div>
        </div>

        <form onSubmit={createNewCentralLocation} className="grid gap-3 sm:grid-cols-[1fr_140px_140px_110px_110px] items-end mb-5">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ชื่อจุด</span>
            <input value={newCentralLocation.name} onChange={(e) => setNewCentralLocation((current) => ({ ...current, name: e.target.value }))} placeholder="เช่น โดมกลาง" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ละติจูด</span>
            <input value={newCentralLocation.lat} onChange={(e) => setNewCentralLocation((current) => ({ ...current, lat: e.target.value }))} placeholder="17.1968614" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">ลองจิจูด</span>
            <input value={newCentralLocation.lng} onChange={(e) => setNewCentralLocation((current) => ({ ...current, lng: e.target.value }))} placeholder="104.0849387" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-400 mb-2">รัศมี</span>
            <input type="number" min={1} value={newCentralLocation.radius} onChange={(e) => setNewCentralLocation((current) => ({ ...current, radius: e.target.value }))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </label>
          <button type="submit" disabled={pending || !newCentralLocation.name.trim()} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
            + เพิ่มจุด
          </button>
          <label className="sm:col-span-5 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={newCentralLocation.isActive} onChange={(e) => setNewCentralLocation((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500" />
            เปิดให้ครูดึงไปใช้
          </label>
        </form>

        <ul className="space-y-3">
          {centralLocations.length === 0 && <li className="px-4 py-6 text-center text-slate-500 text-sm rounded-2xl border border-slate-800 bg-slate-950/40">ยังไม่มีจุดเข้าแถวส่วนกลาง</li>}
          {centralLocations.map((location) => (
            <li key={location.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              {editCentralLocation?.id === location.id ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px_110px] items-end">
                  <input value={editCentralLocation.form.name} onChange={(e) => setEditCentralLocation((current) => (current ? { ...current, form: { ...current.form, name: e.target.value } } : current))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  <input value={editCentralLocation.form.lat} onChange={(e) => setEditCentralLocation((current) => (current ? { ...current, form: { ...current.form, lat: e.target.value } } : current))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  <input value={editCentralLocation.form.lng} onChange={(e) => setEditCentralLocation((current) => (current ? { ...current, form: { ...current.form, lng: e.target.value } } : current))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  <input type="number" min={1} value={editCentralLocation.form.radius} onChange={(e) => setEditCentralLocation((current) => (current ? { ...current, form: { ...current.form, radius: e.target.value } } : current))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  <label className="sm:col-span-4 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={editCentralLocation.form.isActive} onChange={(e) => setEditCentralLocation((current) => (current ? { ...current, form: { ...current.form, isActive: e.target.checked } } : current))} className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500" />
                    เปิดให้ครูดึงไปใช้
                  </label>
                  <div className="sm:col-span-4 flex gap-2">
                    <button type="button" onClick={saveCentralLocationEdit} disabled={pending} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">บันทึก</button>
                    <button type="button" onClick={() => setEditCentralLocation(null)} className="bg-slate-900 border border-slate-800 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm">ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white break-words">{location.name}</span>
                      {!location.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400">ไม่ใช้งาน</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-1">{location.lat}, {location.lng} · รัศมี {location.radius} ม.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => setEditCentralLocation({ id: location.id, form: { name: location.name, lat: String(location.lat), lng: String(location.lng), radius: String(location.radius), isActive: location.isActive } })} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all">แก้ไข</button>
                    <button type="button" onClick={() => setDeleteCentralLocationId(location.id)} className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all">ลบ</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      )}

      {tab === "teachers" && (
      <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">ครูทั้งหมด ({teachers.length})</h2>
        <ul className="divide-y divide-slate-900/60">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white break-words">{teacher.fullName}</span>
                  {teacher.role === "owner" && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">เจ้าของระบบ</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-mono">@{teacher.username}</p>
                <p className="text-[11px] text-slate-400">ห้อง: {teacher.rooms.length ? teacher.rooms.map((r) => `ม.${r}`).join(", ") : "— ยังไม่มีห้อง"}</p>
                {teacher.roomsDetailed.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {teacher.roomsDetailed.map((room) => (
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
                {teacher.id !== ownerId && (
                  <button
                    onClick={() => {
                      setResetFor(teacher);
                      setNewPw("");
                    }}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-all"
                  >
                    รีเซ็ตรหัส
                  </button>
                )}
                <button onClick={() => setEditFor(teacher)} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all">
                  แก้ไข
                </button>
                {teacher.id !== ownerId && (
                  <button onClick={() => setDeleteFor(teacher)} className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all">
                    ลบ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}

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

      {deleteCentralLocationId !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setDeleteCentralLocationId(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full border bg-rose-500/15 border-rose-500/30 text-rose-300 flex items-center justify-center text-2xl">🗑️</div>
            <h4 className="text-white font-bold text-lg mb-1.5">ลบจุดเข้าแถวส่วนกลาง?</h4>
            <p className="text-slate-300 text-sm">
              {centralLocations.find((location) => location.id === deleteCentralLocationId)?.name ?? "จุดที่เลือก"}
            </p>
            <p className="mt-3 text-xs text-slate-400">จุดที่ครูเคยดึงเข้าห้องแล้วจะไม่ถูกลบ เพราะเป็นสำเนาแยกกัน</p>
            <div className="flex gap-2 mt-5">
              <button onClick={confirmDeleteCentralLocation} disabled={pending} className="flex-grow rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold py-2.5 transition-colors">
                {pending ? "กำลังลบ..." : "ลบ"}
              </button>
              <button onClick={() => setDeleteCentralLocationId(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {memberEditor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={() => setMemberEditor(null)}>
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white font-bold text-lg mb-1">จัดการสมาชิกกิจกรรม</h4>
            <p className="text-slate-400 text-sm mb-4">{memberEditor.name}</p>
            <input
              value={memberEditor.query}
              onChange={(e) => setMemberEditor((current) => (current ? { ...current, query: e.target.value } : current))}
              placeholder="ค้นหานักเรียน / ห้อง / รหัส"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-4"
            />
            <div className="max-h-[55vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/40">
              {filteredMemberStudents.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">ไม่พบนักเรียนที่ตรงกับคำค้นหา</div>
              ) : (
                <ul className="divide-y divide-slate-900/60">
                  {filteredMemberStudents.map((student) => {
                    const checked = memberEditor.selectedIds.includes(student.studentId);
                    return (
                      <li key={student.studentId}>
                        <label className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-900/50 cursor-pointer">
                          <div className="min-w-0">
                            <div className="text-sm text-white font-semibold truncate">{studentLabel(student)}</div>
                            <div className="text-[11px] text-slate-500">ห้อง ม.{student.roomName}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setMemberEditor((current) =>
                                current
                                  ? {
                                      ...current,
                                      selectedIds: e.target.checked
                                        ? [...current.selectedIds, student.studentId]
                                        : current.selectedIds.filter((id) => id !== student.studentId),
                                    }
                                  : current,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-xs text-slate-500">เลือกแล้ว {memberEditor.selectedIds.length} คน</p>
              <div className="flex gap-2">
                <button onClick={saveMembers} disabled={pending} className="rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 px-5 transition-colors">
                  {pending ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
                </button>
                <button onClick={() => setMemberEditor(null)} className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 transition-colors">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
