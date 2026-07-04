import Link from "next/link";
import { BackgroundGlow, Footer } from "./_components/LegacyChrome";

export default function Home() {
  return (
    <>
      <BackgroundGlow variant="indigo" />
      <main className="flex-grow flex items-center justify-center p-4 safe-px">
        <div className="w-full max-w-full text-center space-y-12 py-12">
          <div className="space-y-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-semibold tracking-wider uppercase mb-2">
              ✨ Smart Morning Assembly Check-in
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-relaxed bg-gradient-to-r from-indigo-200 via-slate-100 to-cyan-200 bg-clip-text text-transparent py-4 px-1">
              ระบบเช็คชื่อเข้าแถวนักเรียน
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto text-base md:text-lg">
              เช็คชื่อเข้าแถวเช้าง่ายๆ ปลอดภัย แม่นยำด้วยระบบพิกัด GPS
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 w-full max-w-full mx-auto">
            <Link href="/login?role=student" className="group relative block p-8 rounded-2xl glass-panel glow-cyan hover:scale-[1.02] transition-all duration-300 hover:border-cyan-500/30 text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full group-hover:bg-cyan-500/10 transition-all" />
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="2 2 20 20" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.9c2.79 0 5.422-.94 7.524-2.512l.14-.1a6.4 6.4 0 00-3.486-4.626M12 12.75a5.25 5.25 0 100-10.5 5.25 5.25 0 000 10.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">สำหรับนักเรียน</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                เข้าเช็คชื่อประจำวัน ตรวจสอบพิกัด และดูประวัติการเข้าแถวของตนเอง
              </p>
              <div className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                เข้าสู่ระบบเช็คชื่อ &rarr;
              </div>
            </Link>

            <Link href="/login?role=teacher" className="group relative block p-8 rounded-2xl glass-panel glow-indigo hover:scale-[1.02] transition-all duration-300 hover:border-indigo-500/30 text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-all" />
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="2 2 20 20" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">สำหรับครูที่ปรึกษา</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                จัดการรหัสผ่านประจำวัน ตรวจเช็ครายชื่อนักเรียนแบบเรียลไทม์ และออกรายงาน
              </p>
              <div className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                เข้าสู่หน้าแดชบอร์ด &rarr;
              </div>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
