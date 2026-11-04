/**
 * Nova Sonic Gateway — long-lived HTTP worker for Bedrock bidirectional streams.
 * ECS entrypoint. Connect NovaSessionStart POSTs /sessions/start; await polls Dynamo.
 */
import http from "node:http";
import { decideCallAssistVoiceEngine, NOVA_2_SONIC_MODEL_ID } from "rapid-cortex-shared";
import { runNovaSonicStream, mockTextAudioChunk } from "../bedrock-stream.js";
import {
  getNovaSonicSession,
  loadTenantForNova,
  updateNovaSonicSession,
} from "../session-record.js";

const PORT = Number(process.env.PORT ?? process.env.NOVA_SONIC_GATEWAY_PORT ?? 8080);

type StartBody = {
  agencyId?: string;
  contactId?: string;
  sessionId?: string;
  kvsStreamArn?: string;
  agencyVoiceName?: string;
  voiceId?: string;
  modelId?: string;
  /** Pipe-separated mock utterances for smoke without KVS. */
  mockUtterances?: string;
};

const active = new Map<string, AbortController>();

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function* mockOrIdleAudio(mockUtterances?: string): AsyncGenerator<string> {
  const parts = (mockUtterances ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) {
    for (const p of parts) {
      yield mockTextAudioChunk(p);
      await new Promise((r) => setTimeout(r, 20));
    }
    return;
  }
  // KVS consumer is wired when kvsStreamArn is present in a follow-on; idle until cancelled.
  const idleMs = Number(process.env.NOVA_SONIC_GATEWAY_IDLE_MS ?? 60_000);
  const end = Date.now() + idleMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function runSession(body: StartBody): Promise<void> {
  const agencyId = body.agencyId?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";
  if (!agencyId || !contactId) return;

  const key = `${agencyId}#${contactId}`;
  active.get(key)?.abort();
  const ac = new AbortController();
  active.set(key, ac);

  const existing = await getNovaSonicSession(agencyId, contactId);
  const config = await loadTenantForNova(agencyId);
  const agencyVoiceName =
    body.agencyVoiceName?.trim() ||
    existing?.agencyVoiceName ||
    config?.agencyDisplayName?.trim() ||
    agencyId;
  const decision = decideCallAssistVoiceEngine({
    agencyId,
    sessionId: contactId,
    novaSonicEnabled: config?.novaSonicEnabled === true || Boolean(existing?.systemPrompt),
    agencyPrompt: config?.systemPromptAppend,
    agencyVoiceName,
    voiceId: body.voiceId || existing?.voiceId,
  });
  const systemPrompt = existing?.systemPrompt || decision.systemPrompt || "";

  await updateNovaSonicSession(agencyId, contactId, { status: "ACTIVE", kvsStreamArn: body.kvsStreamArn });

  try {
    const result = await runNovaSonicStream({
      agencyId,
      contactId,
      promptName: `nexcortiq-${agencyId}`,
      systemPrompt,
      voiceId: body.voiceId || existing?.voiceId || "matthew",
      modelId: body.modelId || existing?.modelId || NOVA_2_SONIC_MODEL_ID,
      config,
      audioSource: mockOrIdleAudio(body.mockUtterances),
      onHandoff: async (handoff) => {
        await updateNovaSonicSession(agencyId, contactId, {
          status:
            handoff.novaSessionStatus === "ACTIVE"
              ? "ACTIVE"
              : (handoff.novaSessionStatus as "COMPLETED" | "EMERGENCY" | "FALLBACK" | "HUMAN" | "ERROR"),
          handoff,
        });
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
  } catch (err) {
    const reason = err instanceof Error ? err.message : "gateway_error";
    await updateNovaSonicSession(agencyId, contactId, {
      status: "FALLBACK",
      handoff: {
        callerDone: "false",
        emergencyEscalation: "false",
        novaSonicFallbackToLex: "true",
        confirmationNumber: "",
        escalationAnnouncement: "",
        novaSessionStatus: "FALLBACK",
        novaFallbackReason: reason.slice(0, 180),
      },
    });
  } finally {
    active.delete(key);
  }
}

export function createNovaSonicGatewayServer(): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, active: active.size });
      return;
    }
    if (req.method === "POST" && url.pathname === "/sessions/start") {
      const body = (await readJson(req)) as StartBody;
      void runSession(body);
      json(res, 202, {
        accepted: true,
        agencyId: body.agencyId ?? "",
        contactId: body.contactId ?? "",
      });
      return;
    }
    json(res, 404, { error: "not_found" });
  });
}

export function startNovaSonicGateway(): http.Server {
  const server = createNovaSonicGatewayServer();
  server.listen(PORT, () => {
    console.log(JSON.stringify({ msg: "nova_sonic_gateway_listen", port: PORT }));
  });
  return server;
}

if (require.main === module) {
  startNovaSonicGateway();
}
