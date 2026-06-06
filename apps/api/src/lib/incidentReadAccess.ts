import type { Incident, UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { IncidentShareRepository } from "../repositories/incidentShareRepository.js";
import { env } from "./env.js";

const incidentRepo = new IncidentRepository();
const shareRepo = new IncidentShareRepository();

export type IncidentReadResolution = {
  incident: Incident;
  kind: "owner" | "shared";
};

export async function resolveIncidentRead(
  incidentId: string,
  user: UserContext,
): Promise<IncidentReadResolution | null> {
  const incident = await incidentRepo.get(incidentId);
  if (!incident) return null;
  if (isRcsuperadmin(user)) return { incident, kind: "owner" };
  if (incident.agencyId === user.agencyId) return { incident, kind: "owner" };
  if (!env.enableCrossJurisdictionShares || !env.incidentSharesTable) return null;
  const share = await shareRepo.findActiveForRecipient(incidentId, user.agencyId);
  if (!share) return null;
  return { incident, kind: "shared" };
}
