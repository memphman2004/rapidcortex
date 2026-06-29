import type { IntegrationStatusPayload } from "@/lib/api";

export type IntegrationHealthRow = {
  name: string;
  type: string;
  status: "connected" | "error" | "degraded" | "offline";
  lastSyncAt: string | null;
};

function transcriptStatus(
  source: IntegrationStatusPayload["transcriptSource"],
): IntegrationHealthRow["status"] {
  if (source.connectorActive) return "connected";
  if (source.agencyEligible) return "degraded";
  return "offline";
}

/** Maps `GET /api/integration/status` into dashboard widget rows. */
export function integrationHealthRowsFromStatus(
  data: IntegrationStatusPayload,
): IntegrationHealthRow[] {
  const rows: IntegrationHealthRow[] = [
    {
      name: "Transcript connector",
      type: "transcript",
      status: transcriptStatus(data.transcriptSource),
      lastSyncAt: null,
    },
  ];

  const pr = data.pilotReadiness;
  if (!pr) return rows;

  rows.push(
    {
      name: "Language sessions",
      type: "multilingual",
      status: pr.languageSessionsConfigured ? "connected" : "error",
      lastSyncAt: null,
    },
    {
      name: "Multilingual validation",
      type: "multilingual",
      status:
        pr.multilingualIssueCount > 0
          ? "degraded"
          : pr.multilingualStrictValidation
            ? "connected"
            : "offline",
      lastSyncAt: null,
    },
    {
      name: "AI providers",
      type: "ai",
      status: pr.aiPrimaryProvider ? "connected" : "error",
      lastSyncAt: null,
    },
    {
      name: "Assets bucket",
      type: "storage",
      status: pr.assetsBucketConfigured ? "connected" : "error",
      lastSyncAt: null,
    },
  );

  return rows;
}

export function countIntegrationHealthErrors(rows: IntegrationHealthRow[]): number {
  return rows.filter((row) => row.status === "error" || row.status === "offline").length;
}
