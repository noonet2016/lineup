import Link from "next/link";
import { BackgroundGlow, Footer } from "../_components/LegacyChrome";
import LoginForms from "./LoginForms";

const ERROR_MESSAGES: Record<string, string> = {
  need_login_first: "กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่านก่อน แล้วค่อยเชื่อมบัญชี LINE",
  line_not_linked: "บัญชี LINE นี้ยังไม่ได้เชื่อมกับบัญชีใด — เข้าสู่ระบบด้วยรหัสผ่านก่อน แล้วไปเชื่อมบัญชีที่หน้าบัญชีของฉัน",
  line_exchange_failed: "เชื่อมต่อ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง",
  bad_state: "คำขอไม่ถูกต้องหรือหมดอายุ ลองใหม่อีกครั้ง",
  missing_code: "คำขอไม่สมบูรณ์ ลองใหม่อีกครั้ง",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; role?: string }> }) {
  const { error, role } = await searchParams;
  const activeRole = role === "teacher" ? "teacher" : "student";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" : null;
  const lineButton = (
    <a
      href="/api/auth/line/start?mode=login"
      className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl py-3 px-4 bg-transparent border border-slate-700 text-slate-200 font-semibold transition-colors hover:bg-slate-800/70 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500/40"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06C755" className="w-5 h-5 shrink-0">
        <path d="M12 2C6.477 2 2 5.686 2 10.222c0 4.06 3.522 7.462 8.283 8.109.323.07.762.213.873.49.1.25.066.642.032.895l-.14.86c-.043.25-.198.984.86.537 1.058-.447 5.71-3.362 7.788-5.758C21.1 13.55 22 11.98 22 10.222 22 5.686 17.523 2 12 2z" />
      </svg>
      เข้าสู่ระบบด้วย LINE
    </a>
  );

  const dividerText = "หรือ";

  return (
    <>
      <BackgroundGlow variant={activeRole === "teacher" ? "purple" : "cyan"} />
      <main className="flex-grow w-full max-w-md mx-auto flex flex-col justify-center items-center p-4 safe-px relative overflow-hidden">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className={`inline-block text-sm font-extrabold tracking-[0.3em] uppercase mb-1 ${activeRole === "teacher" ? "text-indigo-400" : "text-cyan-400"}`}>
              LineUp
            </div>
            <h1 className={`text-3xl font-bold leading-relaxed py-1 bg-gradient-to-r bg-clip-text text-transparent ${activeRole === "teacher" ? "from-indigo-400 to-purple-400" : "from-cyan-400 to-indigo-400"}`}>
              {activeRole === "teacher" ? "ระบบจัดการสำหรับครู" : "ระบบเช็คชื่อนักเรียน"}
            </h1>
            <p className="text-slate-400 mt-2">
              {activeRole === "teacher" ? "จัดการดูแลการเข้าแถวและการรายงานผลกิจกรรม" : "ลงทะเบียนเช็คอินเข้าแถวประจำวันสำหรับนักเรียน"}
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-8 shadow-2xl relative">
            <div className="grid grid-cols-2 gap-1 mb-6 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
              <Link
                href="/login?role=student"
                className={`text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${activeRole === "student" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                🧑‍🎓 นักเรียน
              </Link>
              <Link
                href="/login?role=teacher"
                className={`text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${activeRole === "teacher" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                🧑‍🏫 ครูที่ปรึกษา
              </Link>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {errorMessage}
              </div>
            )}

            <LoginForms initialRole={activeRole} />
            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-slate-700/70 flex-1" />
              <span className="text-xs text-slate-500 whitespace-nowrap">{dividerText}</span>
              <div className="h-px bg-slate-700/70 flex-1" />
            </div>
            {lineButton}
          </div>

          <div className="text-center mt-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-300 transition-colors">
              &larr; กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
