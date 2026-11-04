/**
 * Connect Lambda: NovaSessionStart
 * Creates SESSION#nova#{contactId}, returns attributes for the media/await branch.
 */
import {
  NOVA_2_SONIC_MODEL_ID,
  decideCallAssistVoiceEngine,
  emptyNovaSonicConnectHandoffAttrs,
} from "rapid-cortex-shared";
import { getLexTenantConfig } from "../lex/runtime-store.js";
import {
  loadTenantForNova,
  novaSonicSessionId,
  novaSonicSessionSk,
  putNovaSonicSession,
  type NovaSonicSessionRow,
} from "./session-record.js";
import { initialHandoff } from "./tools.js";

export type NovaSessionStartEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      ContactId?: string;
      Attributes?: Record<string, string>;
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

  const decision = decideCallAssistVoiceEngine({
    agencyId,
    sessionId: contactId,
    novaSonicEnabled: config?.novaSonicEnabled === true,
    agencyPrompt: config?.systemPromptAppend,
    agencyVoiceName,
    voiceId: config?.novaSonicVoiceId,
  });

  if (decision.voiceEngine !== "NOVA_SONIC") {
    return {
      novaSessionId: novaSonicSessionId(contactId),
      novaSessionStatus: "FALLBACK",
      novaSonicFallbackToLex: "true",
      novaFallbackReason: decision.reason ?? "not_enabled",
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
