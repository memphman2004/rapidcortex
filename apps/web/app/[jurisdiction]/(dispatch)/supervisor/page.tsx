"use client";

import { DashboardHomeRenderer } from "@/components/dashboards/DashboardHomeRenderer";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName = user.email?.split("@")[0]?.replace(/[.+_-]/g, " ") ?? "there";

  return (
    <DashboardHomeRenderer
      role={user.role}
      agencyId={user.agencyId}
      displayName={displayName}
    />
  );
}
