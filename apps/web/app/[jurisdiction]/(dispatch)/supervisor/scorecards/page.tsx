"use client";

import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorScorecardsPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <FeatureRoutePlaceholder
      title="Supervisor Scorecards"
      featureId="scorecards"
      summary="Create and review QA scorecards for dispatcher performance management."
    />
  );
}
