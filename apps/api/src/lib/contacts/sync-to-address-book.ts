import { randomUUID } from "node:crypto";
import type { ContactCompany, ContactPerson } from "rapid-cortex-shared";
import { env } from "../env.js";
import { ContactCompanyRepository } from "../../repositories/contactCompanyRepository.js";
import { ContactPersonRepository } from "../../repositories/contactPersonRepository.js";

const companyRepo = new ContactCompanyRepository();
const personRepo = new ContactPersonRepository();

export type AddressBookSyncContact = {
  name: string | null;
  title?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  linkedInUrl?: string | null;
  verifiedAt?: string | null;
};

function tablesConfigured(): boolean {
  return Boolean(env.contactCompaniesTable?.trim() && env.contactPersonsTable?.trim());
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "Contact" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/**
 * Best-effort sync from Rapid IQ / PSAP enrichment into the Contacts address book.
 * Silent no-op when tables are unset or writes fail.
 */
export async function syncContactToAddressBook(
  contact: AddressBookSyncContact,
  context: {
    agencyName: string;
    opportunityId?: string;
    prospectId?: string;
    vertical?: "911" | "campus" | "venue";
    source?: ContactPerson["source"];
  },
): Promise<void> {
  if (!tablesConfigured()) return;
  const agencyName = context.agencyName?.trim();
  if (!agencyName) return;

  const source = context.source ?? (context.prospectId ? "psap" : "rapid_iq");
  const tag = source === "psap" ? "psap" : "rapid_iq";

  try {
    let company = await companyRepo.findByName(agencyName);
    const now = new Date().toISOString();
    if (!company) {
      company = {
        companyId: `company#${slugify(agencyName) || randomUUID()}`,
        name: agencyName,
        relationshipType: "prospect",
        verticals: context.vertical ? [context.vertical] : ["911"],
        industry: null,
        website: null,
        hq: null,
        phone: null,
        linkedInUrl: null,
        notes:
          source === "psap"
            ? "Auto-created from PSAP Prospect contact enrichment"
            : "Auto-created from Rapid IQ contact enrichment",
        tags: [tag],
        contactCount: 0,
        linkedSignalIds: context.opportunityId ? [context.opportunityId] : [],
        linkedProspectIds: context.prospectId ? [context.prospectId] : [],
        lastActivityAt: now,
        addedBy: `system:${tag}`,
        createdAt: now,
        updatedAt: now,
      } satisfies ContactCompany;
      await companyRepo.put(company);
    } else {
      const signalIds =
        context.opportunityId && !company.linkedSignalIds.includes(context.opportunityId)
          ? [...company.linkedSignalIds, context.opportunityId]
          : company.linkedSignalIds;
      const prospectIds =
        context.prospectId && !company.linkedProspectIds.includes(context.prospectId)
          ? [...company.linkedProspectIds, context.prospectId]
          : company.linkedProspectIds;
      if (signalIds !== company.linkedSignalIds || prospectIds !== company.linkedProspectIds) {
        await companyRepo.update(company.companyId, {
          linkedSignalIds: signalIds,
          linkedProspectIds: prospectIds,
        });
        company = { ...company, linkedSignalIds: signalIds, linkedProspectIds: prospectIds };
      }
    }

    const email = contact.email?.trim() || null;
    if (email) {
      const existing = await personRepo.findByEmailInCompany(company.companyId, email);
      if (existing) return;
    }

    const { firstName, lastName } = splitName(contact.name || contact.title || "Contact");
    const person: ContactPerson = {
      contactId: `contact#${randomUUID()}`,
      companyId: company.companyId,
      companyName: company.name,
      firstName,
      lastName: lastName || "—",
      title: contact.title || null,
      department: null,
      email,
      emailVerified: Boolean(contact.emailVerified),
      phone: contact.phone ?? null,
      mobilePhone: null,
      linkedInUrl: contact.linkedInUrl ?? null,
      location: null,
      notes: null,
      source,
      verifiedAt: contact.verifiedAt ?? null,
      tags: [tag],
      lastContactedAt: null,
      lastContactedBy: null,
      outreachStatus: "not_contacted",
      addedBy: `system:${tag}`,
      createdAt: now,
      updatedAt: now,
    };
    await personRepo.put(person);
    await companyRepo.bumpContactCount(company.companyId, 1);
    await companyRepo.touchActivity(company.companyId, now);
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "contacts_address_book_sync_skipped",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
