import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { DashboardHomeRenderer } from "./DashboardHomeRenderer";

export async function DashboardPageContent({
  user,
}: {
  prefix: DashboardPrefix;
  user: UserContext;
}) {
  return (
    <DashboardHomeRenderer
      role={user.role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
