import type { ReactNode } from "react";
import { CampusNav } from "./_components/CampusNav";
import { CampusShellHeader } from "./_components/CampusShellHeader";
import { CampusShellThemeRoot } from "./_components/CampusShellThemeRoot";
import { HelpChrome } from "@/components/help/help-chrome";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

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

  return (
    <HelpChrome role={role}>
      <CampusShellThemeRoot>
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-5">
          <CampusShellHeader
            campusCode={campusCode.toUpperCase()}
            role={role}
            userEmail={user?.email}
            agencyId={user?.agencyId}
            leadingSlot={<ThemeToggle variant="inline" />}
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
      </CampusShellThemeRoot>
    </HelpChrome>
  );
}
