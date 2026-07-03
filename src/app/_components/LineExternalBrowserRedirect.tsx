"use client";

import { useEffect } from "react";

/**
 * LINE's in-app browser blocks the app-handoff LINE Login needs, failing with a
 * generic "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" error. LINE's own fix: append
 * `openExternalBrowser=1` to the URL, which makes its in-app browser bounce the
 * page open in the device's real browser instead. Do this once, automatically,
 * on every page — most students will land here via a link shared in a LINE chat.
 */
export default function LineExternalBrowserRedirect() {
  useEffect(() => {
    const isLineInAppBrowser = /\bLine\//.test(navigator.userAgent);
    const alreadyRedirected = new URLSearchParams(window.location.search).has("openExternalBrowser");
    if (isLineInAppBrowser && !alreadyRedirected) {
      const url = new URL(window.location.href);
      url.searchParams.set("openExternalBrowser", "1");
      window.location.href = url.toString();
    }
  }, []);

  return null;
}
