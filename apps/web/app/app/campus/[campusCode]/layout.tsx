import type { ReactNode } from "react";
import { CampusNav } from "./_components/CampusNav";
import { CampusShellHeader } from "./_components/CampusShellHeader";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "@/components/campus/campus-dashboard-font";
import { HelpChrome } from "@/components/help/help-chrome";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

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
        className="min-h-screen bg-slate-950 text-slate-100"
        style={{ fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY }}
      >
        <div className="mx-auto max-w-[1600px] px-4 py-6">
          <CampusShellHeader
            campusCode={campusCode.toUpperCase()}
            role={role}
            userEmail={user?.email}
            agencyId={user?.agencyId}
          />
          <CampusNav campusCode={campusCode} role={role} />
          {children}
        </div>
      </div>
    </HelpChrome>
  );
}
