import type { Handler } from "aws-lambda";
import { apolloLeadDraftFromEvent, mapApolloTitleToVertical } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { upsertMarketingContact } from "../../lib/rapid-iq/marketing-contacts-upsert.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const repo = new SalesLeadRepository();
const auditRepo = new AuditRepository();

function failure(message: string) {
  return { ok: false as const, error: message.replace(/^VALIDATION:/, "") };
}

async function syncMarketingStores(draft: {
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  title?: string;
  agencyCompany: string;
  state?: string;
  apolloContactId?: string;
}): Promise<void> {
  if (!draft.email?.includes("@")) return;
  try {
    const vertical = mapApolloTitleToVertical(draft.title, draft.agencyCompany);
    const result = await upsertMarketingContact({
      email: draft.email,
      vertical,
      firstName: draft.firstName,
      lastName: draft.lastName,
      name: draft.name,
      title: draft.title,
      agencyName: draft.agencyCompany,
      state: draft.state,
      source: "apollo",
      sourceId: draft.apolloContactId,
    });
    console.log(
      JSON.stringify({
        type: "apollo_marketing_sync",
        email: draft.email,
        ok: result.ok,
        ...(result.ok
          ? { marketingLead: result.marketingLead, emailList: result.emailList, vertical: result.vertical }
          : { reason: result.reason }),
      }),
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        type: "apollo_marketing_sync_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * Apollo workflow entry. Invoked directly by the Apollo AWS action.
 * Creates a NEW sales lead, or returns the existing lead when the email or Apollo id already exists.
 * Also dual-writes to marketing-leads + email-list (never overwrites curated rows / suppressed).
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
      await syncMarketingStores(draft);
      return { ok: true as const, created: false, leadId: existing.leadId };
    }

    const now = new Date().toISOString();
    const leadId = makeId("lead");
    const vertical = mapApolloTitleToVertical(draft.title, draft.agencyCompany);
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
      vertical: vertical === "unknown" ? undefined : vertical,
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

    await syncMarketingStores(draft);

    return { ok: true as const, created: true, leadId };
  } catch (err) {
    console.error(JSON.stringify({ type: "apollo_lead_ingest_failed", message: err instanceof Error ? err.message : String(err) }));
    return failure("Could not create the lead");
  }
};
