"use client";

import { useEffect, useState } from "react";
import { useOptionalSession } from "@/components/auth/session-context";
import { activateDemoSession, isDemoModeActive } from "../engine/demo-mode-gate";
import { useDemoModeActive } from "../hooks/useDemoEngine";
import { DemoControlPanel } from "./DemoControlPanel";
import { DemoHighlightOverlay } from "./DemoHighlightOverlay";
import { DemoIndicatorBanner } from "./DemoIndicatorBanner";

/**
 * Mounted once from the application providers. Renders nothing until Demo Mode
 * is actually on, so production sessions never see demo chrome.
 */
export function DemoModeRoot({ children }: { children: React.ReactNode }) {
  const active = useDemoModeActive();
  const session = useOptionalSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const role = session?.user ? String(session.user.role) : "";
    if (role === "demo" && !isDemoModeActive()) {
      activateDemoSession({ source: "role" });
    }
  }, [session?.user]);

  if (!mounted || !active) return children;

  return (
    <>
      <DemoIndicatorBanner />
      <div className="pt-9">{children}</div>
      <DemoControlPanel />
      <DemoHighlightOverlay />
    </>
  );
}
