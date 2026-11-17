/**
 * Connect Lambda: NovaSessionStart
 * Creates SESSION#nova#{contactId}, returns attributes for the media/await branch.
 */
import {
  NOVA_2_SONIC_MODEL_ID,
  decideCallAssistVoiceEngine,
  emptyNovaSonicConnectHandoffAttrs,
  aniRecognitionGreeting,
} from "rapid-cortex-shared";
import { getLexTenantConfig } from "../lex/runtime-store.js";
import {
  loadTenantForNova,
  novaSonicSessionId,
  novaSonicSessionSk,
  putNovaSonicSession,
  type NovaSonicSessionRow,
} from "./session-record.js";
import { callAssistStore } from "../store.js";
import { initialHandoff } from "./tools.js";

export type NovaSessionStartEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      ContactId?: string;
      Attributes?: Record<string, string>;
      CustomerEndpoint?: { Address?: string };
    };
    ContactId?: string;
  };
};

export type NovaSessionStartResult = Record<string, string>;

function contactIdFrom(event: NovaSessionStartEvent): string {
  return (
    event.Details?.ContactData?.ContactId?.trim() ||
    event.Details?.ContactId?.trim() ||
    event.Details?.Parameters?.contactId?.trim() ||
    ""
  );
}

function agencyIdFrom(event: NovaSessionStartEvent): string {
  return (
    event.Details?.Parameters?.agencyId?.trim() ||
    event.Details?.ContactData?.Attributes?.agencyId?.trim() ||
    event.Details?.Parameters?.AgencyId?.trim() ||
    ""
  );
}

function kvsArnFrom(event: NovaSessionStartEvent): string {
  return (
    event.Details?.Parameters?.kvsStreamArn?.trim() ||
    event.Details?.ContactData?.Attributes?.kvsStreamArn?.trim() ||
    event.Details?.Parameters?.mediaStreamArn?.trim() ||
    ""
  );
}

/**
 * Returns the caller ANI from the Connect event.
 * CustomerEndpoint.Address is the E.164 caller number set by Connect.
 * SECURITY: this value is used only for read-only lookup suggestions.
 * agencyId must come from DID context, not from ANI.
 */
function aniFrom(event: NovaSessionStartEvent): string {
  return (
    event.Details?.ContactData?.CustomerEndpoint?.Address?.trim() ||
    event.Details?.Parameters?.ani?.trim() ||
    event.Details?.Parameters?.ANI?.trim() ||
    ""
  );
}

/**
 * Phase 1 — Build a known-caller prompt addendum when confirmationLoopEnabled is true
 * and there is a recent open record for the caller's ANI within this agency.
 * Returns empty string when disabled or no match found.
 * This is appended to `config.systemPromptAppend` before building the system prompt.
 * It does NOT modify the assistant identity block.
 */
async function knownCallerPromptAddendum(opts: {
  agencyId: string;
  ani: string;
  confirmationLoopEnabled?: boolean;
}): Promise<string> {
  if (!opts.confirmationLoopEnabled || !opts.ani || !opts.agencyId) return "";
  try {
    const record = await callAssistStore.findLatestRecordByAni(opts.agencyId, opts.ani);
    if (!record) return "";
    // Only surface open/active cases — not terminal ones
    const terminal = new Set(["CLOSED", "CANCELLED", "DUPLICATE"]);
    if (terminal.has(record.status)) return "";
    return `\n\nKNOWN CALLER CONTEXT: ${aniRecognitionGreeting(record.confirmationNumber)}`;
  } catch {
    return "";
  }
}

