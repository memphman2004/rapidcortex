import type { SystemStatus } from "@/lib/rapid-cortex/status/status-types";

export const STATUS_LABELS: Record<SystemStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
};

export const OPERATIONAL_HEADLINE = "All Systems Operational";
