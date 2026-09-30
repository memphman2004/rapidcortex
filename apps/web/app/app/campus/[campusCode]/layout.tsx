import type { ReactNode } from "react";
import type { AgencyTenant, CampusInstitutionType } from "rapid-cortex-shared";
import { CampusShellChrome } from "./_components/CampusShellChrome";
import { CampusShellThemeRoot } from "./_components/CampusShellThemeRoot";
import { HelpChrome } from "@/components/help/help-chrome";
import { CampusSiteScopeProvider } from "@/lib/campus/use-campus-site-scope";
import { CampusInstitutionProvider } from "@/lib/campus/use-campus-institution";
import { campusSettingsFromAgency } from "@/lib/campus/campus-settings-mapper";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { VerticalAlertOverlay } from "@/components/alerts/vertical-alert-overlay";

async function resolveInitialInstitutionType(
  agencyId: string,
): Promise<CampusInstitutionType | undefined> {
  if (!agencyId.trim()) return undefined;
  try {
    const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}`);
    if (!res.ok) return undefined;
    const raw = (await res.json()) as AgencyTenant & { data?: AgencyTenant };
    const agency = (raw.data ?? raw) as AgencyTenant;
    return campusSettingsFromAgency(agency).general.institutionType;
  } catch {
    return undefined;
  }
}

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
  const initialType = await resolveInitialInstitutionType(agencyId);

  return (
    <HelpChrome role={role}>
      <CampusShellThemeRoot>
        <CampusInstitutionProvider agencyId={agencyId} initialType={initialType}>
          <CampusSiteScopeProvider agencyId={agencyId}>
            <VerticalAlertOverlay />
            <CampusShellChrome
              campusCode={campusCode}
              role={role}
              userEmail={user?.email}
              agencyId={agencyId}
            >
              {children}
            </CampusShellChrome>
          </CampusSiteScopeProvider>
        </CampusInstitutionProvider>
      </CampusShellThemeRoot>
    </HelpChrome>
  );
}
