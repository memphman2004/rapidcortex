/**
 * Catch-all ANY /api/features/{proxy+}
 * getUserContext → AuthorizationService → feature-suite services
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  authFailure,
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { FEATURE_PERMISSIONS, type FeaturePermission } from "../../feature-suite/authz.js";
import { FeatureError, type FeatureActor } from "../../feature-suite/errors.js";
import { isFeaturesSuiteEnabled } from "../../feature-suite/tables.js";
import {
  matchFeaturesHttpRoute,
  type FeaturesHttpHandlerName,
} from "../../feature-suite/http-dispatch.js";
import * as citizens from "../../feature-suite/citizen-intelligence.js";
import * as routing from "../../feature-suite/response-routing.js";
import * as command from "../../feature-suite/command-call-enhancement.js";
import * as training from "../../feature-suite/training-predictive-safety.js";
import {
  configureAgencySso,
  deleteAgencySso,
  describeAgencySso,
} from "../agency-sso.js";

const authz = new AuthorizationService();

/** SSO uses role helpers inside agency-sso (agencyadmin / rcadmin / rcsuperadmin). */
const SSO_HANDLERS = new Set<FeaturesHttpHandlerName>([
  "describeAgencySso",
  "configureAgencySso",
  "deleteAgencySso",
]);

const PERMS: Record<Exclude<FeaturesHttpHandlerName, "describeAgencySso" | "configureAgencySso" | "deleteAgencySso">, FeaturePermission> = {
  registerCitizen: FEATURE_PERMISSIONS.citizensManage,
  lookupCitizen: FEATURE_PERMISSIONS.citizensView,
  updateCitizen: FEATURE_PERMISSIONS.citizensManage,
  deleteCitizen: FEATURE_PERMISSIONS.citizensManage,
  getAddressIntelligence: FEATURE_PERMISSIONS.addressIntelView,
  addAddressHazard: FEATURE_PERMISSIONS.addressIntelManage,
  upsertPrePlan: FEATURE_PERMISSIONS.addressIntelManage,
  floorPlanUpload: FEATURE_PERMISSIONS.addressIntelManage,
  evaluateAltResponse: FEATURE_PERMISSIONS.altResponseView,
  altResponseDecision: FEATURE_PERMISSIONS.altResponseDecide,
  altResponseOutcome: FEATURE_PERMISSIONS.altResponseDecide,
  listCoResponders: FEATURE_PERMISSIONS.altResponseView,
  createMutualAid: FEATURE_PERMISSIONS.mutualAidManage,
  listMutualAid: FEATURE_PERMISSIONS.mutualAidView,
  commitMutualAid: FEATURE_PERMISSIONS.mutualAidManage,
  updateCommitment: FEATURE_PERMISSIONS.mutualAidManage,
  activateMci: FEATURE_PERMISSIONS.mciManage,
  getMci: FEATURE_PERMISSIONS.mciView,
  addMciPatient: FEATURE_PERMISSIONS.mciManage,
  updateHospitalBoard: FEATURE_PERMISSIONS.mciManage,
  transportPatient: FEATURE_PERMISSIONS.mciManage,
  listInfra: FEATURE_PERMISSIONS.infraView,
  upsertInfra: FEATURE_PERMISSIONS.infraManage,
  upsertProtocol: FEATURE_PERMISSIONS.infraManage,
  requestInterpreter: FEATURE_PERMISSIONS.interpreterManage,
  updateInterpreter: FEATURE_PERMISSIONS.interpreterManage,
  listInterpreter: FEATURE_PERMISSIONS.interpreterView,
  createEvidence: FEATURE_PERMISSIONS.evidenceManage,
  listEvidence: FEATURE_PERMISSIONS.evidenceView,
  holdEvidence: FEATURE_PERMISSIONS.evidenceManage,
  downloadEvidence: FEATURE_PERMISSIONS.evidenceView,
  publicRecords: FEATURE_PERMISSIONS.evidenceManage,
  createAssessment: FEATURE_PERMISSIONS.assessmentManage,
  submitAssessmentResult: FEATURE_PERMISSIONS.assessmentManage,
  listAssessments: FEATURE_PERMISSIONS.assessmentView,
  getLearningPatterns: FEATURE_PERMISSIONS.learningView,
  createEvent: FEATURE_PERMISSIONS.surgeManage,
  listEvents: FEATURE_PERMISSIONS.surgeView,
  startCheckIn: FEATURE_PERMISSIONS.checkinManage,
  checkInUnit: FEATURE_PERMISSIONS.checkinManage,
  cancelCheckIn: FEATURE_PERMISSIONS.checkinManage,
  triggerPanic: FEATURE_PERMISSIONS.checkinManage,
  listActiveCheckIns: FEATURE_PERMISSIONS.checkinView,
  ingestSocial: FEATURE_PERMISSIONS.socialManage,
  listSocial: FEATURE_PERMISSIONS.socialView,
  reviewSocial: FEATURE_PERMISSIONS.socialManage,
};

