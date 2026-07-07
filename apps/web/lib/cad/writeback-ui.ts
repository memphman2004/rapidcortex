import type { CadWritebackAuditRecord } from "rapid-cortex-shared";

export type WritebackApprovalItem = {
  id: string;
  incidentId: string;
  agencyId: string;
  narrative: string;
  cadNatureCode?: string;
  priority?: string;
  units?: string;
  notes?: string;
  submittedBy: string;
  submittedByName?: string;
  submittedAt: string;
  status: "pending_approval" | "approved" | "rejected" | "vendor_rejected";
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  incidentType?: string;
  incidentLocation?: string;
  cadIncidentId?: string;
};

function parsePayload(raw: string): {
  narrative?: string;
  cadNatureCode?: string;
  priority?: string;
  units?: string[];
  notes?: string;
} {
  try {
    return JSON.parse(raw) as ReturnType<typeof parsePayload>;
  } catch {
    return {};
  }
}

export function auditRecordToApprovalItem(row: CadWritebackAuditRecord): WritebackApprovalItem {
  const payload = parsePayload(row.payload);
  const status =
    row.status === "pending_approval"
      ? "pending_approval"
      : row.status === "approved"
        ? "approved"
        : row.status === "failed"
          ? "vendor_rejected"
          : "rejected";

  return {
    id: row.id,
    incidentId: row.incidentId,
    agencyId: row.agencyId,
    narrative: payload.narrative ?? "",
    cadNatureCode: payload.cadNatureCode,
    priority: payload.priority,
    units: Array.isArray(payload.units) ? payload.units.join(", ") : undefined,
    notes: payload.notes,
    submittedBy: row.userId,
    submittedByName: row.userEmail,
    submittedAt: row.createdAt,
    status,
    reviewedBy: row.approvedBy ?? row.rejectedBy,
    reviewedByName: row.approvedBy ?? row.rejectedBy,
    reviewedAt: row.approvedAt ?? row.rejectedAt,
    reviewNotes: row.rejectionReason,
    incidentType: row.cadSystem?.replace(/_/g, " ") ?? row.incidentId,
  };
}

export function incidentToWritebackContext(incident: {
  cadIncidentId?: string | null;
  category?: string;
  urgency?: string;
  callerAddressLine?: string | null;
}) {
  return {
    cadIncidentId: incident.cadIncidentId,
    incidentType: incident.category?.replace(/_/g, " "),
    priority: undefined as string | undefined,
    location: incident.callerAddressLine?.trim() || undefined,
  };
}
