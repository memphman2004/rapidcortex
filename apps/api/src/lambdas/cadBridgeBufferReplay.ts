import type { ScheduledHandler } from "aws-lambda";
import { replayBufferedCadBridgeEvents } from "../cad-bridge/buffer-replay.js";

export const handler: ScheduledHandler = async () => {
  await replayBufferedCadBridgeEvents();
};
