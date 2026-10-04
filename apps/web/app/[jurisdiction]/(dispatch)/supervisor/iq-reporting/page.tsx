"use client";

import { useSession } from "@/components/auth/session-context";
import { IqReportingMount } from "@/components/analytics/iq-reporting/IqReportingMount";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorIqReportingPage() {
  const { user } = useSession();
  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }
  return (
    <div style={{ padding: 16 }}>
      <IqReportingMount agencyId={user?.agencyId ?? ""} vertical="911" />
    </div>
  );
}
