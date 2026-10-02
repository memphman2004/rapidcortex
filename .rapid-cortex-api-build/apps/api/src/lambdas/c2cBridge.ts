import type { Handler, ScheduledEvent, ScheduledHandler, SQSEvent, SQSHandler } from "aws-lambda";
import { AdapterDisabledError } from "../c2c/cad-adapters/http-client.js";
import { getC2cRuntime, listC2cTenantAgencyIds } from "../c2c/runtime.js";
import { validateEido } from "../c2c/eido/validator.js";

export const poller: ScheduledHandler = async () => {
  const tenants = await listC2cTenantAgencyIds();
  for (const tenantAgencyId of tenants) {
    const runtime = await getC2cRuntime(tenantAgencyId);
    for (const adapter of runtime.adapters.getAll()) {
      try {
        const { incidents } = await adapter.getActiveIncidents({ limit: 25 });
        for (const eido of incidents) {
          const valid = validateEido(eido);
          if (valid.ok) await runtime.router.routeNewIncident(valid.value);
        }
        const positions = await adapter.getAVLPositions();
        for (const pos of positions) {
          await runtime.avl.upsert({
            unitId: pos.unitId,
            agencyId: pos.agencyId,
            latitude: pos.latitude,
            longitude: pos.longitude,
            heading: pos.heading,
            speedMph: pos.speedMph,
            timestamp: pos.timestamp,
            status: pos.status ?? "AVAILABLE",
            unitType: "UNIT",
          });
        }
      } catch (error) {
        if (error instanceof AdapterDisabledError) continue;
        console.warn(
          JSON.stringify({
            type: "c2c.bridge.poll_error",
            agencyId: adapter.agencyId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }
};

export const inbound: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const payload = JSON.parse(record.body) as {
        eido?: unknown;
        targetAgencyId?: string;
        tenantAgencyId?: string;
      };
      const tenantAgencyId = payload.tenantAgencyId || payload.targetAgencyId?.split(":")[0] || "";
      if (!tenantAgencyId) continue;
      const runtime = await getC2cRuntime(tenantAgencyId);
      const valid = validateEido(payload.eido);
      if (!valid.ok) continue;
      const adapter = payload.targetAgencyId ? runtime.adapters.get(payload.targetAgencyId) : undefined;
      if (!adapter) continue;
      await adapter.createIncident({ eido: valid.value, autoDispatch: false });
    } catch (error) {
      if (error instanceof AdapterDisabledError) continue;
      console.warn(
        JSON.stringify({
          type: "c2c.bridge.inbound_error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
};

export const handler: Handler<ScheduledEvent | SQSEvent> = async (event, context) => {
  if ("Records" in event) {
    return inbound(event, context, () => undefined);
  }
  return poller(event, context, () => undefined);
};
