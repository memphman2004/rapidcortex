import type { ScheduledHandler } from "aws-lambda";
import {
  KinesisVideoClient,
  GetDataEndpointCommand,
  APIName,
} from "@aws-sdk/client-kinesis-video";
import {
  KinesisVideoArchivedMediaClient,
  GetHLSStreamingSessionURLCommand,
} from "@aws-sdk/client-kinesis-video-archived-media";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { VisionObservation, VisionSession, VisionWebSocketEvent } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import { DEMO_OBSERVATION_SCRIPT } from "./providers/DemoVisionProvider.js";
import { visionStore } from "./store.js";
import {
  detectTranscriptCorrelation,
  parseClaudeVisionResponse,
  streamClaudeVision,
  type IncidentContext,
} from "./claude-vision.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const kv = new KinesisVideoClient({});
const auditRepo = new AuditRepository();

const THROTTLE_SECONDS = env.visionAiWriterIntervalSeconds || 30;
const MAX_CONCURRENT = env.visionMaxActiveAnalysesPerAgency || 10;

async function pushVisionEvent(agencyId: string, event: VisionWebSocketEvent): Promise<void> {
  const { type, ...rest } = event;
  await broadcastToAgency({
    agencyId,
    message: { type, data: rest as unknown as Record<string, unknown> },
  });
}

export const handler: ScheduledHandler = async () => {
  if (!env.enableRapidVision || !env.enableRapidVisionAiWriter) return;
  if (!env.visionSessionsTable) return;

  const sessions = await visionStore.listActiveAiSessions();
  if (sessions.length === 0) return;
  const batch = sessions.slice(0, MAX_CONCURRENT);
  await Promise.allSettled(batch.map((session) => analyzeSession(session)));
};

async function analyzeSession(session: VisionSession & { startedAt?: string }): Promise<void> {
  if (session.lastAnalyzedAt) {
    const secondsAgo = (Date.now() - new Date(session.lastAnalyzedAt).getTime()) / 1000;
    if (secondsAgo < THROTTLE_SECONDS) return;
  }
  if (new Date(session.expiresAt) <= new Date()) {
    await visionStore.markSessionExpired(session.incidentId, session.sessionId, session.agencyId);
    return;
  }

  if (session.provider === "demo") {
    await generateDemoObservation(session);
    return;
  }

  if (!session.kvsChannelName && !session.kvsStreamArn) return;

  let frameBase64: string | null = null;
  try {
    frameBase64 = await extractLatestFrame(session.kvsStreamArn ?? session.kvsChannelName!);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_frame_extraction_failed",
        sessionId: session.sessionId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return;
  }

  if (!frameBase64) {
    if (env.visionAiMock) {
      frameBase64 = Buffer.from("mock-frame").toString("base64");
    } else {
      return;
    }
  }

  const context = await buildIncidentContext(session.incidentId, session.agencyId);
  const cameraName = await getCameraName(session.agencyId, session.cameraId);
  const observation = await callClaudeVisionStreaming({
    session,
    frameBase64,
    context,
    cameraName,
  });
  if (!observation) return;

  await visionStore.putObservation(observation);
  await visionStore.updateSessionAnalyzedAt(session.incidentId, session.sessionId, session.agencyId);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: session.agencyId,
    incidentId: session.incidentId,
    actorId: "system:ai-writer",
    type: AUDIT_EVENT_TYPES.VISION_OBSERVATION_CREATED,
    details: { sessionId: session.sessionId, observationId: observation.observationId },
    createdAt: new Date().toISOString(),
    resourceType: "incident",
    resourceId: observation.observationId,
  });
}

