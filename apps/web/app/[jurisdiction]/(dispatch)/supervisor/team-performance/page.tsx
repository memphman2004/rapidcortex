"use client";

import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorTeamPerformancePage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <FeatureRoutePlaceholder
      title="Team Performance"
      featureId="team_performance_dashboards"
      summary="Team-level performance dashboard and trend review workspace."
    />
  );
}
