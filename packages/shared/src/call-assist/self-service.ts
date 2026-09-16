import { z } from "zod";

export const CALL_ASSIST_SMS_STATUSES = [
  "ELIGIBLE",
  "OFFERED",
  "SENT",
  "CLICKED",
  "COMPLETED",
  "FAILED",
  "DECLINED",
] as const;
export type CallAssistSmsStatus = (typeof CALL_ASSIST_SMS_STATUSES)[number];

export const callAssistSmsSelfServiceSchema = z.object({
  token: z.string().min(16).max(128),
  status: z.enum(CALL_ASSIST_SMS_STATUSES),
  portalUrl: z.string().min(1).max(500),
  sentAt: z.string().optional(),
  clickedAt: z.string().optional(),
  completedAt: z.string().optional(),
  provider: z.string().max(40).optional(),
  messageId: z.string().max(128).optional(),
  lastError: z.string().max(300).optional(),
  phoneLast4: z.string().max(4).optional(),
});
export type CallAssistSmsSelfService = z.infer<typeof callAssistSmsSelfServiceSchema>;

export const callAssistSmsSendBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  phoneE164: z.string().min(7).max(32).optional(),
});

export const callAssistSelfServiceCompleteBodySchema = z.object({
  disposition: z.enum(["clicked", "completed", "abandoned"]).default("completed"),
  notes: z.string().max(1000).optional(),
});

const SMS_REQUEST_RE =
  /\b(text me|send (me )?(a )?link|sms|text the (link|form)|online report)\b/i;

export function callerRequestedSmsLink(utterance: string): boolean {
  return SMS_REQUEST_RE.test(utterance ?? "");
}

export function shouldOfferOnlineReportingSms(opts: {
  onlineReportingEligible: boolean;
  portalUrl?: string | null;
  alreadyOffered: boolean;
  emergencyDetected: boolean;
}): boolean {
  if (opts.emergencyDetected || opts.alreadyOffered) return false;
  if (!opts.onlineReportingEligible) return false;
  return Boolean(opts.portalUrl?.trim());
}

export function buildSelfServiceSmsBody(opts: {
  agencyDisplayName: string;
  link: string;
}): string {
  return (
    `${opts.agencyDisplayName}: you can file this non-emergency report online. ` +
    `This is not for emergencies. If someone is hurt or in danger, hang up and dial 911. ` +
    `Secure link: ${opts.link}`
  );
}

export function selfServicePublicPath(token: string): string {
  return `/call-assist/report/${encodeURIComponent(token)}`;
}

const DEFAULT_CALL_ASSIST_PUBLIC_BASE = "https://app.rapidcortex.us";
const MARKETING_HOSTS = new Set(["www.rapidcortex.us", "rapidcortex.us"]);

/**
 * Token pages live on the Next.js app host, not the marketing site.
 * www.rapidcortex.us is a static marketing origin and 404s /call-assist/report/{token}.
 */
export function callAssistPublicBaseUrl(raw?: string | null): string {
  const trimmed = (raw ?? "").trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_CALL_ASSIST_PUBLIC_BASE;
  try {
    const host = new URL(trimmed).host.toLowerCase();
    if (MARKETING_HOSTS.has(host)) return DEFAULT_CALL_ASSIST_PUBLIC_BASE;
  } catch {
    return DEFAULT_CALL_ASSIST_PUBLIC_BASE;
  }
  return trimmed;
}

export function resolveSelfServiceLink(opts: {
  publicBaseUrl?: string | null;
  token: string;
  portalUrl: string;
}): { link: string; tokenized: boolean } {
  const base = callAssistPublicBaseUrl(opts.publicBaseUrl);
  return { link: `${base}${selfServicePublicPath(opts.token)}`, tokenized: true };
}
