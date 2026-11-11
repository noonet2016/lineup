import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * School ID photos of students (from projects/student-care, Trainer 2026-11-11).
 * Real student images = PII, and this repo is PUBLIC, so they live OUTSIDE git:
 *   <app root>/storage/student-photos/<studentId>.jpg   (gitignored)
 * Override the folder with STUDENT_PHOTO_DIR (e.g. on Plesk). Served only through the
 * authenticated route /api/student-photo/[studentId] — never from /public.
 */
export function studentPhotoDir(): string {
  return process.env.STUDENT_PHOTO_DIR || path.resolve(process.cwd(), "storage/student-photos");
}

const VALID_ID = /^[0-9A-Za-z]{1,20}$/;

export function studentPhotoPath(studentId: string): string | null {
  if (!VALID_ID.test(studentId)) return null;
  const file = path.join(studentPhotoDir(), `${studentId}.jpg`);
  return existsSync(file) ? file : null;
}

export function readStudentPhoto(studentId: string): Buffer | null {
  const file = studentPhotoPath(studentId);
  return file ? readFileSync(file) : null;
}

/**
 * Avatar URL for teacher-facing views: the school photo when we have one, else the LINE
 * profile picture (which may be null or expired — LightboxThumb falls back to an initial).
 */
export function studentAvatarUrl(studentId: string, linePictureUrl: string | null): string | null {
  return studentPhotoPath(studentId) ? `/api/student-photo/${studentId}` : linePictureUrl;
}
