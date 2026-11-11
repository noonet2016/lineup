import { redirect } from "next/navigation";
import { BackgroundGlow, Footer } from "../../_components/LegacyChrome";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import AdminLoginForm from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.role === "teacher") {
    const teacher = await prisma.teacher.findUnique({
      where: { id: Number(session.id) },
      select: { role: true },
    });
    if (teacher?.role === "admin") redirect("/admin");
  }

  return (
    <>
      <BackgroundGlow variant="purple" />
      <main className="relative flex flex-grow items-center justify-center overflow-hidden p-4 safe-px">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-1 inline-block text-sm font-extrabold uppercase tracking-[0.3em] text-rose-400">LineUp</div>
            <h1 className="bg-gradient-to-r from-indigo-400 to-rose-400 bg-clip-text py-1 text-3xl font-bold leading-relaxed text-transparent">
              เข้าสู่ระบบผู้ดูแลระบบ
            </h1>
            <p className="mt-2 text-slate-400">สำหรับผู้ดูแลระบบเท่านั้น</p>
          </div>
          <section className="glass-panel relative rounded-2xl border border-indigo-500/20 p-8 shadow-2xl">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-white">
              <span className="text-indigo-400">◆</span>
              ผู้ดูแลระบบ
            </h2>
            <AdminLoginForm />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
