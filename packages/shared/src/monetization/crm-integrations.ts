import { z } from "zod";

/** Dynamo leadId for the platform CRM connection. Never show this row on the board. */
export const CRM_INTEGRATION_SETTINGS_ID = "settings#crm-integrations";

export const HUBSPOT_SECRET_NAME = "rapid-cortex/sales/hubspot-private-app";

export const crmSoonProviderSchema = z.enum(["salesforce", "pipedrive", "zapier"]);
export type CrmSoonProvider = z.infer<typeof crmSoonProviderSchema>;

export const connectHubSpotBodySchema = z
  .object({
    accessToken: z.string().trim().min(20).max(400),
    portalId: z.string().trim().max(32).optional(),
  })
  .strict();
export type ConnectHubSpotBody = z.infer<typeof connectHubSpotBodySchema>;

export const crmNotifyBodySchema = z
  .object({
    provider: crmSoonProviderSchema,
    email: z.string().trim().email().max(320),
  })
  .strict();
export type CrmNotifyBody = z.infer<typeof crmNotifyBodySchema>;

function isPublicHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host === "169.254.169.254" || host === "0.0.0.0") {
    return false;
  }
  if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  return true;
}

export const crmWebhookBodySchema = z
  .object({
    url: z.string().trim().url().max(500),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isPublicHttpsUrl(value.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Webhook URL must be a public https address",
        path: ["url"],
      });
    }
  });
export type CrmWebhookBody = z.infer<typeof crmWebhookBodySchema>;

/** What the leads page is allowed to see. The HubSpot token is never included. */
export type CrmIntegrationSettings = {
  hubspot: {
    connected: boolean;
    portalId?: string;
    connectedAt?: string;
  };
  notify: Partial<Record<CrmSoonProvider, string>>;
  webhook: {
    enabled: boolean;
    url?: string;
  };
};

export type HubSpotLeadInput = {
  leadId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  title?: string;
  agencyName?: string;
  estimatedValue?: number;
  pipelineStage?: string;
};

export function emptyCrmIntegrationSettings(): CrmIntegrationSettings {
  return {
    hubspot: { connected: false },
    notify: {},
    webhook: { enabled: false },
  };
}

/** A logged email is a reply when the advisor says so, or the note says the lead wrote back. */
export function isLeadReply(input: {
  type: string;
  description: string;
  metadata?: Record<string, string>;
}): boolean {
  if (input.metadata?.reply === "true" || input.metadata?.direction === "inbound") return true;
  if (input.type !== "email_logged") return false;
  return /\b(replied|reply|responded|wrote back)\b/i.test(input.description);
}

function splitName(lead: HubSpotLeadInput): { first: string; last: string } {
  if (lead.firstName?.trim() || lead.lastName?.trim()) {
    return { first: lead.firstName?.trim() ?? "", last: lead.lastName?.trim() ?? "" };
  }
  const parts = (lead.name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** Contact plus deal properties for one replied lead. */
export function hubSpotObjectsForLead(lead: HubSpotLeadInput): {
  contact: Record<string, string>;
  deal: Record<string, string>;
} {
  const { first, last } = splitName(lead);
  const agency = lead.agencyName?.trim() || "Unknown agency";
  const contact: Record<string, string> = { email: lead.email.trim() };
  if (first) contact.firstname = first;
  if (last) contact.lastname = last;
  if (lead.phone?.trim()) contact.phone = lead.phone.trim();
  if (lead.title?.trim()) contact.jobtitle = lead.title.trim();
  contact.company = agency;

  const deal: Record<string, string> = {
    dealname: `${agency} — NexCort iQ`,
    description: `Lead ${lead.leadId}. Stage ${lead.pipelineStage ?? "NEW"}. Created from a reply on the NexCort leads CRM.`,
  };
  if (typeof lead.estimatedValue === "number" && lead.estimatedValue > 0) {
    deal.amount = String(Math.round(lead.estimatedValue));
  }
  return { contact, deal };
}

/** Prompt a person can paste into an assistant. It does not contain an API key. */
export function crmAgentPrompt(apiBase: string): string {
  const base = apiBase.replace(/\/$/, "");
  return [
    "You are wiring NexCort iQ Leads CRM into another system.",
    "When a lead replies, create a contact and a deal. Do not invent a second lead.",
    `Read the connection status from GET ${base}/api/rc-admin/leads/integrations.`,
    "HubSpot is already connected from the Integrations page. Do not ask for or print the private app token.",
    "Salesforce, Pipedrive, and Zapier are waitlist only until that card says connected.",
    "A custom webhook, when enabled, receives JSON { event: \"lead.replied\", lead: { leadId, email, agencyName } }.",
    "Never put the HubSpot token, webhook URL, or a Cognito token into chat, logs, or a commit.",
  ].join("\n");
}
