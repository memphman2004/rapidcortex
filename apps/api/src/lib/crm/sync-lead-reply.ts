import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";
import { createHubSpotContactAndDeal } from "./hubspot-sync.js";
import { readHubSpotToken } from "./hubspot-token.js";

export type LeadReplySyncResult = {
  hubspot: "synced" | "skipped" | "failed";
  webhook: "sent" | "skipped" | "failed";
};

function leadPayload(lead: SalesLeadCrmRecord) {
  return {
    leadId: lead.leadId,
    email: lead.email,
    name: lead.name,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    title: lead.title,
    agencyName: lead.agencyName,
    estimatedValue: lead.estimatedValue,
    pipelineStage: lead.pipelineStage,
  };
}

/**
 * Copies a replied lead into HubSpot and the custom webhook.
 * A failure in one destination does not undo the activity log.
 */
export async function syncLeadReply(
  repo: SalesLeadRepository,
  lead: SalesLeadCrmRecord,
): Promise<LeadReplySyncResult> {
  const settings = await repo.getCrmIntegrationSettings();
  const result: LeadReplySyncResult = { hubspot: "skipped", webhook: "skipped" };

  if (settings.hubspot.connected && lead.email.trim() && !lead.hubspotContactId) {
    try {
      const token = await readHubSpotToken();
      if (!token) {
        result.hubspot = "failed";
      } else if (process.env.HUBSPOT_MOCK === "1") {
        await repo.markLeadCrmSync(lead.leadId, {
          hubspotContactId: `mock-contact-${lead.leadId}`,
          hubspotDealId: `mock-deal-${lead.leadId}`,
        });
        result.hubspot = "synced";
      } else {
        const created = await createHubSpotContactAndDeal(token, leadPayload(lead));
        await repo.markLeadCrmSync(lead.leadId, {
          hubspotContactId: created.contactId,
          hubspotDealId: created.dealId,
        });
        result.hubspot = "synced";
      }
    } catch (error) {
      console.error("[crm] HubSpot sync failed", {
        leadId: lead.leadId,
        message: error instanceof Error ? error.message.slice(0, 180) : "error",
      });
      result.hubspot = "failed";
    }
  }

  if (settings.webhook.enabled && settings.webhook.url) {
    try {
      const res = await fetch(settings.webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "lead.replied", lead: leadPayload(lead) }),
        signal: AbortSignal.timeout(5000),
      });
      result.webhook = res.ok ? "sent" : "failed";
    } catch (error) {
      console.error("[crm] webhook failed", {
        leadId: lead.leadId,
        message: error instanceof Error ? error.message.slice(0, 180) : "error",
      });
      result.webhook = "failed";
    }
  }

  return result;
}
