import { randomUUID } from "node:crypto";
import type { ClassifiedSignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { findAgencyContacts } from "../../../lib/rapid-iq/agency-contact-finder.js";
import {
  isTemplateSummary,
  normalizeSourceUrl,
  opportunityDedupeKey,
  signalDedupeKey,
  validateAgencyIsNotSource,
} from "../../../lib/rapid-iq/deduplication.js";
import { scoreOpportunity } from "../../../lib/rapid-iq/opportunity-scorer.js";
import { sendTeamsAlert } from "../../../lib/rapid-iq/teams-notifier.js";
import { syncContactToAddressBook } from "../../../lib/contacts/sync-to-address-book.js";
import { RapidIqContactRepository } from "../../../repositories/rapidIqContactRepository.js";
import { RapidIqOpportunityRepository } from "../../../repositories/rapidIqOpportunityRepository.js";
import { RapidIqSignalRepository } from "../../../repositories/rapidIqSignalRepository.js";
import { RapidIqSourceRepository } from "../../../repositories/rapidIqSourceRepository.js";
import type { RapidIqContact, RapidIqSource } from "rapid-cortex-shared";

const oppRepo = new RapidIqOpportunityRepository();
const sigRepo = new RapidIqSignalRepository();
const srcRepo = new RapidIqSourceRepository();
const contactRepo = new RapidIqContactRepository();

const GENERIC_TITLE_NAMES = [
  "communications director",
  "911 director",
  "ems director",
  "procurement officer",
  "procurement contact",
  "county manager",
  "city manager",
  "public safety director",
  "emergency management director",
  "campus police chief",
  "it / cad manager",
  "director of public safety",
];

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

function deriveSourceRole(
  signalType: string | null,
  sourceType: string,
  index: number,
): RapidIqSource["sourceRole"] {
  // First source on an opportunity is always primary.
  if (index === 0) return "primary";

  // Source type takes precedence over signal type so every tab is not "budget".
  if (sourceType === "grant_db" || sourceType === "grants_gov") return "budget";
  if (sourceType === "procurement_portal" || sourceType === "sam_gov") return "procurement";
  if (signalType === "rfp" || signalType === "rfi") return "procurement";
  if (signalType === "budget" || signalType === "grant") return "budget";
  if (sourceType === "government_doc" || sourceType === "news" || sourceType === "trade_publication") {
    return "supporting";
  }

  return "supporting";
}

function deriveDocumentType(signalType: string | null, sourceType: string): string {
  if (sourceType === "grant_db" || sourceType === "grants_gov") return "grant";
  if (sourceType === "news" || sourceType === "trade_publication" || sourceType === "association") {
    return "news";
  }
  if (sourceType === "government_doc") {
    if (signalType === "meeting_minutes") return "minutes";
    if (signalType === "budget") return "budget_pdf";
    if (signalType === "rfp" || signalType === "rfi") return "rfp";
    return "agenda";
  }
  return "agenda";
}

function isUsableContact(contact: Omit<RapidIqContact, "opportunityId"> | RapidIqContact): boolean {
  const name = contact.name?.trim() ?? "";
  const email = contact.email?.trim() ?? "";
  const phone = contact.phone?.trim() ?? "";
  if (!name && !email && !phone) return false;
  if (name && GENERIC_TITLE_NAMES.some((t) => name.toLowerCase() === t)) return false;
  return true;
}

export type UpsertSignalResult = {
  opportunityId: string;
  created: boolean;
  saved: boolean;
  reason?: string;
};

export async function upsertSignalAndOpportunity(
  classified: ClassifiedSignal,
  sourceUrl: string,
  agencyFallback: string,
  sourceType: string,
  jurisdictionId: string,
): Promise<UpsertSignalResult> {
  const agencyName = classified.agencyName?.trim() || agencyFallback;
  const sourceName = agencyFallback;

  const agencyCheck = validateAgencyIsNotSource(agencyName, sourceName, {
    city: classified.city,
    county: classified.county,
  });
  if (!agencyCheck.ok) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_signal_rejected",
        reason: agencyCheck.reason,
        agency: agencyName,
        source: sourceName,
      }),
    );
    return { opportunityId: "", created: false, saved: false, reason: agencyCheck.reason };
  }

  if (!classified.isRelevant) {
    return { opportunityId: "", created: false, saved: false, reason: "not_relevant" };
  }

  if (isTemplateSummary(classified.aiSummary)) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_signal_rejected",
        reason: "template_summary",
        agency: agencyName,
        source: sourceName,
      }),
    );
    return { opportunityId: "", created: false, saved: false, reason: "template_summary" };
  }

  const state = (classified.state ?? jurisdictionId.split("#")[1] ?? "XX").toUpperCase().slice(0, 2);
  const opportunityId = opportunityDedupeKey(agencyName, state);
  const now = new Date().toISOString();
  const existing = await oppRepo.get(opportunityId);
  const scores = scoreOpportunity({
    scoreContrib: classified.scoreContrib,
    intentStage: classified.intentStage,
    hasDollarValue: Boolean(classified.dollarValue),
    vertical: classified.vertical,
  });

  const docUrlCandidate = classified.sourceDocUrl?.trim() || sourceUrl;
  const pdf = isPdfUrl(docUrlCandidate);
  const sourceDocUrl = pdf ? docUrlCandidate : null;

  const opportunity = {
    opportunityId,
    vertical: classified.vertical,
    rcProduct: classified.rcProduct ?? "core",
    agencyName,
    agencyType: classified.agencyType ?? "county_911",
    city: classified.city ?? "",
    state,
    county: classified.county ?? "",
    population: classified.population,
    opportunityScore: Math.max(scores.opportunityScore, existing?.opportunityScore ?? 0),
    fitScore: scores.fitScore,
    intentStage: classified.intentStage ?? "awareness",
    estimatedDecisionDays: null,
    incumbentVendor: classified.incumbentVendor,
    contractExpirySignal: false,
    estimatedDollarValue: classified.dollarValue,
    dollarValueSource: classified.dollarValueContext,
    aiHeadline: classified.aiHeadline ?? `${agencyName} procurement signal`,
    aiSummary: classified.aiSummary ?? "",
    talkingPoints: existing?.talkingPoints ?? null,
    signalCount: (existing?.signalCount ?? 0) + 1,
    lastSignalAt: now,
    detectedAt: existing?.detectedAt ?? now,
    lastRefreshedAt: now,
    status: existing?.status ?? ("new" as const),
    convertedLeadId: existing?.convertedLeadId ?? null,
    assignedTo: existing?.assignedTo ?? null,
    notes: existing?.notes ?? null,
    tags: classified.tags.length ? classified.tags : (existing?.tags ?? ["OPPORTUNITY"]),
    isActNow: scores.isActNow || (existing?.isActNow ?? false),
  };

  await oppRepo.put(opportunity);

  const canonicalSourceUrl = normalizeSourceUrl(sourceUrl);
  const signalId = signalDedupeKey(opportunityId, canonicalSourceUrl, classified.aiHeadline ?? "signal");
  await sigRepo.put({
    signalId,
    opportunityId,
    signalType: classified.signalType ?? "meeting_minutes",
    title: classified.aiHeadline ?? "Signal",
    summary: classified.aiSummary ?? "",
    excerpt: classified.excerpt ?? "",
    sourceName,
    sourceType,
    sourceUrl: canonicalSourceUrl,
    sourceDocUrl,
    pageReference: null,
    publishedAt: now,
    detectedAt: now,
    scoreContrib: classified.scoreContrib,
  });

  const existingSources = await srcRepo.listByOpportunity(opportunityId);
  const isDuplicateSource = existingSources.some(
    (s) => normalizeSourceUrl(s.url).toLowerCase() === canonicalSourceUrl.toLowerCase(),
  );
  if (isDuplicateSource) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_source_skipped_duplicate",
        url: canonicalSourceUrl,
        opportunityId,
      }),
    );
  } else {
    await srcRepo.put({
      sourceId: `src#${signalId}`,
      opportunityId,
      sourceRole: deriveSourceRole(classified.signalType, sourceType, existingSources.length),
      title: classified.aiHeadline ?? "Source document",
      url: canonicalSourceUrl,
      docUrl: sourceDocUrl,
      documentType: deriveDocumentType(classified.signalType, sourceType),
      excerpt: classified.excerpt,
      pageReference: null,
      publishedAt: now,
      retrievedAt: now,
    });
  }

  // Fire Teams Adaptive Card for high-score opps (Power Automate webhook already provisioned).
  // LA28 / RAMP alerts are always sent from ramp-collector (every opp, branded card) — skip here.
  const isLa28 = opportunity.tags.some((t) => t.toUpperCase() === "LA28 OLYMPICS");
  if (opportunity.opportunityScore >= 85 && !isLa28) {
    void sendTeamsAlert({
      opportunityId,
      agencyName: opportunity.agencyName,
      state: opportunity.state,
      opportunityScore: opportunity.opportunityScore,
      intentStage: opportunity.intentStage,
      estimatedDollarValue: opportunity.estimatedDollarValue,
      tags: opportunity.tags,
      aiHeadline: opportunity.aiHeadline,
      incumbentVendor: opportunity.incumbentVendor,
      agencyType: opportunity.agencyType,
    }).catch((err) =>
      console.error(
        JSON.stringify({
          msg: "rapid_iq_teams_alert_failed",
          opportunityId,
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
    );
  }

  const existingContacts = await contactRepo.listByOpportunity(opportunityId);

  for (const ent of classified.mentionedEntities.slice(0, 3)) {
    const name = ent.name?.trim() ?? "";
    if (!name) continue;
    if (GENERIC_TITLE_NAMES.some((t) => name.toLowerCase() === t)) continue;
    const title = ent.role || "Contact";
    const isDuplicate = existingContacts.some(
      (existing) =>
        (existing.name?.toLowerCase() === name.toLowerCase() && name) ||
        (existing.title.toLowerCase() === title.toLowerCase() && existing.roleTier === "primary"),
    );
    if (isDuplicate) continue;
    const contact = {
      contactId: randomUUID(),
      opportunityId,
      name,
      title,
      roleTier: "primary" as const,
      matchType: "mentioned" as const,
      matchedOn: ent.role || "mentioned",
      verificationStatus: "unverified" as const,
      verificationSource: null,
      sourceCount: 1,
      verifiedAt: null,
      sourceUrl: null,
      email: null,
      emailVerified: false,
      phone: null,
      linkedInUrl: null,
    };
    if (!isUsableContact(contact)) continue;
    await contactRepo.put(contact);
    existingContacts.push(contact);
  }

  try {
    const contacts = await findAgencyContacts({
      agencyName,
      agencyType: classified.agencyType ?? "county_911",
      city: classified.city ?? "",
      state,
      vertical: classified.vertical,
      jurisdictionId,
    });
    let written = 0;
    for (const contact of contacts) {
      if (existingContacts.length + written >= 5) break;
      if (!isUsableContact(contact)) continue;
      const isDuplicate = existingContacts.some(
        (existing) =>
          existing.title.toLowerCase() === contact.title.toLowerCase() &&
          existing.roleTier === contact.roleTier,
      );
      if (isDuplicate) continue;
      await contactRepo.put({ ...contact, opportunityId });
      written++;
      void syncContactToAddressBook(contact, {
        agencyName,
        opportunityId,
        vertical: classified.vertical,
        source: "rapid_iq",
      });
    }
    if (written > 0) {
      console.log(
        JSON.stringify({
          msg: "rapid_iq_contacts_found",
          opportunityId,
          contactCount: written,
        }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rapid_iq_contact_finder_error",
        opportunityId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return { opportunityId, created: !existing, saved: true };
}
