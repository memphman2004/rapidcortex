import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handleC2cWebhook } from "../../c2c/webhook.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => handleC2cWebhook(event);
