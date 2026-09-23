import type { ScheduledHandler } from "aws-lambda";
import {
  ensTestKindsDue,
  resolveAgencyVerticalFromTenant,
  type AlertVertical,
} from "rapid-cortex-shared";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { env } from "../../lib/env.js";
import { executeEnsTest } from "../../alerts/ens-service.js";
import { alertsStore } from "../../alerts/store.js";
import { ensureDefaultOrganization, ensureSystemCatalog } from "../../alerts/service.js";

const agencies = new AgencyRepository();

export const handler: ScheduledHandler = async () => {
  if (!env.enableVerticalAlerts || !env.enableEnsTestProgram || !env.verticalAlertsTable) {
    return;
  }
  const nowIso = new Date().toISOString();
  const agencyIds = await agencies.listAgencyIds();
  for (const agencyId of agencyIds) {
    try {
      const agency = await agencies.get(agencyId);
      if (!agency) continue;
      const resolved = resolveAgencyVerticalFromTenant(agency);
      if (resolved !== "campus" && resolved !== "venue") continue;
      const vertical: AlertVertical = resolved;
      const program = await alertsStore.getEnsProgram(agencyId, vertical);
      if (!program) continue;
      const due = ensTestKindsDue(program, nowIso);
      if (due.length === 0) continue;
      const org = await ensureDefaultOrganization(agencyId, vertical, agency?.name ?? agencyId);
      await ensureSystemCatalog(agencyId, vertical, org);
      for (const kind of due) {
        try {
          await executeEnsTest({
            agencyId,
            actorId: "system:ens-scheduler",
            displayName: program.institutionName || agency?.name || agencyId,
            vertical,
            kind,
            scheduled: true,
            canCritical: true,
          });
        } catch (err) {
          console.error(
            JSON.stringify({
              msg: "ENS scheduled test failed",
              agencyId,
              kind,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ENS scheduler agency pass failed",
          agencyId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
};