function parseBody(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new FeatureError(400, "Invalid JSON");
  }
}

async function dispatch(
  handler: FeaturesHttpHandlerName,
  actor: FeatureActor,
  params: Record<string, string>,
  query: Record<string, string | undefined>,
  body: unknown,
): Promise<unknown> {
  switch (handler) {
    case "registerCitizen":
      return citizens.registerCitizen(actor, body);
    case "lookupCitizen":
      return citizens.lookupCitizen(actor, {
        phone: query.phone,
        address: query.address,
      });
    case "updateCitizen":
      return citizens.updateCitizenProfile(actor, params.profileId!, body);
    case "deleteCitizen":
      return citizens.deleteCitizenProfile(actor, params.profileId!);
    case "getAddressIntelligence":
      return citizens.getAddressIntelligence(actor, params.normalized!, {
        lat: query.lat ? Number(query.lat) : undefined,
        lon: query.lon ? Number(query.lon) : undefined,
      });
    case "addAddressHazard":
      return citizens.addAddressHazard(actor, params.normalized!, body);
    case "upsertPrePlan":
      return citizens.upsertPrePlan(actor, params.normalized!, body);
    case "floorPlanUpload":
      return citizens.getFloorPlanUploadUrl(actor, params.normalized!, body);
    case "evaluateAltResponse":
      return routing.evaluateAlternativeResponseForHttp(actor, body);
    case "altResponseDecision":
      return routing.recordSupervisorDecision(actor, params.incidentId!, body);
    case "altResponseOutcome":
      return routing.recordAlternativeOutcome(actor, params.incidentId!, body);
    case "listCoResponders":
      return routing.listCoResponders(actor);
    case "createMutualAid":
      return routing.createMutualAidRequest(actor, body);
    case "listMutualAid":
      return routing.listMutualAidRequests(actor);
    case "commitMutualAid":
      return routing.commitResources(actor, params.requestId!, body);
    case "updateCommitment":
      return routing.updateCommitmentStatus(
        actor,
        params.requestId!,
        params.commitmentId!,
        body,
      );
    case "activateMci":
      return command.activateMCI(actor, body);
    case "getMci":
      return command.getMCIStatus(actor, params.mciId!);
    case "addMciPatient":
      return command.addTriagePatient(actor, params.mciId!, body);
    case "updateHospitalBoard":
      return command.updateHospitalBoard(actor, params.mciId!, body);
    case "transportPatient":
      return command.updatePatientTransport(
        actor,
        params.mciId!,
        params.patientId!,
        body,
      );
    case "listInfra":
      return command.listInfrastructure(actor, query.type);
    case "upsertInfra":
      return command.upsertInfrastructure(actor, params.infraId, body);
    case "upsertProtocol":
      return command.upsertProtocol(actor, params.infraId!, params.protocolId, body);
    case "requestInterpreter":
      return command.requestInterpreter(actor, body);
    case "updateInterpreter":
      return command.updateInterpreterStatus(actor, params.requestId!, body);
    case "listInterpreter":
      return command.listInterpreterRequests(actor);
    case "createEvidence":
      return command.createEvidenceForHttp(actor, body);
    case "listEvidence": {
      if (!query.incidentId) throw new FeatureError(400, "incidentId query parameter required");
      return command.listEvidenceForIncident(actor, query.incidentId);
    }
    case "holdEvidence":
      return command.placeEvidenceHold(actor, params.id!, body);
    case "downloadEvidence":
      return command.downloadEvidence(actor, params.id!);
    case "publicRecords":
      return command.createPublicRecordsRequest(actor, params.id!, body);
    case "createAssessment":
      return training.createAssessmentSession(actor, body);
    case "submitAssessmentResult":
      return training.submitScenarioResult(actor, params.id!, body);
    case "listAssessments":
      return training.listAssessmentSessions(actor);
    case "getLearningPatterns":
      return training.getLearningPatterns(actor);
    case "createEvent":
      return training.createPublicEvent(actor, body);
    case "listEvents":
      return training.listUpcomingEvents(actor);
    case "startCheckIn":
      return training.startCheckInTimer(actor, body);
    case "checkInUnit":
      return training.checkInUnit(actor, params.id!);
    case "cancelCheckIn":
      return training.cancelCheckInTimer(actor, params.id!);
    case "triggerPanic":
      return training.triggerPanicAlert(actor, body);
    case "listActiveCheckIns":
      return training.listActiveTimers(actor);
    case "ingestSocial":
      return training.ingestSocialSignalForHttp(actor, body);
    case "listSocial":
      return training.listSocialSignals(actor, query.urgency);
    case "reviewSocial":
      return training.reviewSocialSignal(actor, params.id!, body);
    case "describeAgencySso":
      return describeAgencySso(actor);
    case "configureAgencySso":
      return configureAgencySso(actor, body);
    case "deleteAgencySso":
      return deleteAgencySso(actor);
    default:
      throw new FeatureError(404, "Route not found");
  }
}

