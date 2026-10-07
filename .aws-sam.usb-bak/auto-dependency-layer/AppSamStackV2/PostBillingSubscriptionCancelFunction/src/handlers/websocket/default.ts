import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log("WebSocket default handler:", {
    connectionId: event.requestContext.connectionId,
    routeKey: event.requestContext.routeKey,
  });
  return { statusCode: 200, body: JSON.stringify({ message: "Default route" }) };
};
