/**
 * External / RC Lite programmatic API (`/api/v1/*`).
 * TODO: RC Lite could move to dedicated `rc-lite-api.<domain>` later (separate ACM + usage plans).
 * For now deployment stays intentionally simple behind the primary HttpApi routes.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { dispatchExternalApiV1 } from "../../services/externalV1Dispatcher.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => dispatchExternalApiV1(event);
