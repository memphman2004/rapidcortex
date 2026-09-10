import { z } from "zod";
import { evaluateSafety, isImmutableEmergency } from "./safety.js";

export const GREETING_MODES = ["hang_up", "stay_on_line", "custom"] as const;
export type GreetingMode = (typeof GREETING_MODES)[number];

export const ESCALATION_MODES = ["announce_and_transfer", "announce_and_end", "silent_transfer"] as const;
export type EscalationMode = (typeof ESCALATION_MODES)[number];

export const callAssistGreetingConfigSchema = z.object({
  mode: z.enum(GREETING_MODES),
  cityName: z.string().max(200),
  agencyName: z.string().max(200),
  lineDescription: z.string().min(1).max(120),
  customGreetingText: z.string().max(2000).optional(),
  localizedGreetings: z.record(z.string(), z.string().max(2000)).optional(),
  escalationMode: z.enum(ESCALATION_MODES),
  emergencyTransferNumber: z.string().max(32).optional(),
  emergencyTransferQueue: z.string().max(256).optional(),
  speakEscalationAnnouncement: z.boolean(),
  escalationAnnouncementText: z.string().max(2000).optional(),
  enableColdClimateIntents: z.boolean(),
  enableLiveAgentHandoff: z.boolean(),
  greetingPreviewConfirmed: z.boolean().optional(),
});
export type CallAssistGreetingConfig = z.infer<typeof callAssistGreetingConfigSchema>;

export const callAssistGreetingConfigPatchSchema = callAssistGreetingConfigSchema.partial();
export type CallAssistGreetingConfigPatch = z.infer<typeof callAssistGreetingConfigPatchSchema>;

export const GREETING_TEMPLATES: Record<Exclude<GreetingMode, "custom">, string> = {
  hang_up: [
    "You've reached the {lineDescription} for {cityName}.",
    "If you are experiencing an emergency or there is an immediate threat to life or safety,",
    "please hang up and dial 9-1-1.",
    "Otherwise, stay on the line and I can assist you with your non-emergency request.",
  ].join(" "),

  stay_on_line: [
    "You've reached the {lineDescription} for {cityName}.",
    "If this is an emergency, please dial 9-1-1.",
    "If you're unsure, stay on the line —",
    "I'll help determine the appropriate response.",
  ].join(" "),
};

export const DEFAULT_ES_GREETING_TEMPLATES: Record<Exclude<GreetingMode, "custom">, string> = {
  hang_up: [
    "Ha llamado a la línea de servicio no urgente de {cityName}.",
    "Si está experimentando una emergencia o existe una amenaza inmediata a la vida o la seguridad,",
    "por favor cuelgue y llame al 9-1-1.",
    "De lo contrario, permanezca en la línea y puedo ayudarle con su solicitud no urgente.",
  ].join(" "),

  stay_on_line: [
    "Ha llamado a la línea de servicio no urgente de {cityName}.",
    "Si esto es una emergencia, por favor llame al 9-1-1.",
    "Si no está seguro, permanezca en la línea —",
    "le ayudaré a determinar la respuesta apropiada.",
  ].join(" "),
};

export const DEFAULT_ESCALATION_ANNOUNCEMENTS: Record<EscalationMode, string> = {
  announce_and_transfer: [
    "Based on what you've described, this sounds like an emergency.",
    "I'm connecting you with an emergency dispatcher right now.",
    "Please stay on the line and do not hang up.",
  ].join(" "),

  announce_and_end: [
    "Based on what you've described, this sounds like an emergency.",
    "Please hang up immediately and dial 9-1-1.",
    "Emergency dispatchers are available 24 hours a day.",
  ].join(" "),

  silent_transfer: "",
};

export const DEFAULT_ES_ESCALATION_ANNOUNCEMENTS: Record<EscalationMode, string> = {
  announce_and_transfer: [
    "Según lo que ha descrito, esto parece ser una emergencia.",
    "Le estoy comunicando con un despachador de emergencias ahora mismo.",
    "Por favor permanezca en la línea y no cuelgue.",
  ].join(" "),

  announce_and_end: [
    "Según lo que ha descrito, esto parece ser una emergencia.",
    "Por favor cuelgue inmediatamente y llame al 9-1-1.",
    "Los despachadores de emergencias están disponibles las 24 horas del día.",
  ].join(" "),

  silent_transfer: "",
};

