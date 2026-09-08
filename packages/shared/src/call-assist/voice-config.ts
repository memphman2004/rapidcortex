import { z } from "zod";

/**
 * Per-agency spoken branding for Call Assist.
 * Lambda, Lex templates, and Connect flows resolve these at runtime or provision time.
 * Nothing in this object is platform-global — KCPD is one tenant's values, not the product.
 */
export const callAssistAgencyVoiceConfigSchema = z.object({
  agencyId: z.string().min(1).max(128),
  agencyName: z.string().trim().min(1).max(200),
  agencyDisplayName: z.string().trim().min(1).max(200).optional(),
  agencyShortName: z.string().trim().min(1).max(80),
  agencyTypeLabel: z.string().trim().max(80).optional(),
  officerLabel: z.string().trim().max(40).optional(),
  emergencyLine: z.string().trim().min(1).max(32).default("911"),
  nonEmergencyWebsite: z.string().trim().max(200).optional(),
  onlineReportPortalUrl: z.string().trim().max(500).optional(),
  carfaxPortalUrl: z.string().trim().max(500).optional(),
  defaultLanguageCode: z.string().trim().min(2).max(16).default("en-US"),
  supportedLanguages: z.array(z.string().trim().min(2).max(16)).max(12).default(["en-US"]),
  defaultLocale: z.enum(["en_US", "es_US", "zh_CN", "fr_CA"]).optional(),
  supportedLocales: z.array(z.enum(["en_US", "es_US", "zh_CN", "fr_CA"])).max(4).optional(),
  lexBotId: z.string().max(64).optional(),
  lexBotAliasId: z.string().max(64).optional(),
  lexBotName: z.string().max(100).optional(),
  lexBotTemplateVersion: z.string().max(32).optional(),
  lexBotStatus: z
    .enum([
      "NOT_CREATED",
      "CREATING",
      "BUILD_PENDING",
      "BUILDING",
      "BUILT",
      "FAILED",
      "UPDATE_PENDING",
      "UPDATING",
    ])
    .optional(),
  connectInstanceId: z.string().max(128).optional(),
  connectContactFlowId: z.string().max(128).optional(),
  connectContactFlowArn: z.string().max(512).optional(),
  connectNonEmergencyDID: z.string().max(32).optional(),
  connectQueueArn: z.string().max(512).optional(),
  connectEmergencyQueueArn: z.string().max(512).optional(),
  transcribeVocabularyName: z.string().max(200).optional(),
  transcribeVocabularyStatus: z.enum(["PENDING", "READY", "FAILED", "NOT_CREATED"]).optional(),
  disclosureEnabled: z.boolean().optional(),
  aiDisclosureRequired: z.boolean().optional(),
  disclosureText: z.string().trim().min(1).max(2000),
  openingGreeting: z.string().trim().max(2000).optional(),
  afterHoursMessage: z.string().trim().max(2000).optional(),
  onboardingStatus: z
    .enum([
      "PENDING",
      "BOT_CREATING",
      "BOT_BUILDING",
      "FLOW_CREATING",
      "VOCAB_UPLOADING",
      "DID_PENDING",
      "SMOKE_TEST_PENDING",
      "ACTIVE",
      "FAILED",
    ])
    .optional(),
});
export type CallAssistAgencyVoiceConfig = z.infer<typeof callAssistAgencyVoiceConfigSchema>;

export type CallAssistVoiceVars = {
  agencyId?: string;
  agencyName?: string | null;
  agencyDisplayName?: string | null;
  agencyShortName?: string | null;
  officerLabel?: string | null;
  emergencyLine?: string | null;
  agencyWebsite?: string | null;
  nonEmergencyWebsite?: string | null;
  onlineReportPortalUrl?: string | null;
  carfaxPortalUrl?: string | null;
  referenceNumber?: string | null;
};

export const GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE =
  "You are speaking with an AI assistant for {{agencyShortName}}. " +
  "This is a non-emergency line. This call is recorded. " +
  "If this is an emergency, say emergency or hang up and dial {{emergencyLine}}.";

export const GENERIC_CALL_ASSIST_OPENING_TEMPLATE =
  "Thank you for calling {{agencyShortName}} non-emergency. " +
  "I'm an automated assistant that will gather your information and get you to the right place. " +
  "This call may be recorded. If this is a life-threatening emergency, please hang up and dial {{emergencyLine}}, " +
  "or say emergency now. How can I help you today?";

export const GENERIC_CALL_ASSIST_FALLBACK_TEMPLATE =
  "I'm sorry, I'm having trouble understanding. Let me connect you to {{agencyShortName}} who can help. Stay on the line.";

export const GENERIC_CALL_ASSIST_HUMAN_TRANSFER_TEMPLATE =
  "Of course. I'm connecting you to {{agencyShortName}} now. Stay on the line.";

