"use client";

import { useSession } from "@/components/auth/session-context";
import { IQReportingPanel } from "@/components/analytics/iq-reporting/IQReportingPanel";
import type { IQVertical } from "@/lib/analytics/iq-reporting-types";
import { isIqReportingEnabled } from "@/lib/runtime-flags";

export function IqReportingMount({
  agencyId,
  vertical,
}: {
  agencyId: string;
  vertical: IQVertical;
}) {
  const { user } = useSession();
  if (!isIqReportingEnabled() || !user || !agencyId) return null;
  return <IQReportingPanel agencyId={agencyId} vertical={vertical} user={user} />;
}
