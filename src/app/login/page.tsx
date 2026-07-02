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

  return (
    <>
      <BackgroundGlow variant={activeRole === "teacher" ? "purple" : "cyan"} />
      <main className="flex-grow w-full flex flex-col justify-center items-center p-4 safe-px relative overflow-hidden">
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
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {errorMessage}
              </div>
            )}

            <LoginForms initialRole={activeRole} />

            {activeRole === "teacher" && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="h-px bg-slate-800 flex-grow" />
                  <span className="text-xs text-slate-500">หรือ</span>
                  <div className="h-px bg-slate-800 flex-grow" />
                </div>
                <button type="button" className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-200 font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                  </svg>
                  เข้าสู่ระบบด้วย Face ID / ลายนิ้วมือ
                </button>
                <div className="hidden mt-3 p-3 rounded-xl text-sm" />
              </>
            )}
          </div>

          <div className="text-center mt-6 text-sm text-slate-500 flex justify-between px-2">
            <Link href="/" className="hover:text-slate-300 transition-colors">
              &larr; กลับหน้าหลัก
            </Link>
            <Link href={`/login?role=${activeRole === "teacher" ? "student" : "teacher"}`} className={`transition-colors ${activeRole === "teacher" ? "hover:text-cyan-400" : "hover:text-indigo-400"}`}>
              {activeRole === "teacher" ? "เข้าใช้งานสำหรับนักเรียน →" : "เข้าใช้งานสำหรับครูที่ปรึกษา →"}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
