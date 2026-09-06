import { createHash } from "node:crypto";
import type { UnifiedCadIncident } from "rapid-cortex-shared";

export type DeduplicationResult =
  | { action: "insert"; incident: UnifiedCadIncident }
  | { action: "skip_exact_duplicate" }
  | { action: "mark_cross_connector_duplicate"; canonicalUnifiedId: string };

function normalizeAddress(address: string | undefined): string {
  return (address ?? "")
    .trim()
    .toUpperCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ");
}

export class CadDeduplicationEngine {
  static buildDedupeKey(incident: Pick<
    UnifiedCadIncident,
    "agencyId" | "address" | "incidentType" | "callReceivedAt"
  >): string {
    const minuteBucket = incident.callReceivedAt
      ? Math.floor(Date.parse(incident.callReceivedAt) / 60_000)
      : 0;
    const material = [
      incident.agencyId.trim(),
      normalizeAddress(incident.address),
      (incident.incidentType ?? "").trim().toUpperCase(),
      String(Number.isFinite(minuteBucket) ? minuteBucket : 0),
    ].join("|");
    return createHash("sha256").update(material).digest("hex");
  }

  static evaluateInMemory(
    incident: UnifiedCadIncident,
    existing: UnifiedCadIncident[],
  ): DeduplicationResult {
    const exact = existing.find(
      (row) =>
        row.agencyId === incident.agencyId &&
        row.connectorId === incident.connectorId &&
        row.vendorIncidentId === incident.vendorIncidentId,
    );
    if (exact) return { action: "skip_exact_duplicate" };

    const key = incident.dedupeKey || CadDeduplicationEngine.buildDedupeKey(incident);
    const cross = existing.find(
      (row) =>
        row.agencyId === incident.agencyId &&
        row.dedupeKey === key &&
        row.connectorId !== incident.connectorId &&
        !row.isDuplicate,
    );
    if (cross) {
      return { action: "mark_cross_connector_duplicate", canonicalUnifiedId: cross.unifiedId };
    }
    return { action: "insert", incident: { ...incident, dedupeKey: key, isDuplicate: false } };
  }
}
