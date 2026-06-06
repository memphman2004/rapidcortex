import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.live_video");
    if (!authz.canDispatch(user) && user.role !== "rcadmin" && user.role !== "rcsuperadmin") {
      return forbidden("Role cannot view stream session");
    }

    const sessionId = event.pathParameters?.sessionId?.trim();
    if (!sessionId) return notFound("Missing session id");
    const tableName = process.env.CONNECT_SESSIONS_TABLE?.trim();
    if (!tableName) return serverError("CONNECT_SESSIONS_TABLE is not configured");

    const result = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: `SESSION#${sessionId}`, sk: "PROFILE" },
      }),
    );
    if (!result.Item) return notFound("Session not found");
    if ((result.Item as { agencyId?: string }).agencyId !== user.agencyId) return forbidden();

    return ok({
      sessionId,
      status: (result.Item as { status?: string }).status ?? "UNKNOWN",
      kvsChannelName: (result.Item as { kvsChannelName?: string }).kvsChannelName ?? null,
      ecsTaskArn: (result.Item as { ecsTaskArn?: string }).ecsTaskArn ?? null,
      streamStartedAt: (result.Item as { streamStartedAt?: string }).streamStartedAt ?? null,
      streamEndedAt: (result.Item as { streamEndedAt?: string }).streamEndedAt ?? null,
      lastHealthCheckAt: (result.Item as { lastHealthCheckAt?: string }).lastHealthCheckAt ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "FORBIDDEN_PERMISSION") return forbidden();
    console.error(JSON.stringify({ msg: "stream_session_status_error", error: msg }));
    return serverError("Unable to fetch stream session status");
  }
};
