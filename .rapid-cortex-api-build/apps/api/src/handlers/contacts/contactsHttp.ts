/**
 * RC Admin Contacts address book — /api/contacts/*
 * Companies + persons for sales CRM (rcsuperadmin / rcadmin).
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  canAccessContactsModule,
  createCompanyBodySchema,
  createContactBodySchema,
  relationshipTypeSchema,
  updateCompanyBodySchema,
  updateContactBodySchema,
  type ContactCompany,
  type ContactPerson,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ContactCompanyRepository } from "../../repositories/contactCompanyRepository.js";
import { ContactPersonRepository } from "../../repositories/contactPersonRepository.js";

const companyRepo = new ContactCompanyRepository();
const personRepo = new ContactPersonRepository();
const auditRepo = new AuditRepository();

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body) as unknown;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessContactsModule(user.role)) return forbidden();

  const m = method(event);
  const path = pathOf(event);
  const actor = user.email ?? user.userId;

  try {
    // GET /api/contacts/search?q=
    if (m === "GET" && path.endsWith("/search")) {
      const q = event.queryStringParameters?.q ?? "";
      const items = await personRepo.search(q, 50);
      return ok({ items, success: true });
    }

    // GET /api/contacts/companies
    if (m === "GET" && /\/companies\/?$/.test(path)) {
      const typeRaw = event.queryStringParameters?.relationshipType;
      const parsedType = typeRaw ? relationshipTypeSchema.safeParse(typeRaw) : null;
      const items = parsedType?.success
        ? await companyRepo.listByType(parsedType.data)
        : await companyRepo.listAll();
      const q = (event.queryStringParameters?.q ?? "").trim().toLowerCase();
      const vertical = event.queryStringParameters?.vertical?.trim();
      const filtered = items.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.tags.some((t) => t.toLowerCase().includes(q))) {
          return false;
        }
        if (vertical && vertical !== "all" && !c.verticals.includes(vertical as never) && !c.verticals.includes("all")) {
          return false;
        }
        return true;
      });
      return ok({ items: filtered, success: true });
    }

    // POST /api/contacts/companies
    if (m === "POST" && /\/companies\/?$/.test(path)) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = createCompanyBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const now = new Date().toISOString();
      const company: ContactCompany = {
        companyId: `company#${slugify(parsed.data.name) || randomUUID()}`,
        name: parsed.data.name.trim(),
        relationshipType: parsed.data.relationshipType,
        verticals: parsed.data.verticals ?? [],
        industry: parsed.data.industry ?? null,
        website: parsed.data.website ?? null,
        hq: parsed.data.hq ?? null,
        phone: parsed.data.phone ?? null,
        linkedInUrl: parsed.data.linkedInUrl ?? null,
        notes: parsed.data.notes ?? null,
        tags: parsed.data.tags ?? [],
        contactCount: 0,
        linkedSignalIds: [],
        linkedProspectIds: [],
        lastActivityAt: null,
        addedBy: actor,
        createdAt: now,
        updatedAt: now,
      };
      const existing = await companyRepo.get(company.companyId);
      if (existing) company.companyId = `company#${slugify(parsed.data.name)}-${randomUUID().slice(0, 8)}`;
      await companyRepo.put(company);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_COMPANY_CREATED,
        details: { companyId: company.companyId, name: company.name },
        createdAt: now,
        resourceType: "contact_company",
        resourceId: company.companyId,
      });
      return ok({ item: company, success: true }, 201);
    }

    const companyMatch = path.match(/\/companies\/([^/]+)(?:\/(contacts))?\/?$/);
    const companyId = companyMatch?.[1] ? decodeURIComponent(companyMatch[1]) : null;
    const isContactsSub = Boolean(companyMatch?.[2]);

    // GET /api/contacts/companies/{id}
    if (m === "GET" && companyId && !isContactsSub) {
      const item = await companyRepo.get(companyId);
      if (!item) return ok({ error: "Company not found" }, 404);
      return ok({ item, success: true });
    }

    // PATCH /api/contacts/companies/{id}
    if (m === "PATCH" && companyId && !isContactsSub) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = updateCompanyBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const updated = await companyRepo.update(companyId, parsed.data);
      if (!updated) return ok({ error: "Company not found" }, 404);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_COMPANY_UPDATED,
        details: { companyId, fields: Object.keys(parsed.data) },
        createdAt: new Date().toISOString(),
        resourceType: "contact_company",
        resourceId: companyId,
      });
      return ok({ item: updated, success: true });
    }

    // DELETE /api/contacts/companies/{id}
    if (m === "DELETE" && companyId && !isContactsSub) {
      const existing = await companyRepo.get(companyId);
      if (!existing) return ok({ error: "Company not found" }, 404);
      const people = await personRepo.listByCompany(companyId);
      for (const p of people) await personRepo.delete(p.contactId);
      await companyRepo.delete(companyId);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_COMPANY_DELETED,
        details: { companyId, name: existing.name },
        createdAt: new Date().toISOString(),
        resourceType: "contact_company",
        resourceId: companyId,
      });
      return ok({ success: true });
    }

    // GET /api/contacts/companies/{id}/contacts
    if (m === "GET" && companyId && isContactsSub) {
      const items = await personRepo.listByCompany(companyId);
      return ok({ items, success: true });
    }

    // POST /api/contacts/companies/{id}/contacts
    if (m === "POST" && companyId && isContactsSub) {
      const company = await companyRepo.get(companyId);
      if (!company) return ok({ error: "Company not found" }, 404);
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = createContactBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const now = new Date().toISOString();
      const contact: ContactPerson = {
        contactId: `contact#${randomUUID()}`,
        companyId,
        companyName: company.name,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        title: parsed.data.title ?? null,
        department: parsed.data.department ?? null,
        email: parsed.data.email ?? null,
        emailVerified: parsed.data.emailVerified ?? false,
        phone: parsed.data.phone ?? null,
        mobilePhone: parsed.data.mobilePhone ?? null,
        linkedInUrl: parsed.data.linkedInUrl ?? null,
        location: parsed.data.location ?? null,
        notes: parsed.data.notes ?? null,
        source: parsed.data.source ?? "manual",
        verifiedAt: parsed.data.emailVerified ? now : null,
        tags: parsed.data.tags ?? [],
        lastContactedAt: null,
        lastContactedBy: null,
        outreachStatus: parsed.data.outreachStatus ?? "not_contacted",
        addedBy: actor,
        createdAt: now,
        updatedAt: now,
      };
      await personRepo.put(contact);
      await companyRepo.bumpContactCount(companyId, 1);
      await companyRepo.touchActivity(companyId, now);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_PERSON_CREATED,
        details: { contactId: contact.contactId, companyId },
        createdAt: now,
        resourceType: "contact_person",
        resourceId: contact.contactId,
      });
      return ok({ item: contact, success: true }, 201);
    }

    // PATCH /api/contacts/{contactId}
    const personPatch = path.match(/\/contacts\/([^/]+)\/?$/);
    const contactId =
      personPatch?.[1] && !personPatch[1].includes("companies") && personPatch[1] !== "search"
        ? decodeURIComponent(personPatch[1])
        : null;

    if (m === "PATCH" && contactId && !path.includes("/companies/")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = updateContactBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const now = new Date().toISOString();
      const outreachTouched =
        Boolean(parsed.data.outreachStatus) && parsed.data.outreachStatus !== "not_contacted";
      const updated = await personRepo.update(contactId, {
        ...parsed.data,
        ...(outreachTouched
          ? {
              lastContactedBy: actor,
              lastContactedAt: now,
            }
          : {}),
      });
      if (!updated) return ok({ error: "Contact not found" }, 404);
      if (outreachTouched) {
        await companyRepo.touchActivity(updated.companyId, now);
      }
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_PERSON_UPDATED,
        details: { contactId, fields: Object.keys(parsed.data) },
        createdAt: now,
        resourceType: "contact_person",
        resourceId: contactId,
      });
      return ok({ item: updated, success: true });
    }

    // DELETE /api/contacts/{contactId}
    if (m === "DELETE" && contactId && !path.includes("/companies/")) {
      const existing = await personRepo.get(contactId);
      if (!existing) return ok({ error: "Contact not found" }, 404);
      await personRepo.delete(contactId);
      await companyRepo.bumpContactCount(existing.companyId, -1);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CONTACT_PERSON_DELETED,
        details: { contactId, companyId: existing.companyId },
        createdAt: new Date().toISOString(),
        resourceType: "contact_person",
        resourceId: contactId,
      });
      return ok({ success: true });
    }

    return ok({ error: "Not found" }, 404);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "CONTACT_COMPANIES_TABLE_NOT_CONFIGURED" ||
        error.message === "CONTACT_PERSONS_TABLE_NOT_CONFIGURED")
    ) {
      return ok({ items: [], item: null, success: true, error: "Contacts tables not configured" }, 503);
    }
    console.error("[contactsHttp]", error);
    return serverError();
  }
};
