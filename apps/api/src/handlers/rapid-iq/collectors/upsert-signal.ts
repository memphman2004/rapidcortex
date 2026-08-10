import { randomUUID } from "node:crypto";
import type { ClassifiedSignal } from "../../../lib/rapid-iq/claude-classifier.js";
import { findAgencyContacts } from "../../../lib/rapid-iq/agency-contact-finder.js";
import { opportunityDedupeKey, signalDedupeKey } from "../../../lib/rapid-iq/deduplication.js";
import { scoreOpportunity } from "../../../lib/rapid-iq/opportunity-scorer.js";
import { RapidIqContactRepository } from "../../../repositories/rapidIqContactRepository.js";
import { RapidIqOpportunityRepository } from "../../../repositories/rapidIqOpportunityRepository.js";
import { RapidIqSignalRepository } from "../../../repositories/rapidIqSignalRepository.js";
import { RapidIqSourceRepository } from "../../../repositories/rapidIqSourceRepository.js";
import type { RapidIqSource } from "rapid-cortex-shared";

const oppRepo = new RapidIqOpportunityRepository();
const sigRepo = new RapidIqSignalRepository();
const srcRepo = new RapidIqSourceRepository();
const contactRepo = new RapidIqContactRepository();

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

function deriveSourceRole(signalType: string | null): RapidIqSource["sourceRole"] {
  if (signalType === "rfp" || signalType === "rfi") return "procurement";
  if (signalType === "budget" || signalType === "grant") return "budget";
  return "primary";
}

function deriveDocumentType(signalType: string | null, sourceType: string): string {
  if (sourceType === "grant_db") return "grant";
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

export async function upsertSignalAndOpportunity(
  classified: ClassifiedSignal,
  sourceUrl: string,
  agencyFallback: string,
  sourceType: string,
  jurisdictionId: string,
): Promise<{ opportunityId: string; created: boolean }> {
  const agencyName = classified.agencyName?.trim() || agencyFallback;
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
    county: classified.county ?? agencyName,
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

  const signalId = signalDedupeKey(opportunityId, sourceUrl, classified.aiHeadline ?? "signal");
  await sigRepo.put({
    signalId,
    opportunityId,
    signalType: classified.signalType ?? "meeting_minutes",
    title: classified.aiHeadline ?? "Signal",
    summary: classified.aiSummary ?? "",
    excerpt: classified.excerpt ?? "",
    sourceName: agencyFallback,
    sourceType,
    sourceUrl,
    sourceDocUrl,
    pageReference: null,
    publishedAt: now,
    detectedAt: now,
    scoreContrib: classified.scoreContrib,
  });

  await srcRepo.put({
    sourceId: `src#${signalId}`,
    opportunityId,
    sourceRole: deriveSourceRole(classified.signalType),
    title: classified.aiHeadline ?? "Source document",
    url: sourceUrl,
    docUrl: sourceDocUrl,
    documentType: deriveDocumentType(classified.signalType, sourceType),
    excerpt: classified.excerpt,
    pageReference: null,
    publishedAt: now,
    retrievedAt: now,
  });

  for (const ent of classified.mentionedEntities.slice(0, 3)) {
    await contactRepo.put({
      contactId: randomUUID(),
      opportunityId,
      name: ent.name,
      title: ent.role || "Contact",
      roleTier: "primary",
      matchType: "mentioned",
      matchedOn: ent.role || "mentioned",
      verificationStatus: "unverified",
      verificationSource: null,
      sourceCount: 1,
      verifiedAt: null,
      sourceUrl: null,
      email: null,
      emailVerified: false,
      phone: null,
      linkedInUrl: null,
    });
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
    for (const contact of contacts) {
      await contactRepo.put({ ...contact, opportunityId });
    }
    if (contacts.length > 0) {
      console.log(
        JSON.stringify({
          msg: "rapid_iq_contacts_found",
          opportunityId,
          contactCount: contacts.length,
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

  return { opportunityId, created: !existing };
}
