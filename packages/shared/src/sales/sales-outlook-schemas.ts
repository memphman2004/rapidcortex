import { z } from "zod";

export const SALES_PERSONAL_OUTLOOK_DOMAIN = "@nexcortiq.us";

export function isPersonalSalesMailboxShared(mailbox: string): boolean {
  return mailbox.trim().toLowerCase().endsWith(SALES_PERSONAL_OUTLOOK_DOMAIN);
}

export const salesOutlookCallbackBodySchema = z.object({
  code: z.string().trim().min(1).max(4000),
  state: z.string().trim().min(1).max(4000),
});

export type SalesOutlookCallbackBody = z.infer<typeof salesOutlookCallbackBodySchema>;

export const SALES_SEND_EMAIL_MAX_TO = 320;
export const SALES_SEND_EMAIL_MAX_SUBJECT = 500;
export const SALES_SEND_EMAIL_MAX_BODY = 20_000;

export const salesSendEmailRequestSchema = z.object({
  to: z.string().trim().email().max(SALES_SEND_EMAIL_MAX_TO),
  cc: z
    .string()
    .trim()
    .max(SALES_SEND_EMAIL_MAX_TO)
    .optional()
    .default("")
    .transform((v) => v.trim())
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Invalid CC email",
    }),
  subject: z.string().trim().min(1).max(SALES_SEND_EMAIL_MAX_SUBJECT),
  body: z.string().trim().min(1).max(SALES_SEND_EMAIL_MAX_BODY),
});

export type SalesSendEmailRequest = z.infer<typeof salesSendEmailRequestSchema>;
