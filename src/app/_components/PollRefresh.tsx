"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PollRefreshProps = {
  intervalMs?: number;
};

export default function PollRefresh({ intervalMs = 12000 }: PollRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const interval = setInterval(refreshIfVisible, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);

  // router.refresh() re-runs the current route's Server Components and streams fresh props
  // into the client tree without a full reload or resetting client component state.
  return null;
}
