import { z } from "zod";

export const patchAgencyBillingProfileSchema = z
  .object({
    billingContactName: z.string().min(1).max(200).optional(),
    billingContactEmail: z.string().email().optional(),
    billingContactPhone: z.string().max(40).optional(),
    accountsPayableEmail: z.string().email().optional(),
    paymentMode: z
      .enum(["invoice_only", "invoice_preferred_ach", "subscription_self_serve", "hybrid_invoice_and_subscription"])
      .optional(),
    selfServeCheckoutEnabled: z.boolean().optional(),
    preferredPaymentRail: z.enum(["ach", "card", "invoice_only"]).optional(),
    purchaseOrderRef: z.string().max(120).optional(),
  })
  .strict();

export const changeSubscriptionPlanBodySchema = z.object({
  targetPlanId: z.enum(["essential", "command", "enterprise_statewide", "rc_lite"]),
  effective: z.enum(["immediate", "period_end"]).default("period_end"),
});

export const cancelSubscriptionBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const createInvoiceBodySchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().min(1),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1).max(300),
        quantity: z.number().int().min(1).max(10_000).default(1),
        unitAmountCents: z.number().int().min(0),
        kind: z.enum(["subscription", "one_time_fee", "adjustment"]).default("adjustment"),
        oneTimeFeeKind: z
          .enum([
            "implementation",
            "custom_integration",
            "protocol_customization",
            "premium_support",
            "setup_implementation",
            "onsite_deployment",
          ])
          .optional(),
      }),
    )
    .min(1),
  notes: z.string().max(500).optional(),
});

export const addPaymentMethodBodySchema = z.object({
  type: z.enum(["ach_bank_account", "card_on_file", "invoice_terms"]),
  label: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
});

export const setDefaultPaymentMethodBodySchema = z.object({
  paymentMethodId: z.string().min(1),
});

export const customerPaymentTermsSchema = z.enum([
  "DUE_ON_RECEIPT",
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
]);

export const createBillingCustomerBodySchema = z
  .object({
    agencyName: z.string().min(1).max(200),
    billingContact: z.string().min(1).max(200),
    email: z.string().email().max(320),
    phone: z.string().max(40).optional(),
    address: z.string().max(1000).optional(),
    paymentTerms: customerPaymentTermsSchema,
    requiresPO: z.boolean().optional().default(false),
    taxExempt: z.boolean().optional().default(false),
    defaultPaymentMethod: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const patchBillingCustomerBodySchema = z
  .object({
    agencyName: z.string().min(1).max(200).optional(),
    billingContact: z.string().min(1).max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().max(40).optional(),
    address: z.string().max(1000).optional(),
    paymentTerms: customerPaymentTermsSchema.optional(),
    requiresPO: z.boolean().optional(),
    taxExempt: z.boolean().optional(),
    defaultPaymentMethod: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const billingServiceBillingTypeSchema = z.enum([
  "ONE_TIME",
  "MONTHLY",
  "ANNUAL",
  "USAGE",
]);

export const billingServiceCategorySchema = z.enum([
  "SOFTWARE",
  "IMPLEMENTATION",
  "SUPPORT",
  "INTEGRATION",
  "TRAINING",
  "OTHER",
]);

export const createBillingServiceBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    category: billingServiceCategorySchema,
    defaultPrice: z.number().positive(),
    billingType: billingServiceBillingTypeSchema,
    active: z.boolean().optional().default(true),
    sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  })
  .strict();

export const patchBillingServiceBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    category: billingServiceCategorySchema.optional(),
    defaultPrice: z.number().positive().optional(),
    billingType: billingServiceBillingTypeSchema.optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const billingInvoiceStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "PAID",
  "VOID",
  "CANCELED",
]);

