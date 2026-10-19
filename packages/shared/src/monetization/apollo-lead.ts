import { z } from "zod";

const loose = z.object({}).passthrough();

/** Apollo person, or the flat fields a workflow maps into the Lambda event. */
export const apolloLeadEventSchema = z.union([z.string(), loose]);

export type ApolloLeadDraft = {
  apolloContactId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  agencyCompany: string;
  title?: string;
  city?: string;
  state?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emailIn(value: unknown): string {
  const direct = text(value);
  const match = direct.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return "";
  const email = match[0].toLowerCase();
  if (email.includes("{{") || email.includes("<") || email.includes("}}")) return "";
  return email;
}

/** Walk a Pipedream or Apollo event until an email field is found. */
function findEmailRecord(value: unknown, depth = 0): { record: Record<string, unknown>; email: string } | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return findEmailRecord(JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEmailRecord(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["email", "email_address", "primary_email", "work_email"]) {
    const email = emailIn(record[key]);
    if (email) return { record, email };
    const nested = asRecord(record[key]);
    const nestedEmail = nested ? emailIn(nested.email) || emailIn(nested.address) : "";
    if (nested && nestedEmail) return { record: { ...record, ...nested }, email: nestedEmail };
  }
  const emails = record.emails ?? record.contact_emails;
  if (Array.isArray(emails)) {
    for (const item of emails) {
      const row = asRecord(item);
      const email = emailIn(item) || (row ? emailIn(row.email) : "");
      if (email) return { record, email };
    }
  }
  for (const nested of Object.values(record)) {
    const found = findEmailRecord(nested, depth + 1);
    if (found) return { record: { ...record, ...found.record }, email: found.email };
  }
  return null;
}

function unwrap(event: unknown): Record<string, unknown> | null {
  if (typeof event === "string") {
    try {
      return unwrap(JSON.parse(event) as unknown);
    } catch {
      return null;
    }
  }
  const record = asRecord(event);
  if (!record) return null;
  if (typeof record.body === "string" && record.body.trim().startsWith("{")) {
    return unwrap(record.body);
  }
  for (const key of ["person", "contact", "payload", "data"] as const) {
    const nested = asRecord(record[key]);
    if (nested && (text(nested.email) || text(nested.id) || text(nested.first_name))) return nested;
  }
  return record;
}

function phoneFrom(record: Record<string, unknown>): string {
  const direct = text(record.phone) || text(record.mobile_phone) || text(record.sanitized_phone);
  if (direct) return direct.slice(0, 40);
  const numbers = record.phone_numbers;
  if (!Array.isArray(numbers)) return "";
  for (const entry of numbers) {
    const row = asRecord(entry);
    if (!row) continue;
    const value = text(row.sanitized_number) || text(row.raw_number);
    if (value) return value.slice(0, 40);
  }
  return "";
}

function companyFrom(record: Record<string, unknown>): string {
  const organization = asRecord(record.organization);
  const account = asRecord(record.account);
  return (
    text(record.organization_name) ||
    text(record.organizationName) ||
    text(record.company) ||
    text(record.agencyCompany) ||
    text(organization?.name) ||
    text(account?.name) ||
    "Unknown organization"
  ).slice(0, 300);
}

/** Map an Apollo or Pipedream Lambda event onto the fields the CRM stores. */
export function apolloLeadDraftFromEvent(event: unknown): ApolloLeadDraft {
  const parsed = apolloLeadEventSchema.safeParse(event);
  if (!parsed.success) {
    throw Object.assign(new Error("VALIDATION:Apollo payload was empty"), { statusCode: 400 });
  }
  const found = findEmailRecord(parsed.data);
  const record = found?.record ?? unwrap(parsed.data);
  if (!record || !found) {
    throw Object.assign(new Error("VALIDATION:A valid email is required"), { statusCode: 400 });
  }
  const email = found.email;
  const firstName = text(record.first_name) || text(record.firstName);
  const lastName = text(record.last_name) || text(record.lastName);
  const name = (text(record.name) || [firstName, lastName].filter(Boolean).join(" ") || email).slice(0, 200);
  const apolloContactId = text(record.id) || text(record.apolloId) || text(record.contact_id) || undefined;
  const title = text(record.title) || text(record.role) || undefined;
  const city = text(record.city) || undefined;
  const state = text(record.state) || undefined;
  const phone = phoneFrom(record) || undefined;
  return {
    apolloContactId,
    name,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email,
    phone,
    agencyCompany: companyFrom(record),
    title,
    city,
    state,
  };
}
