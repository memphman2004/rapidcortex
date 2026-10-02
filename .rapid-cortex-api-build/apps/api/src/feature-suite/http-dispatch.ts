/**
 * Map HTTP method + path under /api/features/* to a handler name + path params.
 */

export type FeaturesHttpHandlerName =
  | "registerCitizen"
  | "lookupCitizen"
  | "updateCitizen"
  | "deleteCitizen"
  | "getAddressIntelligence"
  | "addAddressHazard"
  | "upsertPrePlan"
  | "floorPlanUpload"
  | "evaluateAltResponse"
  | "altResponseDecision"
  | "altResponseOutcome"
  | "listCoResponders"
  | "createMutualAid"
  | "listMutualAid"
  | "commitMutualAid"
  | "updateCommitment"
  | "activateMci"
  | "getMci"
  | "addMciPatient"
  | "updateHospitalBoard"
  | "transportPatient"
  | "listInfra"
  | "upsertInfra"
  | "upsertProtocol"
  | "requestInterpreter"
  | "updateInterpreter"
  | "listInterpreter"
  | "createEvidence"
  | "listEvidence"
  | "holdEvidence"
  | "downloadEvidence"
  | "publicRecords"
  | "createAssessment"
  | "submitAssessmentResult"
  | "listAssessments"
  | "getLearningPatterns"
  | "createEvent"
  | "listEvents"
  | "startCheckIn"
  | "checkInUnit"
  | "cancelCheckIn"
  | "triggerPanic"
  | "listActiveCheckIns"
  | "ingestSocial"
  | "listSocial"
  | "reviewSocial"
  | "describeAgencySso"
  | "configureAgencySso"
  | "deleteAgencySso";

export type FeaturesHttpTarget = {
  handler: FeaturesHttpHandlerName;
  pathParameters: Record<string, string>;
};

const SEG = "([^/]+)";

type Route = {
  method: string;
  pattern: RegExp;
  handler: FeaturesHttpHandlerName;
  params?: string[];
};

