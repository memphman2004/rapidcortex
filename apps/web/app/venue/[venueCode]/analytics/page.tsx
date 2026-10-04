"use client";

import { use } from "react";
import { useSession } from "@/components/auth/session-context";
import { VenueAnalyticsDashboard } from "@/components/venue/rfp/venue-analytics-dashboard";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";
import { IqReportingMount } from "@/components/analytics/iq-reporting/IqReportingMount";

export default function VenueAnalyticsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const code = venueCode.toUpperCase().replace(/-/g, "");
  const { user } = useSession();
  const canExport = canVenueSupervisorOps(user?.role);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <VenueAnalyticsDashboard venueCode={code} canExport={canExport} />
      {user?.agencyId ? <IqReportingMount agencyId={user.agencyId} vertical="venue" /> : null}
    </div>
  );
}
