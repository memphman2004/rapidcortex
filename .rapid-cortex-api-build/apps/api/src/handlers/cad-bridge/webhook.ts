import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handleCadBridgeWebhook } from "../../cad-bridge/webhook.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => handleCadBridgeWebhook(event);
