export const LINE_CHAT_ID_ERROR = "LINE ID ไม่ถูกต้อง (ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 2-30 ตัว)";

const LINE_CHAT_ID_PATTERN = /^[A-Za-z0-9._-]{2,30}$/;

export function normalizeLineChatId(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/^[@~]/, "");
  if (!normalized) return null;
  if (!LINE_CHAT_ID_PATTERN.test(normalized)) {
    throw new Error(LINE_CHAT_ID_ERROR);
  }

  return normalized;
}

export function lineChatUrl(lineChatId: string): string {
  return `https://line.me/ti/p/~${encodeURIComponent(lineChatId)}`;
}
