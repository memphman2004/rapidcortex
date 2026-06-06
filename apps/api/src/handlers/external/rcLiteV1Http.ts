/**
 * RC Lite programmatic API (`/v1/*`) — `rclite_*` API keys (hashed in Dynamo), separate from `/api/v1` OAuth tokens.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { dispatchRcLiteV1 } from "../../services/rcLiteV1Dispatcher.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => dispatchRcLiteV1(event);