export async function buildNovaSessionStartResult(
  event: NovaSessionStartEvent,
): Promise<NovaSessionStartResult> {
  const contactId = contactIdFrom(event);
  const agencyId = agencyIdFrom(event);
  if (!contactId || !agencyId) {
    return {
      novaSessionId: "",
      novaSessionStatus: "ERROR",
      novaSonicFallbackToLex: "true",
      novaFallbackReason: "missing_agency_or_contact",
      voiceEngine: "LEX_POLLY",
      agencyVoiceName: "",
      callerDone: "false",
      emergencyEscalation: "false",
    };
  }

  const config = (await loadTenantForNova(agencyId).catch(() => null)) ?? (await getLexTenantConfig(agencyId).catch(() => null));
  const agencyVoiceName =
    config?.agencyDisplayName?.trim() ||
    config?.agencyName?.trim() ||
    config?.agencyShortName?.trim() ||
    config?.shortName?.trim() ||
    agencyId;

  // Phase 1 — ANI known-caller addendum (non-blocking, fail-safe)
  const ani = aniFrom(event);
  const knownCallerAddendum = await knownCallerPromptAddendum({
    agencyId,
    ani,
    confirmationLoopEnabled: config?.confirmationLoopEnabled,
  });
  const agencyPromptWithContext = knownCallerAddendum
    ? `${config?.systemPromptAppend ?? ""}${knownCallerAddendum}`
    : config?.systemPromptAppend;

  const decision = decideCallAssistVoiceEngine({
    agencyId,
    sessionId: contactId,
    novaSonicEnabled: config?.novaSonicEnabled === true,
    agencyPrompt: agencyPromptWithContext,
    agencyVoiceName,
    voiceId: config?.novaSonicVoiceId,
  });

  if (decision.voiceEngine !== "NOVA_SONIC") {
    const reason = decision.reason ?? "not_enabled";
    void import("../ops-events.js").then(({ publishNovaSonicFallback }) =>
      publishNovaSonicFallback({ agencyId, sessionId: contactId, reason }),
    );
    return {
      novaSessionId: novaSonicSessionId(contactId),
      novaSessionStatus: "FALLBACK",
      novaSonicFallbackToLex: "true",
      novaFallbackReason: reason,
      voiceEngine: "LEX_POLLY",
      agencyVoiceName,
      callerDone: "false",
      emergencyEscalation: "false",
      systemPromptReady: "false",
    };
  }

  const now = new Date().toISOString();
  const handoff = initialHandoff();
  const row: NovaSonicSessionRow = {
    agencyId,
    sessionId: novaSonicSessionId(contactId),
    sk: novaSonicSessionSk(contactId),
    kind: "nova_sonic",
    contactId,
    agencyVoiceName,
    systemPrompt: decision.systemPrompt ?? "",
    voiceId: config?.novaSonicVoiceId?.trim() || "matthew",
    // ANI is stored for the gateway server to pass to the stream (Phase 1 lifecycle lookup).
    ...(ani ? { ani } : {}),
    modelId: decision.modelId ?? NOVA_2_SONIC_MODEL_ID,
    kvsStreamArn: kvsArnFrom(event) || undefined,
    status: "PENDING",
    intake: {},
    handoff,
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
  };

  try {
    await putNovaSonicSession(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "session_put_failed";
    void import("../ops-events.js").then(({ publishNovaSonicFallback }) =>
      publishNovaSonicFallback({ agencyId, sessionId: contactId, reason: message.slice(0, 180) }),
    );
    return {
      novaSessionId: row.sessionId,
      novaSessionStatus: "ERROR",
      novaSonicFallbackToLex: "true",
      novaFallbackReason: message.slice(0, 180),
      voiceEngine: "LEX_POLLY",
      agencyVoiceName,
      callerDone: "false",
      emergencyEscalation: "false",
    };
  }

  // Fire-and-forget notify gateway when configured
  const gatewayUrl = process.env.NOVA_SONIC_GATEWAY_URL?.trim();
  if (gatewayUrl) {
    void fetch(`${gatewayUrl.replace(/\/$/, "")}/sessions/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agencyId,
        contactId,
        sessionId: row.sessionId,
        kvsStreamArn: row.kvsStreamArn,
        agencyVoiceName,
        voiceId: row.voiceId,
        modelId: row.modelId,
      }),
    }).catch(() => undefined);
  }

  const handoffAttrs = emptyNovaSonicConnectHandoffAttrs({ novaSessionStatus: "ACTIVE" });
  return {
    agencyId,
    novaSessionId: row.sessionId,
    novaSessionStatus: "PENDING",
    novaSonicFallbackToLex: handoffAttrs.novaSonicFallbackToLex,
    novaFallbackReason: handoffAttrs.novaFallbackReason,
    voiceEngine: "NOVA_SONIC",
    agencyVoiceName,
    callerDone: handoffAttrs.callerDone,
    emergencyEscalation: handoffAttrs.emergencyEscalation,
    systemPromptReady: "true",
    confirmationNumber: handoffAttrs.confirmationNumber,
    escalationAnnouncement: handoffAttrs.escalationAnnouncement,
  };
}

export async function handler(event: NovaSessionStartEvent): Promise<NovaSessionStartResult> {
  return buildNovaSessionStartResult(event);
}