export const GENERIC_CALL_ASSIST_INFO_MISS_TEMPLATE =
  "I don't have specific information about that available right now. I can connect you to the {{agencyShortName}} non-emergency line, or you can visit {{agencyWebsite}} for more information. Would you like me to transfer you?";

export function callAssistLexBotName(agencySlug: string, stage: string): string {
  const slug = agencySlug.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 40) || "agency";
  return `RCCallAssistBot-${slug}-${stage}`;
}

function fallbackShortName(vars: CallAssistVoiceVars): string {
  return vars.agencyShortName?.trim() || vars.agencyName?.trim() || "this agency";
}

export function resolveCallAssistVoiceVars(vars: CallAssistVoiceVars): Record<string, string> {
  const short = fallbackShortName(vars);
  const display = vars.agencyDisplayName?.trim() || vars.agencyName?.trim() || short;
  const website =
    vars.agencyWebsite?.trim() ||
    vars.nonEmergencyWebsite?.trim() ||
    "your agency website";
  return {
    agencyId: vars.agencyId?.trim() || "",
    agencyName: display,
    agencyDisplayName: display,
    agencyShortName: short,
    officerLabel: vars.officerLabel?.trim() || "officer",
    emergencyLine: vars.emergencyLine?.trim() || "911",
    agencyWebsite: website,
    nonEmergencyWebsite: website,
    onlineReportPortalUrl: vars.onlineReportPortalUrl?.trim() || "",
    carfaxPortalUrl: vars.carfaxPortalUrl?.trim() || "",
    referenceNumber: vars.referenceNumber?.trim() || "",
  };
}

/** Substitute {{agencyShortName}} / {agencyShortName} (and related) from tenant voice config. */
export function interpolateCallAssistVoice(template: string, vars: CallAssistVoiceVars): string {
  const resolved = resolveCallAssistVoiceVars(vars);
  let out = template;
  for (const [key, value] of Object.entries(resolved)) {
    out = out.replaceAll(`{{${key}}}`, value).replaceAll(`{${key}}`, value);
  }
  return out;
}

export type AgencyDemoCustomizations = {
  streetExample?: string;
  neighborhoodExample?: string;
  localLandmark?: string;
  callbackExample?: string;
};

export const DEFAULT_CALL_ASSIST_SEED_AGENCY_ID = "kcpd";

/** KCPD (or any named first tenant) overlay applies only to that agencyId — never to every new tenant. */
export function shouldApplyCallAssistReferenceSeed(
  agencyId: string,
  seedProfile: string,
  seedAgencyId = DEFAULT_CALL_ASSIST_SEED_AGENCY_ID,
): boolean {
  const designated = (seedAgencyId.trim() || DEFAULT_CALL_ASSIST_SEED_AGENCY_ID).toLowerCase();
  return seedProfile.trim().toLowerCase() === "kcpd" && agencyId.trim().toLowerCase() === designated;
}

export function callAssistVoiceVarsFromTenant(config: {
  agencyId?: string | null;
  agencyName?: string | null;
  agencyDisplayName?: string | null;
  agencyShortName?: string | null;
  shortName?: string | null;
  officerLabel?: string | null;
  emergencyLine?: string | null;
  emergencyDestination?: string | null;
  nonEmergencyWebsite?: string | null;
  onlineReportUrl?: string | null;
  onlineReportPortalUrl?: string | null;
  carfaxPortalUrl?: string | null;
}): CallAssistVoiceVars {
  return {
    agencyId: config.agencyId ?? undefined,
    agencyName: config.agencyName,
    agencyDisplayName: config.agencyDisplayName || config.agencyName,
    agencyShortName: config.agencyShortName || config.shortName,
    officerLabel: config.officerLabel,
    emergencyLine: config.emergencyLine || config.emergencyDestination,
    agencyWebsite: config.nonEmergencyWebsite,
    nonEmergencyWebsite: config.nonEmergencyWebsite,
    onlineReportPortalUrl: config.onlineReportPortalUrl || config.onlineReportUrl,
    carfaxPortalUrl: config.carfaxPortalUrl,
  };
}

export function interpolateDemoUtterance(text: string, custom: AgencyDemoCustomizations): string {
  const street = custom.streetExample?.trim() || "Main Street";
  const neighborhood = custom.neighborhoodExample?.trim() || "downtown";
  const landmark = custom.localLandmark?.trim() || "city hall";
  const callback = custom.callbackExample?.trim() || "555-0100";
  return text
    .replaceAll("{{localStreetExample}}", street)
    .replaceAll("{localStreetExample}", street)
    .replaceAll("{{localNeighborhoodExample}}", neighborhood)
    .replaceAll("{localNeighborhoodExample}", neighborhood)
    .replaceAll("{{localLandmark}}", landmark)
    .replaceAll("{localLandmark}", landmark)
    .replaceAll("{{callbackExample}}", callback)
    .replaceAll("{callbackExample}", callback);
}