export const FALLBACK_GREETING =
  "You've reached a non-emergency service line. If this is an emergency, please dial 9-1-1. Otherwise, stay on the line and I can assist you.";

export const FALLBACK_GREETING_ES =
  "Ha llamado a una línea de servicio no urgente. Si esto es una emergencia, por favor llame al 9-1-1. De lo contrario, permanezca en la línea y puedo ayudarle.";

export const INTAKE_PROMPT_EN = "How can I help you today?";
export const INTAKE_PROMPT_ES = "¿En qué puedo ayudarle hoy?";

export const DEFAULT_LINE_DESCRIPTION = "non-emergency service line";

export const DEFAULT_GREETING_CONFIG: CallAssistGreetingConfig = {
  mode: "stay_on_line",
  cityName: "",
  agencyName: "",
  lineDescription: DEFAULT_LINE_DESCRIPTION,
  localizedGreetings: {
    "es-US": "",
  },
  escalationMode: "announce_and_transfer",
  emergencyTransferNumber: "",
  emergencyTransferQueue: "",
  speakEscalationAnnouncement: true,
  enableColdClimateIntents: false,
  enableLiveAgentHandoff: true,
  greetingPreviewConfirmed: false,
};

/**
 * Telephony already delivered the opening sequence. Downstream AI must not re-introduce itself.
 */
export const CALL_ASSIST_OPENING_SEQUENCE_PROMPT = `OPENING SEQUENCE

At the start of every session, before asking any questions:
1. The greeting has already been delivered by the telephony layer.
   Do NOT repeat the greeting or the 911 disclaimer.
2. Your first message should be a brief, warm prompt to begin intake.
   Example: "How can I help you today?"
   or: "What can I assist you with?"
   Keep it to one sentence. Do not add explanation.
3. Begin intake with open-ended prompting. Do not ask multiple questions at once.

EMERGENCY MONITORING

On every turn, before formulating a response:
1. Run emergency signal detection on the caller's message.
2. If any emergency signal is detected, IMMEDIATELY stop all intake.
3. Speak the escalation announcement (provided in session context).
4. Trigger the transfer or end-session action.
5. Do not ask follow-up questions, confirm details, or collect remaining fields.
   The caller's safety is the only priority once escalation is triggered.

ESCALATION ANNOUNCEMENT BEHAVIOR

If escalationMode = announce_and_transfer:
  Say: [escalationAnnouncement from session context]
  Then: transfer to emergency queue (do not end session yourself)

If escalationMode = announce_and_end:
  Say: [escalationAnnouncement from session context]
  Then: end the session

If escalationMode = silent_transfer:
  Say nothing. Trigger transfer immediately.

LANGUAGE

Respond in the same language the caller is using.
If the caller switches languages mid-session, switch with them.
If the caller's language is not supported by the current Lex locale,
  classify as RequestHuman with subtype LanguageNotHandled and trigger human handoff.`;

export function interpolateGreeting(template: string, config: CallAssistGreetingConfig): string {
  return template
    .replace(/\{cityName\}/g, config.cityName.trim())
    .replace(/\{agencyName\}/g, config.agencyName.trim())
    .replace(/\{lineDescription\}/g, config.lineDescription.trim() || DEFAULT_LINE_DESCRIPTION);
}

/** Lex localeId is en_US; greeting maps use BCP-47 en-US. */
export function normalizeGreetingLocale(locale: string | undefined | null): string {
  const raw = (locale ?? "en-US").trim().replace(/_/g, "-");
  if (!raw) return "en-US";
  if (raw.toLowerCase().startsWith("es")) return "es-US";
  if (raw.toLowerCase().startsWith("en")) return "en-US";
  return raw;
}