const ROUTES: Route[] = [
  { method: "POST", pattern: /^\/api\/features\/citizens\/register\/?$/, handler: "registerCitizen" },
  { method: "GET", pattern: /^\/api\/features\/citizens\/lookup\/?$/, handler: "lookupCitizen" },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/features/citizens/${SEG}/?$`),
    handler: "updateCitizen",
    params: ["profileId"],
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/api/features/citizens/${SEG}/?$`),
    handler: "deleteCitizen",
    params: ["profileId"],
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/features/address/${SEG}/intelligence/?$`),
    handler: "getAddressIntelligence",
    params: ["normalized"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/address/${SEG}/hazard/?$`),
    handler: "addAddressHazard",
    params: ["normalized"],
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/features/address/${SEG}/preplan/?$`),
    handler: "upsertPrePlan",
    params: ["normalized"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/address/${SEG}/preplan/floor-plan/?$`),
    handler: "floorPlanUpload",
    params: ["normalized"],
  },
  {
    method: "POST",
    pattern: /^\/api\/features\/alt-response\/evaluate\/?$/,
    handler: "evaluateAltResponse",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/alt-response/${SEG}/decision/?$`),
    handler: "altResponseDecision",
    params: ["incidentId"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/alt-response/${SEG}/outcome/?$`),
    handler: "altResponseOutcome",
    params: ["incidentId"],
  },
  { method: "GET", pattern: /^\/api\/features\/co-responders\/?$/, handler: "listCoResponders" },
  { method: "POST", pattern: /^\/api\/features\/mutual-aid\/?$/, handler: "createMutualAid" },
  { method: "GET", pattern: /^\/api\/features\/mutual-aid\/?$/, handler: "listMutualAid" },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/mutual-aid/${SEG}/commit/?$`),
    handler: "commitMutualAid",
    params: ["requestId"],
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/api/features/mutual-aid/${SEG}/commitments/${SEG}/?$`),
    handler: "updateCommitment",
    params: ["requestId", "commitmentId"],
  },
  { method: "POST", pattern: /^\/api\/features\/mci\/?$/, handler: "activateMci" },
  {
    method: "GET",
    pattern: new RegExp(`^/api/features/mci/${SEG}/?$`),
    handler: "getMci",
    params: ["mciId"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/mci/${SEG}/patients/?$`),
    handler: "addMciPatient",
    params: ["mciId"],
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/api/features/mci/${SEG}/hospitals/?$`),
    handler: "updateHospitalBoard",
    params: ["mciId"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/mci/${SEG}/patients/${SEG}/transport/?$`),
    handler: "transportPatient",
    params: ["mciId", "patientId"],
  },
  { method: "GET", pattern: /^\/api\/features\/infra\/?$/, handler: "listInfra" },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/features/infra/${SEG}/?$`),
    handler: "upsertInfra",
    params: ["infraId"],
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/features/infra/${SEG}/protocols/${SEG}/?$`),
    handler: "upsertProtocol",
    params: ["infraId", "protocolId"],
  },
  { method: "POST", pattern: /^\/api\/features\/interpreter\/?$/, handler: "requestInterpreter" },
  { method: "GET", pattern: /^\/api\/features\/interpreter\/?$/, handler: "listInterpreter" },
  {
    method: "PATCH",
    pattern: new RegExp(`^/api/features/interpreter/${SEG}/?$`),
    handler: "updateInterpreter",
    params: ["requestId"],
  },
  { method: "POST", pattern: /^\/api\/features\/evidence\/?$/, handler: "createEvidence" },
  { method: "GET", pattern: /^\/api\/features\/evidence\/?$/, handler: "listEvidence" },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/evidence/${SEG}/hold/?$`),
    handler: "holdEvidence",
    params: ["id"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/evidence/${SEG}/download/?$`),
    handler: "downloadEvidence",
    params: ["id"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/evidence/${SEG}/public-records/?$`),
    handler: "publicRecords",
    params: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/api\/features\/assessment\/sessions\/?$/,
    handler: "createAssessment",
  },
  {
    method: "GET",
    pattern: /^\/api\/features\/assessment\/sessions\/?$/,
    handler: "listAssessments",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/assessment/sessions/${SEG}/results/?$`),
    handler: "submitAssessmentResult",
    params: ["id"],
  },
  { method: "GET", pattern: /^\/api\/features\/learning\/patterns\/?$/, handler: "getLearningPatterns" },
  { method: "POST", pattern: /^\/api\/features\/events\/?$/, handler: "createEvent" },
  { method: "GET", pattern: /^\/api\/features\/events\/?$/, handler: "listEvents" },
  { method: "POST", pattern: /^\/api\/features\/checkin\/timers\/?$/, handler: "startCheckIn" },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/checkin/timers/${SEG}/check-in/?$`),
    handler: "checkInUnit",
    params: ["id"],
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/checkin/timers/${SEG}/cancel/?$`),
    handler: "cancelCheckIn",
    params: ["id"],
  },
  { method: "POST", pattern: /^\/api\/features\/checkin\/panic\/?$/, handler: "triggerPanic" },
  { method: "GET", pattern: /^\/api\/features\/checkin\/active\/?$/, handler: "listActiveCheckIns" },
  { method: "POST", pattern: /^\/api\/features\/social\/signals\/?$/, handler: "ingestSocial" },
  { method: "GET", pattern: /^\/api\/features\/social\/signals\/?$/, handler: "listSocial" },
  {
    method: "POST",
    pattern: new RegExp(`^/api/features/social/signals/${SEG}/review/?$`),
    handler: "reviewSocial",
    params: ["id"],
  },
  { method: "GET", pattern: /^\/api\/features\/agency\/sso\/?$/, handler: "describeAgencySso" },
  { method: "PUT", pattern: /^\/api\/features\/agency\/sso\/?$/, handler: "configureAgencySso" },
  { method: "DELETE", pattern: /^\/api\/features\/agency\/sso\/?$/, handler: "deleteAgencySso" },
];

export function matchFeaturesHttpRoute(
  method: string,
  rawPath: string,
): FeaturesHttpTarget | null {
  const verb = method.trim().toUpperCase();
  const path = (rawPath.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;

  for (const route of ROUTES) {
    if (route.method !== verb) continue;
    const match = normalized.match(route.pattern);
    if (!match) continue;
    const pathParameters: Record<string, string> = {};
    (route.params ?? []).forEach((name, i) => {
      const value = match[i + 1];
      if (value) pathParameters[name] = decodeURIComponent(value);
    });
    return { handler: route.handler, pathParameters };
  }
  return null;
}
