import type { SQSHandler } from "aws-lambda";
import { handleCadBridgeSqsEvent } from "../cad-bridge/event-router.js";

export const handler: SQSHandler = async (event) => {
  await handleCadBridgeSqsEvent(event);
};
