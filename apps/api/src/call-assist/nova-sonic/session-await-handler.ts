/**
 * Connect Lambda: NovaSessionAwait
 * Runs (or waits on) the Nova Sonic conversation, returns handoff attrs for the flow.
 * Mock audio via Parameters.mockUtterances (pipe-separated) for DID smoke without KVS.
 */
import { UpdateContactAttributesCommand, ConnectClient } from "@aws-sdk/client-connect";
import type { NovaSonicConnectHandoffAttrs } from "rapid-cortex-shared";
import { mockTextAudioChunk, runNovaSonicStream } from "./bedrock-stream.js";
import {
  getNovaSonicSession,
  updateNovaSonicSession,
} from "./session-record.js";
import { fallbackHandoff } from "./tools.js";

export type NovaSessionAwaitEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      ContactId?: string;
      Attributes?: Record<string, string>;
      InstanceARN?: string;
    };
    ContactId?: string;
  };
};

function contactIdFrom(event: NovaSessionAwaitEvent): string {
  return (
    event.Details?.ContactData?.ContactId?.trim() ||
    event.Details?.ContactId?.trim() ||
    event.Details?.Parameters?.contactId?.trim() ||
    ""
  );
}

function agencyIdFrom(event: NovaSessionAwaitEvent): string {
  return (
    event.Details?.Parameters?.agencyId?.trim() ||
    event.Details?.ContactData?.Attributes?.agencyId?.trim() ||
    ""
  );
}

function mockUtterancesFrom(event: NovaSessionAwaitEvent): string[] {
  const raw =
    event.Details?.Parameters?.mockUtterances?.trim() ||
    process.env.NOVA_SONIC_SMOKE_UTTERANCES?.trim() ||
    "";
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function* utterancesAsAudio(utterances: string[]): AsyncGenerator<string> {
  for (const u of utterances) {
    yield mockTextAudioChunk(u);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function* emptyAudioWithTimeout(ms: number): AsyncGenerator<string> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    // Gateway may complete the session out-of-band; poll is done by caller.
  }
}

function attrsToStringMap(handoff: NovaSonicConnectHandoffAttrs): Record<string, string> {
  return {
    callerDone: handoff.callerDone,
    emergencyEscalation: handoff.emergencyEscalation,
    novaSonicFallbackToLex: handoff.novaSonicFallbackToLex,
    confirmationNumber: handoff.confirmationNumber,
    escalationAnnouncement: handoff.escalationAnnouncement,
    novaSessionStatus: handoff.novaSessionStatus,
    novaFallbackReason: handoff.novaFallbackReason,
  };
}

async function pushConnectAttrs(opts: {
  contactId: string;
  handoff: NovaSonicConnectHandoffAttrs;
}): Promise<void> {
  const instanceId = process.env.CONNECT_INSTANCE_ID?.trim();
  if (!instanceId || process.env.CALL_ASSIST_CONNECT_MOCK === "true") return;
  try {
    const client = new ConnectClient({ region: process.env.AWS_REGION?.trim() || "us-east-1" });
    await client.send(
      new UpdateContactAttributesCommand({
        InstanceId: instanceId,
        InitialContactId: opts.contactId,
        Attributes: attrsToStringMap(opts.handoff),
      }),
    );
  } catch {
    /* never fail the call on attr push */
  }
}

export async function buildNovaSessionAwaitResult(
  event: NovaSessionAwaitEvent,
): Promise<Record<string, string>> {
  const contactId = contactIdFrom(event);
  const agencyId = agencyIdFrom(event);
  if (!contactId || !agencyId) {
    const handoff = fallbackHandoff("missing_agency_or_contact");
    return attrsToStringMap(handoff);
  }

  const session = await getNovaSonicSession(agencyId, contactId);
  if (!session) {
    const handoff = fallbackHandoff("session_not_found");
    return attrsToStringMap(handoff);
  }

  if (session.handoff.novaSonicFallbackToLex === "true" || session.status === "FALLBACK") {
    return attrsToStringMap(session.handoff);
  }

  // Prefer gateway completion: poll Dynamo briefly when gateway URL is set and no mock utterances.
  const gatewayUrl = process.env.NOVA_SONIC_GATEWAY_URL?.trim();
  const mocks = mockUtterancesFrom(event);
  const forceInline =
    mocks.length > 0 ||
    process.env.NOVA_SONIC_BEDROCK_MOCK === "1" ||
    process.env.NOVA_SONIC_BEDROCK_MOCK === "true" ||
    !gatewayUrl;

  if (!forceInline && gatewayUrl) {
    const deadline = Date.now() + Number(process.env.NOVA_SONIC_AWAIT_MS ?? 240_000);
    while (Date.now() < deadline) {
      const current = await getNovaSonicSession(agencyId, contactId);
      if (current && current.status !== "PENDING" && current.status !== "ACTIVE") {
        await pushConnectAttrs({ contactId, handoff: current.handoff });
        return attrsToStringMap(current.handoff);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    const timedOut = fallbackHandoff("gateway_timeout");
    await updateNovaSonicSession(agencyId, contactId, { status: "FALLBACK", handoff: timedOut });
    return attrsToStringMap(timedOut);
  }

  await updateNovaSonicSession(agencyId, contactId, { status: "ACTIVE" });

  const audioSource =
    mocks.length > 0
      ? utterancesAsAudio(mocks)
      : emptyAudioWithTimeout(Number(process.env.NOVA_SONIC_INLINE_IDLE_MS ?? 5_000));

  // Default smoke path when no utterances provided in mock: abandoned vehicle script
  const source =
    mocks.length > 0
      ? audioSource
      : utterancesAsAudio([
          "There's a car been sitting on my street for three days.",
          "4500 Warwick",
          "No one inside",
          "That's all, can I get my report number?",
        ]);

  const useDefaultSmoke =
    mocks.length === 0 &&
    (process.env.NOVA_SONIC_BEDROCK_MOCK === "1" ||
      process.env.NOVA_SONIC_BEDROCK_MOCK === "true" ||
      process.env.CALL_ASSIST_CONNECT_MOCK === "true");

  const result = await runNovaSonicStream({
    agencyId,
    contactId,
    promptName: `nexcortiq-${agencyId}`,
    systemPrompt: session.systemPrompt,
    voiceId: session.voiceId,
    modelId: session.modelId,
    config: null,
    audioSource: useDefaultSmoke || mocks.length > 0 ? source : audioSource,
    onHandoff: async (handoff) => {
      await updateNovaSonicSession(agencyId, contactId, {
        status:
          handoff.novaSessionStatus === "ACTIVE"
            ? "ACTIVE"
            : (handoff.novaSessionStatus as "COMPLETED" | "EMERGENCY" | "FALLBACK" | "HUMAN" | "ERROR"),
        handoff,
      });
      await pushConnectAttrs({ contactId, handoff });
    },
  });

  await updateNovaSonicSession(agencyId, contactId, {
    status:
      result.handoff.novaSessionStatus === "ACTIVE"
        ? "COMPLETED"
        : (result.handoff.novaSessionStatus as "COMPLETED" | "EMERGENCY" | "FALLBACK" | "HUMAN" | "ERROR"),
    intake: result.intake,
    handoff: result.handoff,
  });

  return {
    ...attrsToStringMap(result.handoff),
    novaSessionId: session.sessionId,
    voiceEngine: result.handoff.novaSonicFallbackToLex === "true" ? "LEX_POLLY" : "NOVA_SONIC",
  };
}

export async function handler(event: NovaSessionAwaitEvent): Promise<Record<string, string>> {
  return buildNovaSessionAwaitResult(event);
}
