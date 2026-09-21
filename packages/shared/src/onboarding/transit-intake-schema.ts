import { z } from "zod";
import { transitGuestAssistKnowledgeSchema } from "../guest-assist/knowledge.js";

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .default("")
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Enter a valid email or leave blank",
  });

export const transitIntakeSchema = z
  .object({
    agencyName: z.string().trim().min(1).max(200),
    legalName: z.string().trim().min(1).max(200),
    state: z.string().trim().min(2).max(2),
    operationsContactName: z.string().trim().min(1).max(120),
    operationsContactNumber: z.string().trim().min(7).max(32),
    riderServicesContactName: z.string().trim().max(120).default(""),
    riderServicesContactEmail: optionalEmail,
    guestAssistKnowledge: transitGuestAssistKnowledgeSchema.default({}),
    notes: z.string().trim().max(8000).optional(),
  })
  .strict();

export type TransitIntake = z.infer<typeof transitIntakeSchema>;

export type TransitIntakeRecord = TransitIntake & {
  orgCode: string;
  agencyId: string;
  submittedAt: string;
  submittedBy?: string;
  updatedAt: string;
};
