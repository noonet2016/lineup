import { logout } from "@/lib/actions/auth";

type TeacherActive = "dashboard" | "devices" | "exemptions" | "settings" | "report" | "students";
type StudentActive = "checkin" | "history" | "devices" | "profile";

const teacherItems: { key: TeacherActive; label: string; href: string; path: string }[] = [
  {
    key: "dashboard",
    label: "แดชบอร์ด",
    href: "/classrooms",
    path: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  },
  {
    key: "devices",
    label: "สถานะผูก LINE",
    href: "/classrooms",
    path: "M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.5 1.5",
  },
  {
    key: "exemptions",
    label: "ยกเว้นเข้าแถว",
    href: "/classrooms",
    path: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    key: "settings",
    label: "ตั้งค่าระบบ",
    href: "/classrooms",
    path: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.28c-.062-.375-.312-.687-.644-.87a6.52 6.52 0 01-.22-.128c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.759 6.759 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z",
  },
  {
    key: "students",
    label: "จัดการนักเรียน",
    href: "/classrooms",
    path: "M12 4.5v15m7.5-7.5H4.5",
  },
  {
    key: "report",
    label: "ออกรายงาน",
    href: "/classrooms",
    path: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
];

const studentItems: { label: string; href: string; key: StudentActive; path: string }[] = [
  { label: "เช็คชื่อ", href: "/checkin", key: "checkin", path: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "ผลการเช็ค", href: "/account", key: "history", path: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1-1.125 1h-2.25A1.125 1.125 0 0116.5 19.875V4.125z" },
  { label: "อุปกรณ์", href: "/account", key: "devices", path: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" },
  { label: "โปรไฟล์", href: "/account", key: "profile", path: "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" },
];

function Icon({ path, className = "w-5 h-5", strokeWidth = 1.8 }: { path: string; className?: string; strokeWidth?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export function BackgroundGlow({ variant = "cyan" }: { variant?: "cyan" | "indigo" | "purple" }) {
  const first = variant === "cyan" ? "bg-cyan-500/10" : "bg-indigo-500/10";
  const second = variant === "purple" ? "bg-purple-500/5" : variant === "cyan" ? "bg-indigo-500/10" : "bg-cyan-500/10";
  return (
    <>
      <div className={`fixed top-[-20%] left-[-15%] w-[600px] h-[600px] rounded-full ${first} blur-[120px] pointer-events-none`} />
      <div className={`fixed bottom-[-20%] right-[-15%] w-[600px] h-[600px] rounded-full ${second} blur-[120px] pointer-events-none`} />
    </>
  );
}

export function Footer({ bordered = true }: { bordered?: boolean }) {
  return (
    <footer className={`${bordered ? "border-t border-slate-900" : ""} py-6 text-center text-slate-500 text-xs safe-pb safe-px`}>
      <p>&copy; {new Date().getFullYear() + 543} Line up System. พัฒนาโดย Kannokkarn Chaiwongkot</p>
    </footer>
  );
}

export function TeacherShell({
  active,
  fullName,
  roomName,
  classroomId,
  children,
}: {
  active: TeacherActive;
  fullName?: string;
  roomName?: string;
  classroomId?: number;
  children: React.ReactNode;
}) {
  const items = teacherItems.map((item) => ({
    ...item,
    href:
      item.key === "settings" && classroomId
        ? `/classrooms/${classroomId}/settings`
        : item.key === "students" && classroomId
          ? `/classrooms/${classroomId}/students/manage`
        : item.key === "exemptions" && classroomId
          ? `/classrooms/${classroomId}/exemptions`
        : item.key === "devices" && classroomId
          ? `/classrooms/${classroomId}/line-status`
        : item.key === "report" && classroomId
          ? `/classrooms/${classroomId}/report`
        : classroomId
          ? `/classrooms/${classroomId}`
          : item.href,
  }));
  return (
    <>
      <BackgroundGlow variant="purple" />
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 safe-px safe-pt bg-slate-950/90 backdrop-blur border-b border-slate-900">
        <span className="text-slate-300 p-2 -ml-2">☰</span>
        <span className="font-bold text-white tracking-wider text-sm">TEACHER PORTAL</span>
        <form action={logout}>
          <button type="submit" className="text-slate-400 hover:text-rose-400 p-2 -mr-2" aria-label="ออกระบบ">
            ⎋
          </button>
        </form>
      </div>
      <aside className="fixed top-0 left-0 z-50 h-full w-60 bg-slate-950/95 backdrop-blur border-r border-slate-900 hidden md:flex flex-col safe-pt">
        <div className="flex items-center gap-2.5 h-16 px-5 border-b border-slate-900">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          <span className="font-bold text-white tracking-wider text-sm">TEACHER PORTAL</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {items.map((item) => {
            const on = active === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  on ? "bg-indigo-500/15 border-indigo-500/30 text-white" : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60"
                }`}
              >
                <Icon path={item.path} className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="border-t border-slate-900 p-4">
          {fullName && <p className="text-xs text-slate-400 mb-3 px-1 truncate">สวัสดี, {fullName}{roomName ? ` (ม.${roomName})` : ""}</p>}
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-colors">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <div className="md:pl-60 flex min-h-full flex-1 flex-col">
        {children}
        <Footer />
      </div>
    </>
  );
}

export function StudentHeader() {
  return (
    <header className="max-w-xl w-full mx-auto flex justify-between items-center py-4 mb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-sm font-semibold tracking-wider text-cyan-400">STUDENT PORTAL</span>
        </div>
        <a href="/account" className="inline-flex items-center gap-1.5 text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/50 px-3 py-1.5 rounded-full shadow-sm shadow-cyan-500/10 transition-all active:scale-95">
          ลงทะเบียนอุปกรณ์
        </a>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1">
          ออกจากระบบ
        </button>
      </form>
    </header>
  );
}

export function StudentNav({ active }: { active: StudentActive }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/90 backdrop-blur border-t border-slate-900 safe-pb">
      <div className="max-w-xl mx-auto grid grid-cols-4">
        {studentItems.map((item) => {
          const on = active === item.key;
          return (
            <a key={item.key} href={item.href} aria-label={item.label} className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${on ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
              <Icon path={item.path} className="w-6 h-6" strokeWidth={on ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function StudentShell({ active, children }: { active: StudentActive; children: React.ReactNode }) {
  return (
    <>
      <BackgroundGlow variant="cyan" />
      <div className="min-h-full flex flex-1 flex-col p-4 pb-24 safe-px relative overflow-x-hidden">
        <StudentHeader />
        {children}
      </div>
      <StudentNav active={active} />
    </>
  );
}
