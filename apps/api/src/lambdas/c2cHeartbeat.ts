import type { ScheduledHandler } from "aws-lambda";
import { getC2cRuntime, listC2cTenantAgencyIds } from "../c2c/runtime.js";

export const handler: ScheduledHandler = async () => {
  const tenants = await listC2cTenantAgencyIds();
  for (const agencyId of tenants) {
    try {
      const runtime = await getC2cRuntime(agencyId);
      await runtime.health.pollOnce();
    } catch (error) {
      console.warn(
        JSON.stringify({
          type: "c2c.heartbeat.poll_error",
          agencyId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
};
