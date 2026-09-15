import { z } from "zod";

export const billingPeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const invoicePreviewBodySchema = z
  .object({
    agencyId: z.string().min(1).max(128),
    billingPeriod: billingPeriodSchema,
    usageOverride: z
      .object({
        activeDispatcherSeats: z.number().int().min(0).optional(),
        activeAdminSeats: z.number().int().min(0).optional(),
        totalCallsProcessed: z.number().int().min(0).optional(),
        transcriptionMinutes: z.number().min(0).optional(),
        translationRequests: z.number().int().min(0).optional(),
        storageGb: z.number().min(0).optional(),
        archiveStorageGb: z.number().min(0).optional(),
        photosCount: z.number().int().min(0).optional(),
        dataExportGb: z.number().min(0).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const patchAutomatedInvoiceBodySchema = z
  .object({
    status: z.enum(["draft", "sent", "paid", "overdue", "voided", "disputed"]).optional(),
    notes: z.string().max(2000).optional(),
    voidReason: z.string().max(500).optional(),
  })
  .strict();

export const listAutomatedInvoicesQuerySchema = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue", "voided", "disputed"]).optional(),
  agencyId: z.string().min(1).max(128).optional(),
  billingPeriod: billingPeriodSchema.optional(),
  planId: z.enum(["essential", "professional", "command", "enterprise"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type InvoicePreviewBody = z.infer<typeof invoicePreviewBodySchema>;
export type PatchAutomatedInvoiceBody = z.infer<typeof patchAutomatedInvoiceBodySchema>;
