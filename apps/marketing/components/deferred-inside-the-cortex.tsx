"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const InsideTheCortexPopup = dynamic(
  () =>
    import("@/components/InsideTheCortexPopup").then((m) => ({
      default: m.InsideTheCortexPopup,
    })),
  { ssr: false },
);

/**
 * Lead popup waits 2.5s internally — delay mounting so its chunk is not on the
 * initial network waterfall (Soro / Lighthouse "content finished").
 */
export function DeferredInsideTheCortex() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(start, { timeout: 4000 });
      return () => cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(start, 2500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!ready) return null;
  return <InsideTheCortexPopup />;
}
