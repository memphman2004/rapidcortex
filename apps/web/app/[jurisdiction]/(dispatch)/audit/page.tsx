import { PsapConsoleHome } from "@/components/psap/psap-console-home";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { requireRole } from "@/lib/auth/require-role";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { formatJurisdictionAgencyName } from "@/lib/psap/format-agency-display-name";

type Props = {
  params: Promise<{ jurisdiction: string }>;
};

export default async function AuditorDashboardPage({ params }: Props) {
  const user = await requireRole([
    "auditor",
    "agencyadmin",
    "agencyit",
    "rcsuperadmin",
  ]);
  const { jurisdiction } = await params;
  const profile = await fetchAgencyProfile(user.agencyId);
  const agencyName =
    profile?.name?.trim() ||
    formatJurisdictionAgencyName(jurisdiction, user.agencyId);
  const displayName =
    user.displayName?.trim() || dashboardDisplayName(user);

  return (
    <PsapConsoleHome
      agencyId={user.agencyId}
      jurisdiction={jurisdiction}
      agencyName={agencyName}
      displayName={displayName}
      userEmail={user.email}
      userRole={user.role}
      userId={user.userId}
    />
  );
}
