import { logout } from "@/lib/actions/auth";
import { TeacherMobileNav } from "@/app/_components/TeacherMobileNav";
import PullToRefresh from "@/app/_components/PullToRefresh";

type TeacherActive = "dashboard" | "devices" | "exemptions" | "leave" | "scanfail" | "settings" | "report" | "students" | "activities";
type StudentActive = "checkin" | "history" | "profile" | "leave";

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
    key: "leave",
    label: "คำขอลา",
    href: "/classrooms",
    path: "M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.008v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.008v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.008v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  {
    key: "scanfail",
    label: "สแกนหน้าไม่ติด",
    href: "/classrooms",
    path: "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88",
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
    key: "activities",
    label: "กิจกรรมนักเรียน",
    href: "/classrooms",
    path: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
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
  { label: "ยื่นขอลา", href: "/leave", key: "leave", path: "M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.008v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.008v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.008v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
  { label: "ผลการเช็ค", href: "/history", key: "history", path: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1-1.125 1h-2.25A1.125 1.125 0 0116.5 19.875V4.125z" },
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
        : item.key === "activities" && classroomId
          ? `/classrooms/${classroomId}/activities`
        : item.key === "exemptions" && classroomId
          ? `/classrooms/${classroomId}/exemptions`
        : item.key === "leave" && classroomId
          ? `/classrooms/${classroomId}/leave-requests`
        : item.key === "scanfail" && classroomId
          ? `/classrooms/${classroomId}/scan-fail`
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
        <TeacherMobileNav items={items} active={active} fullName={fullName} roomName={roomName} />
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
      <div className="md:pl-60 flex min-h-full flex-1 flex-col [&>main]:w-full md:[&>main]:max-w-[60vw]">
        {children}
        <Footer />
      </div>
    </>
  );
}

export function StudentHeader() {
  return (
    <header className="sticky top-0 z-30 mb-3 flex items-center justify-between h-12 px-4 safe-px safe-pt bg-slate-950/90 backdrop-blur border-b border-slate-900">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span className="text-sm font-semibold tracking-wider text-cyan-400">STUDENT PORTAL</span>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
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
      <PullToRefresh />
      <StudentHeader />
      <div className="min-h-full flex flex-1 flex-col px-4 pt-1 pb-24 safe-px relative">
        {children}
      </div>
      <StudentNav active={active} />
    </>
  );
}
