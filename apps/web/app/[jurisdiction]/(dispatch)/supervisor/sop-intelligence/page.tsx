"use client";

import { useSession } from "@/components/auth/session-context";
import { SopIntelligenceDashboard } from "@/components/sop-intelligence/sop-intelligence-dashboard";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { formatJurisdictionAgencyName } from "@/lib/psap/format-agency-display-name";
import { isSopIntelligenceEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorSopIntelligencePage() {
  const { user } = useSession();
  const jurisdiction = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();

  if (!isSopIntelligenceEnabled()) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        SOP Intelligence is not enabled for this deployment.
      </div>
    );
  }

  if (!isSupervisorOrStaffRole(user?.role) && user?.role !== "agencyadmin") {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName = user.displayName?.trim() || dashboardDisplayName(user);
  const agencyName = formatJurisdictionAgencyName(jurisdiction, user.agencyId);

  return (
    <SopIntelligenceDashboard user={user} agencyName={agencyName} displayName={displayName} />
  );
}
