"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 70; // px pull distance needed to trigger
const MAX_PULL = 110; // px max visual pull

export default function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0); // current visual offset
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    function atTop() {
      return window.scrollY <= 0;
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      if (!atTop()) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      if (!atTop()) {
        active.current = false;
        setPull(0);
        return;
      }
      // rubber-band resistance
      const dist = Math.min(MAX_PULL, dy * 0.5);
      setPull(dist);
      if (dist > 4 && e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else {
        setPull(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, router]);

  const progress = Math.min(1, pull / THRESHOLD);
  const visible = pull > 0 || refreshing;
  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-hidden={!visible}
      className="fixed left-0 right-0 top-0 z-[90] flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${pull - 44}px)`,
        opacity: visible ? 1 : 0,
        transition: active.current ? "none" : "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      <div className="mt-3 h-10 w-10 rounded-full bg-slate-900/90 border border-slate-700 shadow-lg flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className={`w-5 h-5 text-indigo-400 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={
              refreshing || ready
                ? "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                : "M12 4.5v15m0 0l6-6m-6 6l-6-6"
            }
          />
        </svg>
      </div>
    </div>
  );
}