async function callClaudeVisionStreaming(params: {
  session: VisionSession;
  frameBase64: string;
  context: IncidentContext;
  cameraName: string;
}): Promise<VisionObservation | null> {
  const { session, frameBase64, context, cameraName } = params;
  const observationId = randomUUID();
  const frameTimestamp = new Date().toISOString();

  await pushVisionEvent(session.agencyId, {
    type: "rapid-vision.observation.streaming.start",
    observationId,
    sessionId: session.sessionId,
    incidentId: session.incidentId,
    cameraName,
    timestamp: frameTimestamp,
  });

  let fullText = "";
  let streamError = false;
  try {
    const streamed = await streamClaudeVision({
      frameBase64,
      context,
      cameraName,
      onToken: async (token) => {
        await pushVisionEvent(session.agencyId, {
          type: "rapid-vision.observation.streaming.token",
          observationId,
          sessionId: session.sessionId,
          incidentId: session.incidentId,
          token,
        });
      },
    });
    fullText = streamed ?? "";
  } catch (err) {
    streamError = true;
    console.error(
      JSON.stringify({
        msg: "vision_claude_stream_failed",
        sessionId: session.sessionId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  if (!fullText || fullText.length < 10 || streamError) {
    await pushVisionEvent(session.agencyId, {
      type: "rapid-vision.observation.streaming.abort",
      observationId,
      sessionId: session.sessionId,
      incidentId: session.incidentId,
    });
    return null;
  }

  const parsed = parseClaudeVisionResponse(fullText);
  const hasCorrelation =
    Boolean(context.latestTranscriptExcerpt) &&
    parsed.confidence !== "LOW" &&
    detectTranscriptCorrelation(fullText, context.latestTranscriptExcerpt ?? "");

  const observation: VisionObservation = {
    observationId,
    incidentId: session.incidentId,
    agencyId: session.agencyId,
    sessionId: session.sessionId,
    cameraId: session.cameraId,
    provider: session.provider,
    timestamp: frameTimestamp,
    writtenAt: new Date().toISOString(),
    source: session.provider === "demo" ? "demo" : "claude_vision",
    category: parsed.category,
    narrative: `${cameraName}: ${parsed.narrative}`,
    confidence: parsed.confidence,
    correlatedEvidenceIds: hasCorrelation ? ["transcript:latest"] : [],
    correlationSummary: hasCorrelation ? parsed.correlationNote : undefined,
    verificationStatus: "unverified",
    sharedWithUserIds: [],
    ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
  };

  await pushVisionEvent(session.agencyId, {
    type: "rapid-vision.observation.streaming.complete",
    observationId,
    sessionId: session.sessionId,
    incidentId: session.incidentId,
    observation,
  });

  return observation;
}

async function extractLatestFrame(streamNameOrArn: string): Promise<string | null> {
  if (env.visionAiMock) return Buffer.from("mock-frame").toString("base64");

  const endpoint = await kv.send(
    new GetDataEndpointCommand({
      StreamName: streamNameOrArn.startsWith("arn:") ? undefined : streamNameOrArn,
      StreamARN: streamNameOrArn.startsWith("arn:") ? streamNameOrArn : undefined,
      APIName: APIName.GET_HLS_STREAMING_SESSION_URL,
    }),
  );
  if (!endpoint.DataEndpoint) return null;

  const archivedClient = new KinesisVideoArchivedMediaClient({ endpoint: endpoint.DataEndpoint });
  const hlsResult = await archivedClient.send(
    new GetHLSStreamingSessionURLCommand({
      StreamName: streamNameOrArn.startsWith("arn:") ? undefined : streamNameOrArn,
      StreamARN: streamNameOrArn.startsWith("arn:") ? streamNameOrArn : undefined,
      PlaybackMode: "LIVE",
      Expires: 60,
      HLSFragmentSelector: { FragmentSelectorType: "SERVER_TIMESTAMP" },
    }),
  );
  if (!hlsResult.HLSStreamingSessionURL) return null;

  const outputPath = `/tmp/rv-frame-${Date.now()}.jpg`;
  try {
    execSync(
      `/opt/bin/ffmpeg -y -i "${hlsResult.HLSStreamingSessionURL}" -vframes 1 -q:v 3 -vf "scale=1280:-1" ${outputPath} 2>/dev/null`,
      { timeout: 20_000 },
    );
    if (!existsSync(outputPath)) return null;
    return readFileSync(outputPath).toString("base64");
  } finally {
    try {
      if (existsSync(outputPath)) unlinkSync(outputPath);
    } catch {
      /* ignore */
    }
  }
}

async function buildIncidentContext(incidentId: string, agencyId: string): Promise<IncidentContext> {
  const context: IncidentContext = { recentObservationSummaries: [] };
  try {
    const incidentResult = await ddb.send(
      new QueryCommand({
        TableName: process.env.INCIDENTS_TABLE ?? "",
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `AGENCY#${agencyId}#INCIDENT#${incidentId}` },
        Limit: 1,
      }),
    );
    const incident = incidentResult.Items?.[0];
    if (incident) {
      context.incidentType = (incident.type ?? incident.incidentType) as string | undefined;
      context.description = String(incident.description ?? "").slice(0, 300) || undefined;
    }
  } catch {
    /* non-fatal */
  }

  try {
    const transcriptResult = await ddb.send(
      new QueryCommand({
        TableName: process.env.TRANSCRIPTS_TABLE ?? "",
        KeyConditionExpression: "incidentId = :id",
        ExpressionAttributeValues: { ":id": incidentId },
        ScanIndexForward: false,
        Limit: 5,
      }),
    );
    const recent = transcriptResult.Items ?? [];
    if (recent.length > 0) {
      context.latestTranscriptExcerpt = recent
        .map((t) => String(t.text ?? ""))
        .filter(Boolean)
        .join(" ")
        .slice(0, 500);
    }
  } catch {
    /* non-fatal */
  }

  try {
    const prior = await visionStore.listObservations(agencyId, incidentId, 5);
    context.recentObservationSummaries = prior.map((o) => o.narrative.slice(0, 150)).filter(Boolean);
  } catch {
    /* non-fatal */
  }
  return context;
}

async function getCameraName(agencyId: string, cameraId: string): Promise<string> {
  const camera = await visionStore.getCamera(agencyId, cameraId);
  return camera?.friendlyName ?? `Camera ${cameraId.slice(-6)}`;
}

async function generateDemoObservation(session: VisionSession & { startedAt?: string }): Promise<void> {
  const sessionAgeSeconds =
    (Date.now() - new Date(session.startedAt ?? Date.now()).getTime()) / 1000;
  const script = DEMO_OBSERVATION_SCRIPT.find(
    (s) => sessionAgeSeconds >= s.delaySeconds && sessionAgeSeconds < s.delaySeconds + THROTTLE_SECONDS,
  );
  if (!script) return;

  const observationId = randomUUID();
  const timestamp = new Date().toISOString();
  await pushVisionEvent(session.agencyId, {
    type: "rapid-vision.observation.streaming.start",
    observationId,
    sessionId: session.sessionId,
    incidentId: session.incidentId,
    cameraName: "Demo Camera",
    timestamp,
  });

  const words = script.narrative.split(/(\s+)/);
  for (const token of words) {
    if (!token) continue;
    await pushVisionEvent(session.agencyId, {
      type: "rapid-vision.observation.streaming.token",
      observationId,
      sessionId: session.sessionId,
      incidentId: session.incidentId,
      token,
    });
  }

  const obs: VisionObservation = {
    observationId,
    incidentId: session.incidentId,
    agencyId: session.agencyId,
    sessionId: session.sessionId,
    cameraId: session.cameraId,
    provider: "demo",
    timestamp,
    writtenAt: new Date().toISOString(),
    source: "demo",
    category: script.category,
    narrative: script.narrative,
    confidence: script.confidence,
    correlatedEvidenceIds: script.correlationSummary ? ["demo:transcript"] : [],
    correlationSummary: script.correlationSummary,
    verificationStatus: "unverified",
    sharedWithUserIds: [],
    ttl: Math.floor(Date.now() / 1000) + 3600,
  };
  await visionStore.putObservation(obs);
  await visionStore.updateSessionAnalyzedAt(session.incidentId, session.sessionId, session.agencyId);
  await pushVisionEvent(session.agencyId, {
    type: "rapid-vision.observation.streaming.complete",
    observationId,
    sessionId: session.sessionId,
    incidentId: session.incidentId,
    observation: obs,
  });
}
