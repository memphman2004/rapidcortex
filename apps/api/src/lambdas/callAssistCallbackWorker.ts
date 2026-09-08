import type { Handler } from "aws-lambda";
import { processDueCallbacksAllAgencies } from "../call-assist/callback-campaign.js";

export const handler: Handler = async () => {
  const out = await processDueCallbacksAllAgencies();
  console.log(JSON.stringify({ type: "call_assist.callback.worker", ...out }));
  return out;
};
