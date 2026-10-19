import type { Handler } from "aws-lambda";
import { apolloLeadDraftFromEvent } from "../../../../../packages/shared/src/monetization/apollo-lead.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const repo = new SalesLeadRepository();
const auditRepo = new AuditRepository();

function failure(message: string) {
  return { ok: false as const, error: message.replace(/^VALIDATION:/, "") };
}

/**
 * Apollo workflow entry. Invoked directly by the Apollo AWS action.
 * Creates a NEW sales lead, or returns the existing lead when the email or Apollo id already exists.
 */
export const handler: Handler = async (event) => {
  let draft;
  try {
    draft = apolloLeadDraftFromEvent(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Apollo payload";
    const keys = event && typeof event === "object" ? Object.keys(event as object).slice(0, 20) : [];
    console.error(JSON.stringify({ type: "apollo_lead_rejected", message, keys }));
    return failure(message);
  }

  try {
    const recent = await repo.listRecent(500);
    const existing = recent.find((row) => {
      const sameEmail = row.email?.trim().toLowerCase() === draft.email;
      const sameApollo = draft.apolloContactId && row.apolloContactId === draft.apolloContactId;
      return sameEmail || sameApollo;
    });
    if (existing) {
      return { ok: true as const, created: false, leadId: existing.leadId };
    }

    const now = new Date().toISOString();
    const leadId = makeId("lead");
    await repo.putLead({
      leadId,
      createdAt: now,
      name: draft.name,
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      phone: draft.phone,
      agencyCompany: draft.agencyCompany,
      agencyName: draft.agencyCompany,
      role: draft.title,
      title: draft.title,
      customerType: "agency",
      interestedIn: ["pilot_program"],
      message: "Created from Apollo.",
      source: "apollo",
      status: "new",
      pipelineStage: "NEW",
      apolloContactId: draft.apolloContactId,
      state: draft.state ?? null,
      requestedState: draft.state ?? null,
      requestedCity: draft.city ?? null,
      updatedAt: now,
      updatedBy: "system:apollo",
    });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: "system:apollo",
        type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
        details: { leadId, action: "created_from_apollo", hasApolloId: Boolean(draft.apolloContactId) },
        createdAt: now,
        resourceType: "sales_lead",
        resourceId: leadId,
      });
    } catch {
      /* audit must not undo the lead */
    }

    return { ok: true as const, created: true, leadId };
  } catch (err) {
    console.error(JSON.stringify({ type: "apollo_lead_ingest_failed", message: err instanceof Error ? err.message : String(err) }));
    return failure("Could not create the lead");
  }
};
