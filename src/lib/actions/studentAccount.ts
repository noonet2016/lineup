"use server";

import { revalidatePath } from "next/cache";
import { LINE_CHAT_ID_ERROR, normalizeLineChatId } from "@/lib/lineChatId";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function updateMyLineChatId(rawValue: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return { ok: false, message: "ต้องเข้าสู่ระบบด้วยบัญชีนักเรียน" };
  }

  let lineChatId: string | null;
  try {
    lineChatId = normalizeLineChatId(rawValue);
  } catch {
    return { ok: false, message: LINE_CHAT_ID_ERROR };
  }

  await prisma.student.update({
    where: { studentId: session.id },
    data: { lineChatId },
  });

  revalidatePath("/account");
  return { ok: true, message: "บันทึก LINE ID แล้ว" };
}
