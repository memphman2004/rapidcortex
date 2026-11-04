/**
 * Bedrock InvokeModelWithBidirectionalStream client for Nova Sonic Call Assist.
 * Mock mode (NOVA_SONIC_BEDROCK_MOCK=1) drives scripted turns without AWS.
 */
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from "@smithy/node-http-handler";
import {
  NOVA_2_SONIC_MODEL_ID,
  consumeNovaSonicOutput,
  novaSonicAudioInputEvent,
  novaSonicOpeningEvents,
  novaSonicToolResultEvent,
  type NovaSonicConnectHandoffAttrs,
  type NovaSonicSessionEvent,
} from "rapid-cortex-shared";
import {
  emergencyHandoffFromTranscript,
  executeNovaSonicTool,
  fallbackHandoff,
  initialHandoff,
  mergeHandoff,
  type NovaSonicIntakeState,
  type NovaSonicToolContext,
} from "./tools.js";

export type NovaSonicStreamDeps = {
  agencyId: string;
  contactId: string;
  promptName: string;
  systemPrompt: string;
  voiceId?: string;
  modelId?: string;
  config?: NovaSonicToolContext["config"];
  /** Yields base64 LPCM chunks from Connect/KVS (or mock). */
  audioSource: AsyncIterable<string>;
  onAudioOut?: (base64: string) => void | Promise<void>;
  onTranscript?: (text: string) => void | Promise<void>;
  onHandoff?: (attrs: NovaSonicConnectHandoffAttrs) => void | Promise<void>;
};

export type NovaSonicStreamResult = {
  handoff: NovaSonicConnectHandoffAttrs;
  intake: NovaSonicIntakeState;
  transcript: string;
  fallbackReason: string | null;
};

function bedrockMockEnabled(): boolean {
  const v = process.env.NOVA_SONIC_BEDROCK_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true" || process.env.CALL_ASSIST_CONNECT_MOCK === "true";
}

function encodeEvent(evt: NovaSonicSessionEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(evt));
}

function parseToolUse(inner: Record<string, unknown>): {
  toolUseId: string;
  toolName: string;
  content: unknown;
} | null {
  const toolUse = inner.toolUse as
    | { toolUseId?: string; toolName?: string; name?: string; content?: unknown }
    | undefined;
  if (!toolUse) return null;
  const toolUseId = toolUse.toolUseId?.trim() ?? "";
  const toolName = (toolUse.toolName ?? toolUse.name ?? "").trim();
  if (!toolUseId || !toolName) return null;
  return { toolUseId, toolName, content: toolUse.content };
}