const CREATED_HANDLERS = new Set<FeaturesHttpHandlerName>([
  "registerCitizen",
  "addAddressHazard",
  "createMutualAid",
  "activateMci",
  "addMciPatient",
  "requestInterpreter",
  "createEvidence",
  "publicRecords",
  "createAssessment",
  "createEvent",
  "startCheckIn",
  "triggerPanic",
]);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!isFeaturesSuiteEnabled()) {
      return withCorrelationHeaders(event, notFound("Features suite disabled"));
    }

    const method = (event.requestContext?.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext?.http?.path ?? "";
    const matched = matchFeaturesHttpRoute(method, path);
    if (!matched) {
      return withCorrelationHeaders(event, notFound("Features route not found"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, authFailure(event));
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    if (!user.agencyId) {
      return withCorrelationHeaders(event, forbidden("agencyId required"));
    }

    const perm = SSO_HANDLERS.has(matched.handler)
      ? null
      : PERMS[matched.handler as keyof typeof PERMS];
    if (perm && !authz.canPerform(user, perm)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const actor: FeatureActor = {
      userId: user.userId,
      agencyId: user.agencyId,
      role: user.role,
      displayName: (user as { displayName?: string }).displayName,
    };

    const query = (event.queryStringParameters ?? {}) as Record<string, string | undefined>;
    const body = method === "GET" || method === "DELETE" ? {} : parseBody(event.body);
    const result = await dispatch(matched.handler, actor, matched.pathParameters, query, body);
    const status = CREATED_HANDLERS.has(matched.handler) ? 201 : 200;
    return withCorrelationHeaders(event, ok(result, status));
  } catch (error) {
    if (error instanceof FeatureError) {
      if (error.statusCode === 400) {
        return withCorrelationHeaders(event, badRequest(error.message));
      }
      if (error.statusCode === 403) {
        return withCorrelationHeaders(event, forbidden(error.message));
      }
      if (error.statusCode === 404) {
        return withCorrelationHeaders(event, notFound(error.message));
      }
      if (error.statusCode === 409) {
        return withCorrelationHeaders(event, conflict(error.message));
      }
      if (error.statusCode === 503) {
        return withCorrelationHeaders(event, {
          statusCode: 503,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: error.message }),
        });
      }
    }
    console.error("[features/http]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
