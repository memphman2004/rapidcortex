import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  canActivateSilentPanic,
  isSilentPanicCampus,
  resolveCampusInstitutionTypeFromConfig,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import {
  createCampusIncident,
  finalizeCampusIntakeIncident,
} from "../campus-incident-service.js";
import { createIncidentSchema } from "../campus-schemas.js";

const authz = new AuthorizationService();
const agencies = new AgencyRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);
    authz.assertCanPerform(user, "campus.incidents.create" as never);

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const parsed = createIncidentSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    if (parsed.data.silentPanic) {
      if (!canActivateSilentPanic(user.role)) {
        return withCorrelationHeaders(
          event,
          forbidden("Silent panic is limited to campus admin, security, and dispatch."),
        );
      }
      const agency = await agencies.get(user.agencyId);
      const campusCfg = (
        agency as { config?: { campus?: Record<string, unknown> } } | null
      )?.config?.campus;
      const agencyInstitution = resolveCampusInstitutionTypeFromConfig({
        institutionType:
          (agency as { institutionType?: unknown } | null)?.institutionType ??
          campusCfg?.institutionType,
        campusType: campusCfg?.campusType,
      });
      if (!agency || !isSilentPanicCampus(user.role, agencyInstitution)) {
        return withCorrelationHeaders(
          event,
          forbidden("Silent panic is available on K-12 campuses only."),
        );
      }
    }

    const created = await createCampusIncident(parsed.data, user.agencyId, user.userId);
    const { incident, cameras } = await finalizeCampusIntakeIncident(user.agencyId, created);
    return withCorrelationHeaders(event, ok({ incident, cameras }, 201));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incident-post]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