/** Scripted mock path for CI and local DID smoke without Bedrock access. */
export async function runNovaSonicStreamMock(deps: NovaSonicStreamDeps): Promise<NovaSonicStreamResult> {
  let transcript = "";
  let intake: NovaSonicIntakeState = {};
  let handoff = initialHandoff();
  const ctx: NovaSonicToolContext = {
    agencyId: deps.agencyId,
    contactId: deps.contactId,
    config: deps.config,
    intake,
  };

  for await (const chunk of deps.audioSource) {
    if (!chunk) continue;
    // Mock treats base64 text markers as spoken phrases when prefixed with "text:"
    let heard = "";
    try {
      const decoded = Buffer.from(chunk, "base64").toString("utf8");
      if (decoded.startsWith("text:")) heard = decoded.slice(5);
    } catch {
      heard = "";
    }
    if (!heard) continue;
    transcript += `${heard} `;
    await deps.onTranscript?.(heard);

    const emergency = emergencyHandoffFromTranscript(heard);
    if (emergency) {
      handoff = mergeHandoff(handoff, emergency);
      await deps.onHandoff?.(handoff);
      return { handoff, intake, transcript: transcript.trim(), fallbackReason: null };
    }

    if (/report number|confirmation|done|that's all|that is all/i.test(heard) && intake.locationText) {
      const result = executeNovaSonicTool(
        "issue_report_number",
        {
          locationText: intake.locationText,
          incidentTypeHint: intake.incidentTypeHint || "general",
          summary: intake.summary || heard,
        },
        { ...ctx, intake },
      );
      intake = { ...intake, ...result.intakePatch };
      handoff = mergeHandoff(handoff, result.handoff);
      await deps.onAudioOut?.(Buffer.from(String(result.payload.speak ?? ""), "utf8").toString("base64"));
      await deps.onHandoff?.(handoff);
      return { handoff, intake, transcript: transcript.trim(), fallbackReason: null };
    }

    if (/human|operator|real person|agent/i.test(heard)) {
      const result = executeNovaSonicTool("request_human", { reason: "caller_requested_human" }, { ...ctx, intake });
      intake = { ...intake, ...result.intakePatch };
      handoff = mergeHandoff(handoff, result.handoff);
      await deps.onHandoff?.(handoff);
      return { handoff, intake, transcript: transcript.trim(), fallbackReason: null };
    }

    if (/street|avenue|road|blvd|warwick|main|intersection|\d{3,5}\s+\w+/i.test(heard)) {
      const result = executeNovaSonicTool(
        "save_intake_fields",
        { locationText: heard, incidentTypeHint: intake.incidentTypeHint || "abandoned_vehicle" },
        { ...ctx, intake },
      );
      intake = { ...intake, ...result.intakePatch };
      ctx.intake = intake;
      await deps.onAudioOut?.(Buffer.from("Got it. Anyone inside?", "utf8").toString("base64"));
      continue;
    }

    if (/car|vehicle|parked|sitting|abandoned|suspicious|noise|theft/i.test(heard)) {
      const result = executeNovaSonicTool(
        "save_intake_fields",
        { incidentTypeHint: "abandoned_vehicle", summary: heard },
        { ...ctx, intake },
      );
      intake = { ...intake, ...result.intakePatch };
      ctx.intake = intake;
      await deps.onAudioOut?.(Buffer.from("What street?", "utf8").toString("base64"));
    }
  }

  if (intake.locationText && intake.incidentTypeHint) {
    const result = executeNovaSonicTool(
      "issue_report_number",
      {
        locationText: intake.locationText,
        incidentTypeHint: intake.incidentTypeHint,
        summary: intake.summary || "",
      },
      { ...ctx, intake },
    );
    intake = { ...intake, ...result.intakePatch };
    handoff = mergeHandoff(handoff, result.handoff);
    await deps.onHandoff?.(handoff);
    return { handoff, intake, transcript: transcript.trim(), fallbackReason: null };
  }

  handoff = fallbackHandoff("mock_incomplete");
  await deps.onHandoff?.(handoff);
  return { handoff, intake, transcript: transcript.trim(), fallbackReason: "mock_incomplete" };
}

