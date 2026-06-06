import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { venueCameraRequestBodySchema } from "rapid-cortex-shared";
import {
  AccessDeniedError,
  IncidentClosedError,
  NotFoundError,
} from "../../connect/connect-access-guard.js";
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
import type { VenueCamera, VenueFacility } from "../venue-types.js";
import { venueCameraToConnectSource } from "../venue-mapper.js";
import { assertVenueIncidentActive, resolveVenueStreamForSource } from "./venue-camera-routing.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function requiredTable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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
    authz.assertCanPerform(user, "incidents.view");

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    const parsed = venueCameraRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("incidentId, facilityId, and cameraId are required"));
    }

    const { incidentId, facilityId, cameraId } = parsed.data;

    try {
      await assertVenueIncidentActive(incidentId, user.agencyId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return withCorrelationHeaders(event, notFound(err.message));
      }
      if (err instanceof AccessDeniedError) {
        return withCorrelationHeaders(event, forbidden(err.message));
      }
      if (err instanceof IncidentClosedError) {
        return withCorrelationHeaders(event, conflict(err.message));
      }
      throw err;
    }

    const facilitiesTable = requiredTable("VENUE_FACILITIES_TABLE");
    const accessLogTable = requiredTable("VENUE_CAMERA_ACCESS_LOG_TABLE");
    const sessionsTable =
      process.env.VENUE_CAMERA_SESSIONS_TABLE?.trim() ||
      process.env.CONNECT_SESSIONS_TABLE?.trim() ||
      "";

    if (!sessionsTable) {
      return withCorrelationHeaders(event, serverError("CONNECT_SESSIONS_TABLE is not configured"));
    }

    const facilityResult = await ddb.send(
      new GetCommand({
        TableName: facilitiesTable,
        Key: { pk: `FACILITY#${facilityId}`, sk: "PROFILE" },
      }),
    );
    const facility = facilityResult.Item as VenueFacility | undefined;
    if (!facility || facility.agencyId !== user.agencyId) {
      return withCorrelationHeaders(event, notFound("Facility not found"));
    }
    if (!facility.cameraRoutingEnabled) {
      return withCorrelationHeaders(event, conflict("Camera routing is not enabled for this facility"));
    }

    const cameraResult = await ddb.send(
      new GetCommand({
        TableName: facilitiesTable,
        Key: { pk: `FACILITY#${facilityId}`, sk: `CAMERA#${cameraId}` },
      }),
    );
    const camera = cameraResult.Item as VenueCamera | undefined;
    if (!camera || camera.agencyId !== user.agencyId) {
      return withCorrelationHeaders(event, notFound("Camera not found"));
    }
    if (camera.status === "DISABLED") {
      return withCorrelationHeaders(event, conflict("Camera is disabled"));
    }

    const sessionId = makeId("sess");
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 86_400;

    await ddb.send(
      new PutCommand({
        TableName: sessionsTable,
        Item: {
          pk: `SESSION#${sessionId}`,
          sk: "PROFILE",
          sessionId,
          incidentId,
          sourceId: cameraId,
          agencyId: user.agencyId,
          dispatcherId: user.userId,
          dispatcherName: user.displayName ?? user.email,
          status: "BRIDGE_STARTING",
          accessModel: camera.accessModel,
          requestedAt: now,
          ttl,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );

    const connectSource = venueCameraToConnectSource(camera, facility);
    const stream = await resolveVenueStreamForSource(connectSource, sessionId, incidentId);

    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable,
        Key: { pk: `SESSION#${sessionId}`, sk: "PROFILE" },
        UpdateExpression:
          "SET #st = :active, kvsChannelName = :kvs, ecsTaskArn = :ecs, streamStartedAt = :t",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":active": "ACTIVE",
          ":kvs": stream.kvsChannelName,
          ":ecs": stream.ecsTaskArn ?? null,
          ":t": now,
        },
      }),
    );

    await ddb.send(
      new PutCommand({
        TableName: accessLogTable,
        Item: {
          pk: `FACILITY#${facilityId}`,
          sk: `ACCESS#${now}#${sessionId}`,
          sessionId,
          incidentId,
          facilityId,
          facilityName: facility.name,
          cameraId,
          cameraLabel: camera.label,
          agencyId: user.agencyId,
          requestedBy: user.userId,
          requestedByName: user.displayName ?? user.email,
          accessModel: camera.accessModel,
          status: "ACTIVE",
          startedAt: now,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VENUE_CAMERA_SESSION_STARTED,
      details: {
        sessionId,
        facilityId,
        cameraId,
        kvsChannelName: stream.kvsChannelName,
      },
      createdAt: now,
      resourceType: "venue_camera_session",
      resourceId: sessionId,
    });

    return withCorrelationHeaders(
      event,
      ok(
        {
          sessionId,
          incidentId,
          facilityId,
          cameraId,
          kvsChannelName: stream.kvsChannelName,
          status: "ACTIVE",
        },
        201,
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-camera-request]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
