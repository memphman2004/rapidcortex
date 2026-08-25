/**
 * High-intent enrichment: Apollo (decision-makers) then Hunter (emails).
 * Reuses existing credit-guard + enrich helpers. Mock / missing keys skip.
 */

import { randomBytes } from "node:crypto";
import {
  RAPID_IQ_CONTACT_CONFIDENCE,
  type RapidIqAgencyContact,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { canSpend, spend } from "./credit-guard.js";
import { enrichViaApollo } from "./enrich-apollo.js";
import { enrichViaHunter } from "./enrich-hunter.js";
import { extractContactsFromText } from "./extract-contacts.js";
import { listAgencyContacts, putAgencyContact } from "./rapid-iq-pipeline-db.js";

function newContactId(): string {
  return randomBytes(8).toString("hex");
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function upsertContact(contact: RapidIqAgencyContact): Promise<void> {
  const existing = await listAgencyContacts(contact.agencyId);
  const match = existing.find((c) => {
    if (contact.email && c.email && c.email.toLowerCase() === contact.email.toLowerCase()) return true;
    return nameKey(c.name) === nameKey(contact.name);
  });
  if (match) {
    const merged: RapidIqAgencyContact = {
      ...match,
      title: contact.title || match.title,
      role: contact.role || match.role,
      email: contact.email || match.email,
      phone: contact.phone || match.phone,
      linkedinUrl: contact.linkedinUrl || match.linkedinUrl,
      confidence: Math.max(match.confidence, contact.confidence) as RapidIqAgencyContact["confidence"],
      hunterConfidence: contact.hunterConfidence ?? match.hunterConfidence,
      lastVerified: contact.lastVerified,
      sourceUrl: match.confidence >= contact.confidence ? match.sourceUrl : contact.sourceUrl,
      sourceName: match.confidence >= contact.confidence ? match.sourceName : contact.sourceName,
    };
    await putAgencyContact(merged);
    return;
  }
  await putAgencyContact(contact);
}

/**
 * Pipeline: extract from document → Apollo → Hunter.
 * Safe to fire-and-forget after resolveAgency.
 */
export async function enrichAgencyIntelligence(
  agencyId: string,
  signal: RapidIqPipelineSignal,
): Promise<void> {
  const hay = `${signal.rawTitle}\n${signal.summary ?? ""}\n${signal.rawSnippet}`;
  const extracted = await extractContactsFromText({
    text: hay,
    agencyName: signal.agencyName ?? signal.jurisdiction ?? "Unknown",
    agencyId,
    sourceUrl: signal.sourceUrl,
    hints: signal.contactHints,
  });
  for (const contact of extracted) {
    await upsertContact(contact);
  }

  const combined = signal.combinedScore ?? signal.fitScore;
  if (combined < 60) return;

  const agencyName = signal.agencyName ?? signal.jurisdiction ?? "";
  if (!agencyName) return;

  const apolloCheck = await canSpend("apollo", 1);
  if (apolloCheck.allowed) {
    const { contacts, creditsUsed } = await enrichViaApollo(agencyName, signal.jurisdiction, 3);
    if (creditsUsed > 0) await spend("apollo", creditsUsed);
    const now = new Date().toISOString();
    for (const person of contacts) {
      await upsertContact({
        contactId: newContactId(),
        agencyId,
        name: person.name,
        title: person.title,
        role: person.title,
        email: person.email,
        phone: person.phone,
        linkedinUrl: person.linkedinUrl,
        sourceUrl: "https://apollo.io",
        sourceName: "Apollo",
        confidence: person.email
          ? RAPID_IQ_CONTACT_CONFIDENCE.APOLLO_VERIFIED
          : RAPID_IQ_CONTACT_CONFIDENCE.APOLLO_INFERRED,
        lastVerified: now,
      });
    }
  }

  const hunterCheck = await canSpend("hunter", 1);
  if (!hunterCheck.allowed) return;

  const existing = await listAgencyContacts(agencyId);
  const { contacts, creditsUsed } = await enrichViaHunter(
    agencyName,
    signal.jurisdiction,
    signal.state,
    existing.map((c) => ({ name: c.name, title: c.title })),
    2,
  );
  if (creditsUsed > 0) await spend("hunter", creditsUsed);
  const now = new Date().toISOString();
  for (const person of contacts) {
    await upsertContact({
      contactId: newContactId(),
      agencyId,
      name: person.name,
      title: person.title,
      role: person.title,
      email: person.email,
      sourceUrl: signal.sourceUrl,
      sourceName: "Hunter.io",
      confidence: RAPID_IQ_CONTACT_CONFIDENCE.HUNTER_VERIFIED,
      hunterConfidence: person.confidence,
      lastVerified: now,
    });
  }
}
