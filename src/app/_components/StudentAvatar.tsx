"use client";

import { LightboxThumb } from "@/app/_components/ImageLightbox";

type AvatarStudent = {
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  photoUrl: string | null;
};

/**
 * Student school photo (tap to enlarge) or an initial when there is no photo.
 * Must be rendered inside a <LightboxProvider>.
 */
export default function StudentAvatar({ student, className }: { student: AvatarStudent; className: string }) {
  if (student.photoUrl) {
    return (
      <LightboxThumb
        src={student.photoUrl}
        alt={student.fullName}
        caption={`${student.numberInClass ?? "-"}. ${student.fullName}${student.nickname ? ` (${student.nickname})` : ""}`}
        className={`${className} border border-slate-800`}
      />
    );
  }
  const initial = student.fullName.replace(/^(นางสาว|นาง|นาย|เด็กหญิง|เด็กชาย)\s*/, "").charAt(0) || "?";
  return (
    <div
      className={`${className} shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