export const billingInvoiceLineItemSchema = z.object({
  serviceId: z.string().min(1).max(120).optional(),
  serviceName: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export const createBillingInvoiceBodySchema = z
  .object({
    customerId: z.string().min(1).max(120),
    invoiceDate: z.string().min(1),
    dueDate: z.string().min(1),
    poNumber: z.string().max(120).optional(),
    currency: z.string().min(3).max(3).optional().default("USD"),
    discount: z.number().nonnegative().optional().default(0),
    tax: z.number().nonnegative().optional().default(0),
    lineItems: z.array(billingInvoiceLineItemSchema).min(1),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const patchBillingInvoiceBodySchema = z
  .object({
    dueDate: z.string().min(1).optional(),
    poNumber: z.string().max(120).optional(),
    currency: z.string().min(3).max(3).optional(),
    discount: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    lineItems: z.array(billingInvoiceLineItemSchema).min(1).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const addInvoiceItemBodySchema = z
  .object({
    serviceId: z.string().min(1).max(120).optional(),
    serviceName: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    lineTotal: z.number().positive().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  })
  .strict();

export const patchInvoiceItemBodySchema = z
  .object({
    serviceId: z.string().min(1).max(120).optional(),
    serviceName: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(1000).optional(),
    quantity: z.number().positive().optional(),
    unitPrice: z.number().positive().optional(),
    lineTotal: z.number().positive().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const billingScheduleFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"]);

export const createBillingScheduleBodySchema = z
  .object({
    customerId: z.string().min(1).max(120),
    serviceId: z.string().min(1).max(120).optional(),
    serviceName: z.string().min(1).max(200),
    frequency: billingScheduleFrequencySchema,
    amount: z.number().positive(),
    currency: z.string().trim().min(3).max(3).default("USD"),
    startDate: z.string().min(1),
    endDate: z.string().min(1).optional(),
    nextRunDate: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    enabled: z.boolean().optional().default(true),
  })
  .strict();

export const patchBillingScheduleBodySchema = z
  .object({
    serviceId: z.string().min(1).max(120).optional(),
    serviceName: z.string().min(1).max(200).optional(),
    frequency: billingScheduleFrequencySchema.optional(),
    amount: z.number().positive().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    nextRunDate: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const billingPaymentMethodSchema = z.enum([
  "ACH",
  "WIRE",
  "CHECK",
  "CARD",
  "CASH",
  "OTHER",
]);

export const createPaymentRecordBodySchema = z
  .object({
    invoiceId: z.string().min(1).max(120),
    amount: z.number().positive(),
    currency: z.string().trim().min(3).max(3).default("USD"),
    paymentDate: z.string().min(1).optional(),
    method: billingPaymentMethodSchema,
    reference: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type PatchAgencyBillingProfileInput = z.infer<typeof patchAgencyBillingProfileSchema>;
export type ChangeSubscriptionPlanInput = z.infer<typeof changeSubscriptionPlanBodySchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionBodySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceBodySchema>;
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodBodySchema>;
export type SetDefaultPaymentMethodInput = z.infer<typeof setDefaultPaymentMethodBodySchema>;
export type CustomerPaymentTerms = z.infer<typeof customerPaymentTermsSchema>;
export type CreateBillingCustomerInput = z.infer<typeof createBillingCustomerBodySchema>;
export type PatchBillingCustomerInput = z.infer<typeof patchBillingCustomerBodySchema>;
export type BillingServiceBillingType = z.infer<typeof billingServiceBillingTypeSchema>;
export type BillingServiceCategory = z.infer<typeof billingServiceCategorySchema>;
export type CreateBillingServiceInput = z.infer<typeof createBillingServiceBodySchema>;
export type PatchBillingServiceInput = z.infer<typeof patchBillingServiceBodySchema>;
export type BillingInvoiceStatus = z.infer<typeof billingInvoiceStatusSchema>;
export type BillingInvoiceLineItemInput = z.infer<typeof billingInvoiceLineItemSchema>;
export type CreateBillingInvoiceInput = z.infer<typeof createBillingInvoiceBodySchema>;
export type PatchBillingInvoiceInput = z.infer<typeof patchBillingInvoiceBodySchema>;
export type AddInvoiceItemInput = z.infer<typeof addInvoiceItemBodySchema>;
export type PatchInvoiceItemInput = z.infer<typeof patchInvoiceItemBodySchema>;
export type BillingScheduleFrequency = z.infer<typeof billingScheduleFrequencySchema>;
export type CreateBillingScheduleInput = z.infer<typeof createBillingScheduleBodySchema>;
export type PatchBillingScheduleInput = z.infer<typeof patchBillingScheduleBodySchema>;
export type BillingPaymentMethod = z.infer<typeof billingPaymentMethodSchema>;
export type CreatePaymentRecordInput = z.infer<typeof createPaymentRecordBodySchema>;
