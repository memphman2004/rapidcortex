import { z } from "zod";

export const relationshipTypeSchema = z.enum([
  "prospect",
  "partner",
  "competitor",
  "vendor",
  "influencer",
  "customer",
]);
export type RelationshipType = z.infer<typeof relationshipTypeSchema>;

export const contactVerticalSchema = z.enum(["911", "campus", "venue", "transit", "all"]);
export type ContactVertical = z.infer<typeof contactVerticalSchema>;

export const contactSourceSchema = z.enum([
  "manual",
  "hunter",
  "apollo",
  "rapid_iq",
  "psap",
  "import",
]);
export type ContactSource = z.infer<typeof contactSourceSchema>;

export const outreachStatusSchema = z.enum([
  "not_contacted",
  "contacted",
  "replied",
  "meeting_set",
  "closed",
]);
export type OutreachStatus = z.infer<typeof outreachStatusSchema>;

export const contactCompanySchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  relationshipType: relationshipTypeSchema,
  verticals: z.array(contactVerticalSchema),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  hq: z.string().nullable(),
  phone: z.string().nullable(),
  linkedInUrl: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  contactCount: z.number().int().nonnegative(),
  linkedSignalIds: z.array(z.string()),
  linkedProspectIds: z.array(z.string()),
  lastActivityAt: z.string().nullable(),
  addedBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type ContactCompany = z.infer<typeof contactCompanySchema>;

export const contactPersonSchema = z.object({
  contactId: z.string().min(1),
  companyId: z.string().min(1),
  companyName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().nullable(),
  department: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phone: z.string().nullable(),
  mobilePhone: z.string().nullable(),
  linkedInUrl: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  source: contactSourceSchema,
  verifiedAt: z.string().nullable(),
  tags: z.array(z.string()),
  lastContactedAt: z.string().nullable(),
  lastContactedBy: z.string().nullable(),
  outreachStatus: outreachStatusSchema,
  addedBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type ContactPerson = z.infer<typeof contactPersonSchema>;

export const createCompanyBodySchema = z.object({
  name: z.string().min(1).max(200),
  relationshipType: relationshipTypeSchema,
  verticals: z.array(contactVerticalSchema).default([]),
  industry: z.string().max(200).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  hq: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  linkedInUrl: z.string().max(500).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
});
export type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>;

export const updateCompanyBodySchema = createCompanyBodySchema.partial().extend({
  linkedSignalIds: z.array(z.string()).optional(),
  linkedProspectIds: z.array(z.string()).optional(),
});
export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>;

export const createContactBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  email: z.string().max(320).nullable().optional(),
  emailVerified: z.boolean().optional(),
  phone: z.string().max(40).nullable().optional(),
  mobilePhone: z.string().max(40).nullable().optional(),
  linkedInUrl: z.string().max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  outreachStatus: outreachStatusSchema.optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  source: contactSourceSchema.optional(),
});
export type CreateContactBody = z.infer<typeof createContactBodySchema>;

export const updateContactBodySchema = createContactBodySchema.partial();
export type UpdateContactBody = z.infer<typeof updateContactBodySchema>;

/** RC Admin Contacts address book — rcsuperadmin and rcadmin only. */
export function canAccessContactsModule(role: string | undefined | null): boolean {
  const r = String(role ?? "").trim().toLowerCase();
  return r === "rcsuperadmin" || r === "rcadmin";
}
