import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createWarRoomBodySchema,
  listWarRoomsQuerySchema,
  postWarRoomMessageBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { WarRoomService } from "../services/warRoomService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new WarRoomService();
const auth = new AuthorizationService();
const requireCommandAddon = requireAddon("incident_command.");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "WAR_ROOMS_DISABLED") return serviceUnavailable("War rooms are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "ROOM_CLOSED") return badRequest("War room is closed");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireCommandAddon(event, user);
    if (addonGate) return addonGate;

    const routeKey = event.routeKey ?? "";
    const roomId = event.pathParameters?.roomId;
    const messageId = event.pathParameters?.messageId;

    if (routeKey === "POST /api/war-rooms") {
      auth.assertCanPerform(user, "command.war_room_create");
      const parsed = createWarRoomBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.create(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/war-rooms") {
      auth.assertCanPerform(user, "command.war_room_join");
      const q = listWarRoomsQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      return ok(await service.list(user, q.data.incidentId));
    }

    if (routeKey === "GET /api/war-rooms/{roomId}") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId) return notFound();
      return ok(await service.get(user, roomId));
    }

    if (routeKey === "POST /api/war-rooms/{roomId}/join") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId) return notFound();
      return ok(await service.join(user, roomId));
    }

    if (routeKey === "POST /api/war-rooms/{roomId}/leave") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId) return notFound();
      return ok(await service.leave(user, roomId));
    }

    if (routeKey === "POST /api/war-rooms/{roomId}/messages") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId) return notFound();
      const parsed = postWarRoomMessageBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const msg = await service.postMessage(user, roomId, parsed.data);
      return ok(msg, 201);
    }

    if (routeKey === "GET /api/war-rooms/{roomId}/messages") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId) return notFound();
      return ok(await service.listMessages(user, roomId));
    }

    if (routeKey === "PATCH /api/war-rooms/{roomId}/messages/{messageId}/pin") {
      auth.assertCanPerform(user, "command.war_room_join");
      if (!roomId || !messageId) return notFound();
      return ok(await service.pinMessage(user, roomId, messageId));
    }

    if (routeKey === "POST /api/war-rooms/{roomId}/close") {
      auth.assertCanPerform(user, "command.war_room_create");
      if (!roomId) return notFound();
      return ok(await service.close(user, roomId));
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
