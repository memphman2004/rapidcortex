import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { streamViewerTokenRequestSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { KvsChannelService } from "../kvs-channel-service.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const kvs = new KvsChannelService();
const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

type StreamProduct = "connect" | "venue";

type CameraSessionRecord = {
  agencyId?: string;
  status?: string;
  kvsChannelName?: string;
  incidentId?: string;
};

function sessionTableForProduct(product: StreamProduct): string | undefined {
  if (product === "connect") {
    return process.env.CONNECT_SESSIONS_TABLE?.trim();
  }
  return (
    process.env.VENUE_CAMERA_SESSIONS_TABLE?.trim() || process.env.CONNECT_SESSIONS_TABLE?.trim()
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    authz.assertCanPerform(user, "workspace.live_video");
    if (!authz.canDispatch(user) && user.role !== "rcadmin" && user.role !== "rcsuperadmin") {
      return withCorrelationHeaders(event, forbidden("Role cannot issue stream viewer tokens"));
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    const parsed = streamViewerTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("sessionId and product are required"));
    }

    const { sessionId, product } = parsed.data;
    const tableName = sessionTableForProduct(product);
    if (!tableName) {
      return withCorrelationHeaders(
        event,
        serverError(
          product === "venue"
            ? "VENUE_CAMERA_SESSIONS_TABLE is not configured"
            : "CONNECT_SESSIONS_TABLE is not configured",
        ),
      );
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: `SESSION#${sessionId}`, sk: "PROFILE" },
      }),
    );

    if (!result.Item) {
      return withCorrelationHeaders(event, notFound("Session not found"));
    }

    const session = result.Item as CameraSessionRecord;
    if (!session.agencyId || session.agencyId !== user.agencyId) {
      return withCorrelationHeaders(event, forbidden());
    }
    if (session.status !== "ACTIVE") {
      return withCorrelationHeaders(
        event,
        conflict(`Session is ${session.status ?? "UNKNOWN"} - cannot issue token`),
      );
    }
    if (!session.kvsChannelName) {
      return withCorrelationHeaders(
        event,
        conflict("Stream bridge not yet ready - retry in a few seconds"),
      );
    }

    const token = await kvs.issueViewerToken(session.kvsChannelName);
    const viewedAt = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: `SESSION#${sessionId}`, sk: "PROFILE" },
        UpdateExpression: "SET lastViewerTokenAt = :t, lastViewedBy = :u",
        ExpressionAttributeValues: {
          ":t": viewedAt,
          ":u": user.userId,
        },
      }),
    );

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: typeof session.incidentId === "string" ? session.incidentId : undefined,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_VIEWER,
      details: { sessionId, product },
      createdAt: viewedAt,
      resourceType: product === "venue" ? "venue_camera_session" : "session",
      resourceId: sessionId,
    });

    return withCorrelationHeaders(
      event,
      ok({
        sessionId,
        kvsChannelName: token.channelName,
        channelArn: token.channelArn,
        region: token.region,
        credentials: token.credentials,
        wssEndpoint: token.wssEndpoint,
        iceServers: token.iceServers,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error(JSON.stringify({ msg: "stream_viewer_token_error", error: msg }));
    return withCorrelationHeaders(event, serverError("Unable to issue stream viewer token"));
  }
};
