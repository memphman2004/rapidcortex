/**
 * Push a pipeline signal into Sales Leads CRM via SalesLeadRepository.putLead,
 * with automatic Apollo → Hunter → NLP contact enrichment and credit guard.
 */

import { randomUUID } from "node:crypto";
import type {
  PushRapidIqPipelineToCrmBody,
  RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { SalesLeadRepository } from "../../../repositories/salesLeadRepository.js";
import { canSpend, spend } from "../../../lib/rapid-iq/pipeline/credit-guard.js";
import { enrichViaApollo } from "../../../lib/rapid-iq/pipeline/enrich-apollo.js";
import { enrichViaHunter } from "../../../lib/rapid-iq/pipeline/enrich-hunter.js";

const leadsRepo = new SalesLeadRepository();

const MAX_APOLLO_CREDITS_PER_PUSH = 3;
const MAX_HUNTER_CREDITS_PER_PUSH = 2;

export type EnrichmentSource = "apollo" | "hunter" | "nlp";

export interface PipelineCrmEnrichmentMeta {
  apolloCreditsUsed: number;
  hunterCreditsUsed: number;
  sources: EnrichmentSource[];
  log: string[];
}

export interface PipelineCrmPushResult {
  leadId: string;
  enrichment: PipelineCrmEnrichmentMeta;
}

interface EnrichedContact {
  name: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  source: EnrichmentSource;
}

async function enrichContacts(
  signal: RapidIqPipelineSignal,
  body: PushRapidIqPipelineToCrmBody,
): Promise<{
  contacts: EnrichedContact[];
  apolloCreditsUsed: number;
  hunterCreditsUsed: number;
  enrichmentLog: string[];
}> {
  const log: string[] = [];
  let apolloCreditsUsed = 0;
  let hunterCreditsUsed = 0;
  let contacts: EnrichedContact[] = [];

  if (body.overrideContact?.email) {
    log.push("Manual contact override provided — skipping enrichment");
    return {
      contacts: [
        {
          name: `${body.overrideContact.firstName} ${body.overrideContact.lastName}`.trim(),
          firstName: body.overrideContact.firstName,
          lastName: body.overrideContact.lastName,
          title: body.overrideContact.title,
          email: body.overrideContact.email,
          source: "nlp",
        },
      ],
      apolloCreditsUsed: 0,
      hunterCreditsUsed: 0,
      enrichmentLog: log,
    };
  }

  const agencyName = signal.agencyName ?? signal.jurisdiction ?? "Unknown Agency";

  const apolloCheck = await canSpend("apollo", 1);
  if (apolloCheck.allowed) {
    log.push(`Apollo: ${apolloCheck.remaining} credits remaining this cycle`);
    const apolloCap = Math.min(MAX_APOLLO_CREDITS_PER_PUSH, apolloCheck.remaining);

    try {
      const { contacts: apolloContacts, creditsUsed } = await enrichViaApollo(
        agencyName,
        signal.jurisdiction,
        apolloCap,
      );

      if (creditsUsed > 0) {
        const recheck = await canSpend("apollo", creditsUsed);
        if (recheck.allowed) {
          await spend("apollo", creditsUsed);
          apolloCreditsUsed = creditsUsed;
          log.push(
            `Apollo: found ${apolloContacts.length} contacts, spent ${creditsUsed} credits`,
          );
        } else {
          log.push(
            `Apollo: found contacts but spend blocked (${recheck.reason ?? "limit"}) — not charging`,
          );
        }
      } else {
        log.push("Apollo: no contacts found (0 credits spent)");
      }

      contacts = apolloContacts.map((c) => ({
        name: c.name,
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        email: c.email,
        phone: c.phone,
        source: "apollo" as const,
      }));
    } catch (err) {
      log.push(`Apollo enrichment failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  } else {
    log.push(
      `Apollo: credit limit reached (${apolloCheck.used}/${apolloCheck.limit} used). ${apolloCheck.reason ?? ""}`.trim(),
    );
  }

  const needsHunter = contacts.filter((c) => c.email).length === 0;
  if (needsHunter) {
    const hunterCheck = await canSpend("hunter", 1);
    if (hunterCheck.allowed) {
      log.push(`Hunter: ${hunterCheck.remaining} credits remaining this cycle`);
      const hunterCap = Math.min(MAX_HUNTER_CREDITS_PER_PUSH, hunterCheck.remaining);

      try {
        const { contacts: hunterContacts, creditsUsed } = await enrichViaHunter(
          agencyName,
          signal.jurisdiction,
          signal.state,
          signal.contactHints ?? [],
          hunterCap,
        );

        if (creditsUsed > 0) {
          const recheck = await canSpend("hunter", creditsUsed);
          if (recheck.allowed) {
            await spend("hunter", creditsUsed);
            hunterCreditsUsed = creditsUsed;
            log.push(
              `Hunter: found ${hunterContacts.length} contacts, spent ${creditsUsed} credits`,
            );
          } else {
            log.push(
              `Hunter: found contacts but spend blocked (${recheck.reason ?? "limit"}) — not charging`,
            );
          }
        } else {
          log.push("Hunter: no contacts found (0 credits spent)");
        }

        contacts = [
          ...contacts,
          ...hunterContacts.map((c) => ({
            name: c.name,
            firstName: c.firstName ?? "",
            lastName: c.lastName ?? "",
            title: c.title,
            email: c.email,
            phone: undefined,
            source: "hunter" as const,
          })),
        ];
      } catch (err) {
        log.push(`Hunter enrichment failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    } else {
      log.push(
        `Hunter: credit limit reached (${hunterCheck.used}/${hunterCheck.limit} used).`,
      );
    }
  }

  if (contacts.length === 0 && signal.contactHints && signal.contactHints.length > 0) {
    log.push(
      "Using NLP-extracted contact hints (no enrichment credits available/successful)",
    );
    const hint = signal.contactHints[0]!;
    const parts = hint.name.trim().split(/\s+/).filter(Boolean);
    contacts = [
      {
        name: hint.name,
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" ") || "",
        title: hint.title,
        source: "nlp",
      },
    ];
  }

  return { contacts, apolloCreditsUsed, hunterCreditsUsed, enrichmentLog: log };
}

export async function createCrmLeadFromPipelineSignal(
  signal: RapidIqPipelineSignal,
  body: PushRapidIqPipelineToCrmBody,
  pushedBy: string,
): Promise<PipelineCrmPushResult> {
  const leadId = randomUUID();
  const now = new Date().toISOString();

  const agencyName =
    body.overrideAgencyName?.trim() ||
    signal.agencyName ||
    signal.jurisdiction ||
    "Unknown Agency";

  const { contacts, apolloCreditsUsed, hunterCreditsUsed, enrichmentLog } =
    await enrichContacts(signal, body);

  const primaryContact = contacts[0];
  const override = body.overrideContact;

  const enrichmentSummary =
    contacts.length > 0
      ? `Contacts enriched via ${[...new Set(contacts.map((c) => c.source))].join(" + ")} (${apolloCreditsUsed} Apollo + ${hunterCreditsUsed} Hunter credits)`
      : "No enrichment contacts found — manual research required";

  const enrichmentLogBlock =
    enrichmentLog.length > 0
      ? ["Enrichment log:", ...enrichmentLog.map((l) => `  · ${l}`)].join("\n")
      : null;

  const signalNote = [
    `Signal from Rapid IQ Pipeline — pushed by ${pushedBy}`,
    `Source: ${signal.sourceId} | Score: ${signal.fitScore}/100 (${signal.fitLabel.toUpperCase()} FIT)`,
    `Signal Date: ${signal.signalDate}`,
    signal.vendorNamed ? `Vendor: ${signal.vendorNamed}` : null,
    signal.fundingSource ? `Funding: ${signal.fundingSource}` : null,
    signal.procurementType ? `Procurement: ${signal.procurementType}` : null,
    signal.dollarAmount != null ? `Amount: $${signal.dollarAmount.toLocaleString()}` : null,
    "",
    `Summary: ${signal.summary ?? signal.rawTitle}`,
    "",
    `Enrichment: ${enrichmentSummary}`,
    enrichmentLogBlock,
    "",
    `Source URL: ${signal.sourceUrl}`,
    body.notes?.trim() ? `\nNotes: ${body.notes.trim()}` : null,
  ]
    .filter((x) => x != null)
    .join("\n");

  const firstName =
    primaryContact?.firstName || override?.firstName || "Rapid";
  const lastName =
    primaryContact?.lastName || override?.lastName || "IQ";
  const email =
    primaryContact?.email ||
    override?.email ||
    `rapid-iq+${leadId.slice(0, 8)}@rapidcortex.us`;
  const phone = primaryContact?.phone;
  const role = primaryContact?.title || override?.title;

  await leadsRepo.putLead({
    leadId,
    name:
      primaryContact?.name?.trim() ||
      (override ? `${override.firstName} ${override.lastName}`.trim() : agencyName),
    email,
    phone: phone || undefined,
    role: role || undefined,
    agencyCompany: agencyName,
    customerType: "agency",
    interestedIn: ["dashboard_platform", "pilot_program"],
    message: signalNote.slice(0, 5000),
    createdAt: now,
    source: "rapid-iq",
    status: "new",
    pipelineStage: "NEW",
    assignee: pushedBy,
    notes: [
      {
        noteId: randomUUID(),
        text: signalNote.slice(0, 2000),
        authorId: pushedBy,
        authorName: pushedBy,
        createdAt: now,
      },
    ],
    attribution: {
      channel: "contact_sales",
      channelLabel: "Rapid IQ Pipeline",
      landingPage: "/rc-admin/rapid-iq",
      firstTouchAt: now,
      utmSource: signal.sourceId,
      utmCampaign: signal.signalId,
    },
  });

  const sources = [...new Set(contacts.map((c) => c.source))];

  return {
    leadId,
    enrichment: {
      apolloCreditsUsed,
      hunterCreditsUsed,
      sources,
      log: enrichmentLog,
    },
  };
}
