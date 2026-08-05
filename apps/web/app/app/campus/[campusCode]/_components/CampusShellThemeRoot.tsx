"use client";

import type { ReactNode } from "react";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "@/components/campus/campus-dashboard-font";

/** Wraps the campus shell layout with independent theme state (rc-theme-campus). */
export function CampusShellThemeRoot({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider storageKey="rc-theme-campus">
      <CampusShellThemeRootInner>{children}</CampusShellThemeRootInner>
    </ThemeProvider>
  );
}

function CampusShellThemeRootInner({ children }: { children: ReactNode }) {
  const { rootRef } = useThemeRoot<HTMLDivElement>();

  return (
    <div
      ref={rootRef}
      data-theme="dark"
      className="min-h-screen"
      style={{
        background: "var(--rc-bg)",
        color: "var(--rc-text-primary)",
        fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY,
      }}
    >
      {children}
    </div>
  );
}