export async function runNovaSonicStream(deps: NovaSonicStreamDeps): Promise<NovaSonicStreamResult> {
  if (bedrockMockEnabled()) {
    return runNovaSonicStreamMock(deps);
  }

  const modelId = deps.modelId?.trim() || NOVA_2_SONIC_MODEL_ID;
  const promptName = deps.promptName;
  const systemContent = "system";
  const audioContent = "caller-audio";
  let transcript = "";
  let intake: NovaSonicIntakeState = {};
  let handoff = initialHandoff();
  const pendingOut: NovaSonicSessionEvent[] = [
    ...novaSonicOpeningEvents({
      promptName,
      contentName: systemContent,
      voiceId: deps.voiceId,
      systemPrompt: deps.systemPrompt,
      includeTools: true,
    }),
    {
      event: {
        contentStart: {
          promptName,
          contentName: audioContent,
          type: "AUDIO",
          interactive: true,
          role: "USER",
          audioInputConfiguration: {
            mediaType: "audio/lpcm",
            sampleRateHertz: 16000,
            sampleSizeBits: 16,
            channelCount: 1,
            encoding: "base64",
            audioType: "SPEECH",
          },
        },
      },
    },
  ];

  let audioEnded = false;
  let toolSeq = 0;
  let resolveWait: (() => void) | undefined;
  const waitDrain = () =>
    new Promise<void>((resolve) => {
      resolveWait = resolve;
    });

  const enqueueEvents = (events: NovaSonicSessionEvent[]) => {
    pendingOut.push(...events);
    const wake = resolveWait;
    resolveWait = undefined;
    wake?.();
  };

  async function* body(): AsyncGenerator<{ chunk: { bytes: Uint8Array } }> {
    while (true) {
      while (pendingOut.length > 0) {
        const next = pendingOut.shift()!;
        yield { chunk: { bytes: encodeEvent(next) } };
      }
      if (audioEnded && pendingOut.length === 0 && handoff.novaSessionStatus !== "ACTIVE") {
        yield {
          chunk: {
            bytes: encodeEvent({
              event: { contentEnd: { promptName, contentName: audioContent } },
            }),
          },
        };
        yield { chunk: { bytes: encodeEvent({ event: { promptEnd: { promptName } } }) } };
        yield { chunk: { bytes: encodeEvent({ event: { sessionEnd: {} } }) } };
        return;
      }
      await waitDrain();
    }
  }

  const audioPump = (async () => {
    try {
      for await (const chunk of deps.audioSource) {
        if (!chunk) continue;
        enqueueEvents([
          novaSonicAudioInputEvent({ promptName, contentName: audioContent, audioBase64: chunk }),
        ]);
        if (handoff.novaSessionStatus !== "ACTIVE") break;
      }
    } finally {
      audioEnded = true;
      const wake = resolveWait;
      resolveWait = undefined;
      wake?.();
    }
  })();

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION?.trim() || "us-east-1",
    requestHandler: new NodeHttp2Handler({
      requestTimeout: 300_000,
      sessionTimeout: 300_000,
      disableConcurrentStreams: false,
      maxConcurrentStreams: 20,
    }),
  });

  try {
    const response = await client.send(
      new InvokeModelWithBidirectionalStreamCommand({
        modelId,
        body: body(),
      }),
    );

    if (!response.body) {
      handoff = fallbackHandoff("empty_stream");
      await deps.onHandoff?.(handoff);
      return { handoff, intake, transcript, fallbackReason: "empty_stream" };
    }

    for await (const part of response.body) {
      const bytes = part.chunk?.bytes;
      if (!bytes) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        continue;
      }
      const turn = consumeNovaSonicOutput(parsed, transcript);
      if (turn.fallbackReason) {
        handoff = fallbackHandoff(turn.fallbackReason);
        await deps.onHandoff?.(handoff);
        break;
      }
      for (const audio of turn.audioChunks) {
        await deps.onAudioOut?.(audio);
      }
      if (turn.transcript !== transcript) {
        transcript = turn.transcript;
        await deps.onTranscript?.(transcript);
      }
      if (turn.emergencyKeyword) {
        handoff = mergeHandoff(handoff, emergencyHandoffFromTranscript(transcript) ?? undefined);
        await deps.onHandoff?.(handoff);
        break;
      }

      const bodyObj = parsed as { event?: Record<string, unknown> };
      const inner = bodyObj.event;
      if (inner) {
        const tool = parseToolUse(inner);
        if (tool) {
          const result = executeNovaSonicTool(tool.toolName, tool.content, {
            agencyId: deps.agencyId,
            contactId: deps.contactId,
            config: deps.config,
            intake,
          });
          intake = { ...intake, ...result.intakePatch };
          handoff = mergeHandoff(handoff, result.handoff);
          toolSeq += 1;
          enqueueEvents(
            novaSonicToolResultEvent({
              promptName,
              contentName: `tool-result-${toolSeq}`,
              toolUseId: tool.toolUseId,
              result: result.payload,
            }),
          );
          await deps.onHandoff?.(handoff);
          if (handoff.novaSessionStatus !== "ACTIVE") break;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "stream_error";
    handoff = fallbackHandoff(message);
    await deps.onHandoff?.(handoff);
    await audioPump.catch(() => undefined);
    return { handoff, intake, transcript, fallbackReason: message };
  }

  await audioPump.catch(() => undefined);
  if (handoff.novaSessionStatus === "ACTIVE") {
    handoff = fallbackHandoff("stream_ended_without_completion");
    await deps.onHandoff?.(handoff);
  }
  return {
    handoff,
    intake,
    transcript,
    fallbackReason: handoff.novaSonicFallbackToLex === "true" ? handoff.novaFallbackReason || "fallback" : null,
  };
}

/** Encode a mock spoken phrase as a base64 audio chunk for the mock stream. */
export function mockTextAudioChunk(text: string): string {
  return Buffer.from(`text:${text}`, "utf8").toString("base64");
}
