"use client";

import { useSession } from "@/components/auth/session-context";
import { PsapConsoleHome } from "@/components/psap/psap-console-home";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { formatJurisdictionAgencyName } from "@/lib/psap/format-agency-display-name";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();
  const jurisdiction =
    useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName =
    user.displayName?.trim() || dashboardDisplayName(user);
  const agencyName = formatJurisdictionAgencyName(jurisdiction, user.agencyId);

  return (
    <PsapConsoleHome
      agencyId={user.agencyId}
      jurisdiction={jurisdiction}
      agencyName={agencyName}
      displayName={displayName}
      userEmail={user.email}
      userRole={user.role}
    />
  );
}
