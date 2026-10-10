"use client";

import type { CampusInstitutionType } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { IQReportingPanel } from "@/components/analytics/iq-reporting/IQReportingPanel";
import type { IQVertical } from "@/lib/analytics/iq-reporting-types";
import { isIqReportingEnabled } from "@/lib/runtime-flags";

export function IqReportingMount({
  agencyId,
  vertical,
  institutionType,
  showVerticalSwitcher = false,
}: {
  agencyId: string;
  vertical: IQVertical;
  /** Campus product split — hides Clery KPIs for K-12. */
  institutionType?: CampusInstitutionType;
  /** RC platform dashboards only — vertical product consoles leave this false. */
  showVerticalSwitcher?: boolean;
}) {
  const { user } = useSession();
  if (!isIqReportingEnabled() || !user || !agencyId) return null;
  return (
    <IQReportingPanel
      agencyId={agencyId}
      vertical={vertical}
      user={user}
      institutionType={institutionType}
      showVerticalSwitcher={showVerticalSwitcher}
    />
  );
}
