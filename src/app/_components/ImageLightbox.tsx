"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type LightboxImage = { src: string; caption?: string };
type LightboxContextValue = { open: (img: LightboxImage) => void };

const LightboxContext = createContext<LightboxContextValue | null>(null);

/** Wrap a subtree so any descendant can open a fullscreen image lightbox via useLightbox(). */
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<LightboxImage | null>(null);
  const open = useCallback((img: LightboxImage) => setCurrent(img), []);
  const close = useCallback(() => setCurrent(null), []);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {current && (
        <div
          className="fixed inset-0 z-[130] flex flex-col items-center justify-center p-6 bg-slate-950/85 backdrop-blur-sm motion-safe:animate-[fadeIn_0.15s_ease-out]"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            aria-label="ปิด"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white text-xl font-bold flex items-center justify-center transition-colors"
          >
            ✕
          </button>
          <img
            src={current.src}
            alt={current.caption ?? ""}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-slate-700 motion-safe:animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]"
          />
          {current.caption && (
            <p className="mt-4 text-slate-200 text-sm font-semibold text-center max-w-[90vw] break-words">{current.caption}</p>
          )}
        </div>
      )}
    </LightboxContext.Provider>
  );
}

/** Returns { open } to launch the lightbox. Safe no-op if no provider is mounted. */
export function useLightbox(): LightboxContextValue {
  return useContext(LightboxContext) ?? { open: () => {} };
}

/** A circular avatar thumbnail that opens the shared lightbox on click. Must be rendered inside <LightboxProvider>. */
export function LightboxThumb({
  src,
  caption,
  alt = "",
  className = "",
}: {
  src: string;
  caption?: string;
  alt?: string;
  className?: string;
}) {
  const { open } = useLightbox();
  // LINE profile-picture URLs expire (LINE CDN returns 404). Fall back to an initial avatar
  // instead of a broken-image icon with the alt text bleeding into the circle.
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // An <img> that already failed before hydration never fires React's onError — check on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);
  if (broken) {
    const label = (alt || caption || "?").replace(/^[\d.\s-]+/, "");
    const initial = label.replace(/^(นางสาว|นาง|นาย|เด็กหญิง|เด็กชาย|ด\.ญ\.|ด\.ช\.)\s*/, "").charAt(0) || "?";
    return (
      <div
        className={`shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300 ${className}`}
        title="รูปโปรไฟล์ LINE หมดอายุ"
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open({ src, caption })}
      className={`shrink-0 rounded-full overflow-hidden cursor-zoom-in transition-transform active:scale-95 hover:ring-2 hover:ring-cyan-400/50 ${className}`}
      aria-label="ดูรูปโปรไฟล์ขนาดใหญ่"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className="w-full h-full object-cover" onError={() => setBroken(true)} />
    </button>
  );
}
