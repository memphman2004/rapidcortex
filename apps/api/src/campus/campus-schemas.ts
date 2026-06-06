import { z } from "zod";

export const createIncidentSchema = z.object({
  campusCode: z.string().min(2).max(20).transform((s) => s.toUpperCase()),
  buildingCode: z.string().min(1).max(50),
  floor: z.number().int().min(0).max(100).nullable().optional(),
  roomCode: z.string().max(20).optional().default(""),
  type: z.enum([
    "medical",
    "security",
    "mental_health",
    "suspicious_activity",
    "wellness_check",
    "property_crime",
    "maintenance",
    "active_threat",
    "other",
  ]),
  source: z.enum(["qr", "sms", "manual", "phone"]),
  description: z.string().min(1).max(2000),
  isAnonymous: z.boolean().default(true),
  confidential: z.boolean().optional(),
  phoneNumber: z.string().optional().nullable(),
  photoDataUrl: z.string().optional().nullable(),
  zoneCode: z.string().max(16).optional(),
  qrRcli: z.string().max(32).optional(),
  qrLocationName: z.string().max(200).optional(),
});

export const updateIncidentSchema = z.object({
  status: z
    .enum(["open", "assigned", "responding", "resolved", "referred", "escalated"])
    .optional(),
  assignedTo: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  cleryCategory: z.string().nullable().optional(),
});

export const addNoteSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const publicReportSchema = z.object({
  campusCode: z.string().min(2).max(20).transform((s) => s.toUpperCase()),
  buildingCode: z.string().max(50).optional().default(""),
  roomCode: z.string().max(20).optional().default(""),
  helpType: z.enum([
    "medical",
    "security",
    "mental_health",
    "suspicious",
    "wellness_check",
    "property",
    "maintenance",
    "other",
  ]),
  isConfidential: z.boolean(),
  description: z.string().max(500).optional().default(""),
  phoneNumber: z.string().optional().nullable(),
  photoDataUrl: z.string().max(5_000_000).optional().nullable(),
  submittedAt: z.string().datetime().optional(),
  userAgent: z.string().max(300).optional(),
});

export function isConfidentialType(type: string): boolean {
  return ["mental_health", "wellness_check", "suspicious_activity", "suspicious"].includes(type);
}

export function legalStatusTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    open: ["assigned", "responding", "resolved", "escalated"],
    assigned: ["responding", "resolved", "referred", "escalated"],
    responding: ["resolved", "referred", "escalated"],
    resolved: [],
    referred: ["resolved"],
    escalated: ["resolved"],
  };
  return allowed[from]?.includes(to) ?? false;
}
