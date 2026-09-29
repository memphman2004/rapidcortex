import type { ReactNode } from "react";
import { CampusNav } from "./_components/CampusNav";
import { CampusShellHeader } from "./_components/CampusShellHeader";
import { CampusShellThemeRoot } from "./_components/CampusShellThemeRoot";
import { HelpChrome } from "@/components/help/help-chrome";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CampusSiteScopeProvider } from "@/lib/campus/use-campus-site-scope";
import { CampusInstitutionProvider } from "@/lib/campus/use-campus-institution";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { VerticalAlertOverlay } from "@/components/alerts/vertical-alert-overlay";
import { CampusK12Banner } from "@/components/campus/k12/CampusK12Banner";

/** Matches campus console mockup tokens (bg / surface). */
const SHELL = {
  surface: "var(--rc-surface)",
  border: "var(--rc-border)",
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
  const agencyId = user?.agencyId ?? "";

  return (
    <HelpChrome role={role}>
      <CampusShellThemeRoot>
        <CampusInstitutionProvider agencyId={agencyId}>
          <CampusSiteScopeProvider agencyId={agencyId}>
            <VerticalAlertOverlay />
            <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-5">
              <CampusShellHeader
                campusCode={campusCode.toUpperCase()}
                role={role}
                userEmail={user?.email}
                agencyId={agencyId}
                leadingSlot={<ThemeToggle variant="inline" />}
              />
              <CampusK12Banner agencyId={agencyId} />
              <div className="mt-4 flex flex-col gap-4 lg:flex-row">
                <CampusNav campusCode={campusCode} role={role} agencyId={agencyId} />
                <div
                  className="min-w-0 flex-1 rounded-[10px] p-4"
                  style={{
                    background: SHELL.surface,
                    border: `1px solid ${SHELL.border}`,
                  }}
                >
                  {children}
                </div>
              </div>
            </div>
          </CampusSiteScopeProvider>
        </CampusInstitutionProvider>
      </CampusShellThemeRoot>
    </HelpChrome>
  );
}
