"use client";

import { useEffect } from "react";

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/** Static marketing sites cannot run edge middleware — redirect desktop first-time visitors to /enter. */
export function MarketingSplashGate() {
  useEffect(() => {
    if (document.cookie.includes("cortex_entered=1")) return;
    if (MOBILE_UA.test(navigator.userAgent)) return;

    const host = window.location.hostname;
    const isMarketingHost =
      host === "rapidcortex.us" ||
      host === "www.rapidcortex.us" ||
      host.startsWith("localhost");
    if (!isMarketingHost || window.location.pathname !== "/") return;

    window.location.replace("/enter");
  }, []);

  return null;
}
