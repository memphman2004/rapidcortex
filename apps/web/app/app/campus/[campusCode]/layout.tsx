import type { ReactNode } from "react";
import { CampusNav } from "./_components/CampusNav";
import { CampusShellHeader } from "./_components/CampusShellHeader";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "@/components/campus/campus-dashboard-font";
import { HelpChrome } from "@/components/help/help-chrome";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Matches campus console mockup tokens (bg / surface). */
const SHELL = {
  bg: "#090d1a",
  surface: "#0d1321",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
} as const;

export default async function CampusShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SUPERVISOR";

  return (
    <HelpChrome role={role}>
      <div
        className="min-h-screen"
        style={{
          background: SHELL.bg,
          color: SHELL.text,
          fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY,
        }}
      >
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-5">
          <CampusShellHeader
            campusCode={campusCode.toUpperCase()}
            role={role}
            userEmail={user?.email}
            agencyId={user?.agencyId}
          />
          <CampusNav campusCode={campusCode} role={role} />
          <div
            className="mt-4 flex-1 rounded-[10px] p-4"
            style={{
              background: SHELL.surface,
              border: `1px solid ${SHELL.border}`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