function localizedOverride(config: CallAssistGreetingConfig, locale: string): string | undefined {
  const map = config.localizedGreetings;
  if (!map) return undefined;
  const normalized = normalizeGreetingLocale(locale);
  const underscored = normalized.replace("-", "_");
  const candidates = [locale, normalized, underscored, locale.replace(/_/g, "-"), locale.replace(/-/g, "_")];
  for (const key of candidates) {
    const value = map[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function buildGreeting(config: CallAssistGreetingConfig, locale = "en-US"): string {
  const normalized = normalizeGreetingLocale(locale);
  const override = localizedOverride(config, locale);
  if (override) return interpolateGreeting(override, config);

  if (config.mode === "custom" && config.customGreetingText?.trim()) {
    return interpolateGreeting(config.customGreetingText, config);
  }

  const templateMode: Exclude<GreetingMode, "custom"> =
    config.mode === "hang_up" ? "hang_up" : "stay_on_line";

  if (normalized === "es-US") {
    return interpolateGreeting(DEFAULT_ES_GREETING_TEMPLATES[templateMode], config);
  }
  return interpolateGreeting(GREETING_TEMPLATES[templateMode], config);
}

export function buildEscalationAnnouncement(
  config: CallAssistGreetingConfig,
  locale = "en-US",
): string {
  if (config.escalationMode === "silent_transfer" || !config.speakEscalationAnnouncement) {
    return "";
  }
  if (config.escalationAnnouncementText?.trim()) {
    return interpolateGreeting(config.escalationAnnouncementText, config);
  }
  const normalized = normalizeGreetingLocale(locale);
  if (normalized === "es-US") {
    return DEFAULT_ES_ESCALATION_ANNOUNCEMENTS[config.escalationMode];
  }
  return DEFAULT_ESCALATION_ANNOUNCEMENTS[config.escalationMode];
}

export function intakePromptForLocale(locale = "en-US"): string {
  return normalizeGreetingLocale(locale) === "es-US" ? INTAKE_PROMPT_ES : INTAKE_PROMPT_EN;
}

export function fallbackGreetingForLocale(locale = "en-US"): string {
  return normalizeGreetingLocale(locale) === "es-US" ? FALLBACK_GREETING_ES : FALLBACK_GREETING;
}

export type EscalationCheck = {
  escalate: boolean;
  announcement: string;
  action: EscalationMode | "continue";
};

/**
 * Safety Engine still decides *whether* to escalate. Greeting config only
 * decides what (if anything) is spoken and whether telephony transfers or ends.
 */
export function checkEscalation(
  utterance: string,
  config: CallAssistGreetingConfig,
  locale = "en-US",
): EscalationCheck {
  const safety = evaluateSafety(utterance);
  if (!isImmutableEmergency(safety)) {
    return { escalate: false, announcement: "", action: "continue" };
  }
  return {
    escalate: true,
    announcement: buildEscalationAnnouncement(config, locale),
    action: config.escalationMode,
  };
}

export function isCallAssistGreetingReady(config: CallAssistGreetingConfig): boolean {
  return Boolean(config.cityName.trim() && config.agencyName.trim());
}

export function greetingActivationBlockedReason(config: CallAssistGreetingConfig): string | null {
  if (!config.cityName.trim()) {
    return "City name is required before Call Assist can go live. A greeting without a city sounds like a scam call.";
  }
  if (!config.agencyName.trim()) {
    return "Agency name is required before Call Assist can go live.";
  }
  if (config.mode === "custom" && !config.customGreetingText?.trim()) {
    return "Custom greeting text is required when greeting mode is Custom.";
  }
  if (!config.greetingPreviewConfirmed) {
    return "An agency administrator must preview and confirm the greeting before first use.";
  }
  return null;
}

export type GreetingTenantFields = {
  callAssistGreeting?: CallAssistGreetingConfig | null;
  tenantCity?: string | null;
  agencyName?: string | null;
  agencyDisplayName?: string | null;
  agencyShortName?: string | null;
  emergencyDestination?: string | null;
  connectEmergencyQueueArn?: string | null;
};

function templateMode(mode: GreetingMode | undefined): Exclude<GreetingMode, "custom"> {
  return mode === "hang_up" ? "hang_up" : "stay_on_line";
}

export function withDefaultLocalizedGreetings(config: CallAssistGreetingConfig): CallAssistGreetingConfig {
  const mode = templateMode(config.mode);
  const existing = { ...(config.localizedGreetings ?? {}) };
  if (!existing["es-US"]?.trim() && !existing.es_US?.trim()) {
    existing["es-US"] = interpolateGreeting(DEFAULT_ES_GREETING_TEMPLATES[mode], config);
  }
  return { ...config, localizedGreetings: existing };
}

export function defaultGreetingConfig(seed?: {
  cityName?: string;
  agencyName?: string;
  previewConfirmed?: boolean;
  emergencyTransferNumber?: string;
  emergencyTransferQueue?: string;
}): CallAssistGreetingConfig {
  const base: CallAssistGreetingConfig = {
    ...DEFAULT_GREETING_CONFIG,
    cityName: seed?.cityName?.trim() ?? "",
    agencyName: seed?.agencyName?.trim() ?? "",
    emergencyTransferNumber: seed?.emergencyTransferNumber ?? "",
    emergencyTransferQueue: seed?.emergencyTransferQueue ?? "",
    greetingPreviewConfirmed: Boolean(seed?.previewConfirmed && seed.cityName?.trim() && seed.agencyName?.trim()),
  };
  return withDefaultLocalizedGreetings(base);
}

export function resolveGreetingConfig(tenant: GreetingTenantFields | null | undefined): CallAssistGreetingConfig {
  const stored = tenant?.callAssistGreeting;
  const cityName = stored?.cityName?.trim() || tenant?.tenantCity?.trim() || "";
  const agencyName =
    stored?.agencyName?.trim() || tenant?.agencyName?.trim() || tenant?.agencyDisplayName?.trim() || "";
  const merged: CallAssistGreetingConfig = {
    ...DEFAULT_GREETING_CONFIG,
    ...(stored ?? {}),
    cityName,
    agencyName,
    lineDescription: stored?.lineDescription?.trim() || DEFAULT_LINE_DESCRIPTION,
    emergencyTransferNumber:
      stored?.emergencyTransferNumber?.trim() || tenant?.emergencyDestination?.trim() || "",
    emergencyTransferQueue:
      stored?.emergencyTransferQueue?.trim() || tenant?.connectEmergencyQueueArn?.trim() || "",
  };
  return withDefaultLocalizedGreetings(merged);
}

const GREETING_IDENTITY_KEYS = ["mode", "cityName", "agencyName", "lineDescription", "customGreetingText"] as const;

export function mergeGreetingConfig(
  current: CallAssistGreetingConfig,
  patch: CallAssistGreetingConfigPatch,
): CallAssistGreetingConfig {
  const next: CallAssistGreetingConfig = {
    ...current,
    ...patch,
    localizedGreetings: patch.localizedGreetings
      ? { ...(current.localizedGreetings ?? {}), ...patch.localizedGreetings }
      : current.localizedGreetings,
  };
  const identityChanged = GREETING_IDENTITY_KEYS.some((key) => patch[key] !== undefined && patch[key] !== current[key]);
  if (identityChanged && patch.greetingPreviewConfirmed === undefined) {
    next.greetingPreviewConfirmed = false;
  }
  return withDefaultLocalizedGreetings(next);
}

export function greetingSessionAttributes(
  agencyId: string,
  locale: string,
  config: CallAssistGreetingConfig,
  now = new Date(),
): Record<string, string> {
  const normalized = normalizeGreetingLocale(locale);
  return {
    agencyId,
    locale: normalized,
    greetingDelivered: "true",
    greetingMode: config.mode,
    escalationMode: config.escalationMode,
    emergencyTransferNumber: config.emergencyTransferNumber ?? "",
    emergencyTransferQueue: config.emergencyTransferQueue ?? "",
    enableColdClimate: String(config.enableColdClimateIntents),
    enableLiveAgentHandoff: String(config.enableLiveAgentHandoff),
    intakeStarted: "false",
    escalationTriggered: "false",
    sessionStartedAt: now.toISOString(),
    escalationAnnouncement: buildEscalationAnnouncement(config, normalized),
  };
}
