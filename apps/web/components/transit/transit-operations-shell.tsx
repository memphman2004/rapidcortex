"use client";

import type { ReactNode } from "react";
import { Bus } from "lucide-react";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TransitNav } from "./transit-nav";
import { T, TRANSIT_DASHBOARD_FONT_FAMILY, TRANSIT_TAGLINE } from "./transit-theme";
import { transitAlertLabel } from "./transit-alert-strip";
import type { TransitAlertLevel } from "rapid-cortex-shared";

export function TransitOperationsShell(props: {
  transitName: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  alertLevel?: TransitAlertLevel;
  children: ReactNode;
}) {
  return (
    <ThemeProvider storageKey="rc-theme-transit">
      <TransitOperationsShellInner {...props} />
    </ThemeProvider>
  );
}

function TransitOperationsShellInner({
  transitName,
  linkBase,
  userEmail,
  userRole,
  agencyId,
  userId,
  alertLevel = "nominal",
  children,
}: {
  transitName: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  alertLevel?: TransitAlertLevel;
  children: ReactNode;
}) {
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();

  return (
    <HelpChrome role={userRole ?? "transit_admin"}>
      <div
        ref={rootRef}
        data-theme={theme}
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: T.bg,
          color: T.textPrimary,
          colorScheme: theme,
          fontFamily: TRANSIT_DASHBOARD_FONT_FAMILY,
        }}
      >
        <header
          style={{
            background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            padding: "0 16px",
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: T.blueDim,
                border: `1px solid ${T.blue}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bus size={16} color={T.blue} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Rapid Cortex</div>
              <div style={{ fontSize: 10, color: T.textSecondary, letterSpacing: "0.05em" }}>
                TRANSIT OPERATIONS
              </div>
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: T.border }} />
          <span
            style={{
              background: T.surfaceAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {transitName.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: T.textSecondary, flex: 1 }}>{TRANSIT_TAGLINE}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: T.blue,
              border: `1px solid ${T.blue}`,
              borderRadius: 6,
              padding: "3px 8px",
            }}
          >
            {transitAlertLabel(alertLevel)}
          </span>
          <CampusDashboardHeaderUtilities
            email={userEmail}
            role={userRole}
            agencyId={agencyId}
            userId={userId}
            leadingSlot={<ThemeToggle />}
          />
        </header>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <TransitNav linkBase={linkBase} userRole={userRole} />
          <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
        </div>
      </div>
    </HelpChrome>
  );
}
