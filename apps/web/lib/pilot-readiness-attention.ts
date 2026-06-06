import type { IntegrationStatusPayload } from "@/lib/api";

export type PilotReadinessSeverity = "blocking" | "warning" | "info";

export type PilotReadinessAttentionItem = {
  id: string;
  severity: PilotReadinessSeverity;
  message: string;
};

/**
 * Derives human-readable pilot readiness issues from the same payload as
 * `GET /api/integration/status` (agency-scoped, admin-only). Pure function — no I/O.
 */
export function getPilotReadinessAttentionItems(
  data: IntegrationStatusPayload | null,
): PilotReadinessAttentionItem[] {
  if (!data) return [];

  const items: PilotReadinessAttentionItem[] = [];
  const pr = data.pilotReadiness;
  const ts = data.transcriptSource;

  if (pr) {
    if (pr.multilingualIssueCount > 0) {
      items.push({
        id: "multilingual-issues",
        severity: "blocking",
        message: `Multilingual pipeline reports ${pr.multilingualIssueCount} configuration issue(s). Open Integrations for detail.`,
      });
    }
    if (pr.multilingualStrictValidation && !pr.languageSessionsConfigured) {
      items.push({
        id: "strict-without-sessions",
        severity: "blocking",
        message:
          "Strict multilingual validation is on, but the language sessions table is not configured — segments may be rejected.",
      });
    }
    if (!pr.assetsBucketConfigured) {
      items.push({
        id: "assets-bucket",
        severity: "warning",
        message:
          "Assets S3 bucket is not configured — audio or attachment flows may be degraded for this deployment.",
      });
    }
  }

  if (ts.mode === "off") {
    items.push({
      id: "connector-off",
      severity: "info",
      message:
        "External transcript connector mode is `off` — expect API/manual transcript segments only (no live vendor feed).",
    });
  } else if (ts.mode === "shadow") {
    items.push({
      id: "connector-shadow",
      severity: "info",
      message:
        "Transcript connector is in `shadow` — validate behavior before promoting to `on` for production-shaped traffic.",
    });
  }

  if ((ts.mode === "on" || ts.mode === "shadow") && !ts.agencyEligible) {
    items.push({
      id: "connector-not-allowlisted",
      severity: "warning",
      message:
        "This agency is not allowlisted for the external transcript connector — connector will not activate until configuration changes.",
    });
  }

  return items;
}

export function filterAttentionByMinSeverity(
  items: PilotReadinessAttentionItem[],
  min: PilotReadinessSeverity,
): PilotReadinessAttentionItem[] {
  const order: Record<PilotReadinessSeverity, number> = {
    blocking: 3,
    warning: 2,
    info: 1,
  };
  const floor = order[min];
  return items.filter((i) => order[i.severity] >= floor);
}
