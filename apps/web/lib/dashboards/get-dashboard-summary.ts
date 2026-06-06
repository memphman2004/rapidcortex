import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "./dashboard-access";
import type { DashboardMockPayload } from "./mockDashboardData";
import { getMockDashboardPayload } from "./mockDashboardData";

/**
 * Role dashboard summary payload (server-safe).
 * TODO: Replace mock with upstream Lambda once `/api/dashboard/summary` is backed by DynamoDB.
 */
export function getDashboardSummaryForUser(
  prefix: DashboardPrefix,
  user: UserContext,
): DashboardMockPayload {
  return getMockDashboardPayload(prefix, user);
}
