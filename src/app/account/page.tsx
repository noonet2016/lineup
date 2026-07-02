import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logout } from "@/lib/actions/auth";
import { BackgroundGlow, Footer, StudentShell, TeacherShell } from "../_components/LegacyChrome";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ bound?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { bound, error } = await searchParams;

  const account =
    session.role === "student"
      ? await prisma.student.findUnique({
          where: { studentId: session.id },
          select: { fullName: true, nickname: true, lineUserId: true, classroomId: true },
        })
      : await prisma.teacher.findUnique({
          where: { id: Number(session.id) },
          select: { fullName: true, lineUserId: true },
        });

  if (!account) redirect("/login");

  const advisedClassroom =
    session.role === "teacher" ? await prisma.classroom.findFirst({ where: { advisorId: Number(session.id) } }) : null;

  const content = (
    <main className="max-w-md mx-auto safe-px py-10 space-y-6">
      <h1 className="text-2xl font-extrabold text-white">บัญชีของฉัน</h1>

      {bound === "1" && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
          เชื่อมบัญชี LINE สำเร็จแล้ว
        </div>
      )}
      {error === "line_already_bound" && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
          บัญชี LINE นี้ถูกเชื่อมกับผู้ใช้อื่นไปแล้ว
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5 space-y-2">
        <p className="text-xs text-slate-400">{session.role === "student" ? "นักเรียน" : "ครู"}</p>
        <p className="text-lg font-bold text-white">
          {account.fullName}
          {"nickname" in account && account.nickname ? ` (${account.nickname})` : ""}
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold text-white">การเชื่อมบัญชี LINE</p>
        {account.lineUserId ? (
          <p className="text-sm text-emerald-400">✅ เชื่อมบัญชี LINE แล้ว</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">ยังไม่ได้เชื่อมบัญชี LINE</p>
            <a
              href="/api/auth/line/start?mode=bind"
              className="block text-center bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              เชื่อมบัญชี LINE
            </a>
          </>
        )}
      </div>

      {session.role === "student" && "classroomId" in account && (
        <>
          <a
            href="/checkin"
            className="block text-center bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            เช็คชื่อเข้าแถว
          </a>
          <a
            href={`/classrooms/${account.classroomId}/students/${session.id}`}
            className="block text-center bg-slate-900 border border-slate-800 text-slate-200 font-semibold py-2.5 rounded-xl text-sm"
          >
            ดูประวัติการเช็คชื่อ
          </a>
        </>
      )}

      {session.role === "teacher" && advisedClassroom && (
        <>
          <a
            href={`/classrooms/${advisedClassroom.id}`}
            className="block text-center bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            ไปหน้าห้องเรียน ม.{advisedClassroom.roomName}
          </a>
          <a
            href={`/classrooms/${advisedClassroom.id}/settings`}
            className="block text-center bg-slate-900 border border-slate-800 text-slate-200 font-semibold py-2.5 rounded-xl text-sm"
          >
            ตั้งค่าห้องเรียน
          </a>
        </>
      )}

      <form action={logout}>
        <button type="submit" className="w-full text-center text-rose-400 text-sm py-2">
          ออกจากระบบ
        </button>
      </form>
    </main>
  );

  if (session.role === "student") {
    return <StudentShell active="profile">{content}</StudentShell>;
  }

  if (advisedClassroom) {
    return (
      <TeacherShell active="dashboard" fullName={account.fullName} roomName={advisedClassroom.roomName} classroomId={advisedClassroom.id}>
        {content}
      </TeacherShell>
    );
  }

  return (
    <>
      <BackgroundGlow variant="indigo" />
      {content}
      <Footer />
    </>
  );
}
