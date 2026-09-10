import {
  buildGreeting,
  checkEscalation,
  fallbackGreetingForLocale,
  greetingSessionAttributes,
  intakePromptForLocale,
  isCallAssistGreetingReady,
  normalizeGreetingLocale,
  resolveGreetingConfig,
  type CallAssistGreetingConfig,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";
import type { LexMessage } from "./types.js";
import { elicitIntentResponse, plain, ssml } from "./lex-responses.js";
import { getLexTenantConfig } from "./runtime-store.js";
import type { LexV2Event, LexV2Response } from "./types.js";
import { WELCOME_INTENT } from "./dialog-intercept.js";

export function isCallAssistGreetingConfigEnabled(): boolean {
  const v = process.env.ENABLE_CALL_ASSIST_GREETING_CONFIG?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export type CallAssistSessionStartResult = {
  greeting: string;
  sessionAttributes: Record<string, string>;
  nextAction: "begin_intake";
  usedFallback: boolean;
  config: CallAssistGreetingConfig | null;
};

export function startCallAssistSession(opts: {
  agencyId: string;
  locale?: string;
  existingAttributes?: Record<string, string>;
  config: CallAssistTenantConfig | null;
  now?: Date;
}): CallAssistSessionStartResult {
  const locale = normalizeGreetingLocale(opts.locale ?? opts.existingAttributes?.locale ?? "en-US");
  const agencyId = opts.agencyId || opts.existingAttributes?.agencyId || "";
  const alreadyDelivered = opts.existingAttributes?.greetingDelivered === "true";

  if (!opts.config) {
    const greeting = alreadyDelivered ? intakePromptForLocale(locale) : fallbackGreetingForLocale(locale);
    return {
      greeting,
      sessionAttributes: {
        ...(opts.existingAttributes ?? {}),
        agencyId,
        locale,
        greetingDelivered: "true",
        greetingMode: "stay_on_line",
        escalationMode: "announce_and_transfer",
        emergencyTransferNumber: "",
        emergencyTransferQueue: "",
        enableColdClimate: "false",
        enableLiveAgentHandoff: "true",
        intakeStarted: alreadyDelivered ? "true" : "false",
        escalationTriggered: "false",
        sessionStartedAt: (opts.now ?? new Date()).toISOString(),
        usedFallbackGreeting: "true",
      },
      nextAction: "begin_intake",
      usedFallback: true,
      config: null,
    };
  }

  const greetingConfig = resolveGreetingConfig(opts.config);
  const spoken = alreadyDelivered
    ? intakePromptForLocale(locale)
    : isCallAssistGreetingReady(greetingConfig)
      ? buildGreeting(greetingConfig, locale)
      : fallbackGreetingForLocale(locale);
  return {
    greeting: spoken,
    sessionAttributes: {
      ...(opts.existingAttributes ?? {}),
      ...greetingSessionAttributes(agencyId, locale, greetingConfig, opts.now),
      greetingDelivered: "true",
      usedFallbackGreeting: isCallAssistGreetingReady(greetingConfig) ? "false" : "true",
      intakeStarted: alreadyDelivered ? "true" : "false",
    },
    nextAction: "begin_intake",
    usedFallback: !isCallAssistGreetingReady(greetingConfig),
    config: greetingConfig,
  };
}

export function lexWelcomeResponse(start: CallAssistSessionStartResult): LexV2Response {
  return elicitIntentResponse(WELCOME_INTENT, start.sessionAttributes, [plain(start.greeting)]);
}

export async function handleSessionStart(event: LexV2Event): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const locale = event.bot?.localeId ?? sessionAttrs.locale ?? "en-US";
  const config = agencyId ? await getLexTenantConfig(agencyId).catch(() => null) : null;
  const start = startCallAssistSession({
    agencyId,
    locale,
    existingAttributes: sessionAttrs,
    config,
  });
  return lexWelcomeResponse(start);
}

/** Lex CodeHook for Welcome. Connect should invoke get-agency-for-number, which uses the same builder. */
export const handler = handleSessionStart;

export function escalationCloseParts(
  config: CallAssistTenantConfig | null,
  locale: string,
  sessionAttrs: Record<string, string>,
  fallbackSpoken: string,
  utterance: string,
): { messages: LexMessage[]; sessionAttributes: Record<string, string>; endSession: boolean } {
  const greetingConfig = config ? resolveGreetingConfig(config) : null;
  if (!greetingConfig || !isCallAssistGreetingConfigEnabled()) {
    return {
      messages: fallbackSpoken.trim() ? [ssml(fallbackSpoken)] : [],
      sessionAttributes: { ...sessionAttrs, escalationMode: "announce_and_transfer" },
      endSession: false,
    };
  }
  const check = checkEscalation(utterance || "emergency", greetingConfig, locale);
  const announcement = check.announcement;
  const endSession = check.action === "announce_and_end";
  const messages: LexMessage[] = announcement.trim() ? [ssml(announcement)] : [];
  return {
    messages,
    sessionAttributes: {
      ...sessionAttrs,
      escalationMode: greetingConfig.escalationMode,
      escalationAnnouncement: announcement,
      emergencyTransferNumber: greetingConfig.emergencyTransferNumber ?? "",
      emergencyTransferQueue: greetingConfig.emergencyTransferQueue ?? "",
    },
    endSession,
  };
}
