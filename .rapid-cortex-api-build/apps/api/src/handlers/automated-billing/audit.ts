import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export async function writeAutomatedBillingAudit(input: {
  agencyId: string;
  actorId: string;
  type:
    | typeof AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_GENERATED
    | typeof AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_SENT
    | typeof AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_STATUS_CHANGED
    | typeof AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_RESENT;
  invoiceId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: input.agencyId,
      actorId: input.actorId,
      type: input.type,
      resourceType: "billing",
      resourceId: input.invoiceId,
      details: { invoiceId: input.invoiceId, ...(input.details ?? {}) },
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "AUTOMATED_BILLING_AUDIT_FAILED",
        invoiceId: input.invoiceId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
