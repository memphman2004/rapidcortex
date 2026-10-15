import type { CadFieldMapping, CadVendorId, UnifiedCadStatus } from "rapid-cortex-shared";

function m(
  vendorField: string,
  rcField: string,
  extra?: Partial<CadFieldMapping>,
): CadFieldMapping {
  return {
    mappingId: `${vendorField}-${rcField}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64),
    vendorField,
    rcField,
    required: extra?.required ?? false,
    direction: extra?.direction ?? "both",
    transform: extra?.transform,
  };
}

export const PREMIERONE_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  PENDING: "pending",
  QUEUED: "queued",
  ACTIVE: "dispatched",
  DISPATCHED: "dispatched",
  ENROUTE: "en_route",
  EN_ROUTE: "en_route",
  ONSCENE: "on_scene",
  ON_SCENE: "on_scene",
  CLEARED: "cleared",
  CLOSED: "cleared",
  CANCELLED: "cancelled",
  CANCELED: "cancelled",
};

export const TYLER_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  PEND: "pending",
  QUEUE: "queued",
  DISP: "dispatched",
  ENRT: "en_route",
  ONSC: "on_scene",
  CLR: "cleared",
  CANC: "cancelled",
};

export const HEXAGON_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  PEND: "pending",
  QUEUE: "queued",
  DISP: "dispatched",
  ENROUTE: "en_route",
  SCENE: "on_scene",
  CLEAR: "cleared",
  CANCEL: "cancelled",
};

export const CENTRALSQUARE_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  pending: "pending",
  queued: "queued",
  dispatched: "dispatched",
  enroute: "en_route",
  onscene: "on_scene",
  cleared: "cleared",
  cancelled: "cancelled",
};

export const SPILLMAN_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  PEND: "pending",
  QUEUE: "queued",
  DISP: "dispatched",
  ENRT: "en_route",
  ONSC: "on_scene",
  CLR: "cleared",
  CANC: "cancelled",
};

/** Shared lowercase / mixed-case status codes used by many REST CAD products. */
export const COMMON_REST_STATUS_MAP: Record<string, UnifiedCadStatus> = {
  pending: "pending",
  queued: "queued",
  dispatched: "dispatched",
  DISP: "dispatched",
  DISPATCHED: "dispatched",
  enroute: "en_route",
  ENRT: "en_route",
  ENROUTE: "en_route",
  en_route: "en_route",
  onscene: "on_scene",
  ONSCENE: "on_scene",
  ONSC: "on_scene",
  on_scene: "on_scene",
  cleared: "cleared",
  CLR: "cleared",
  CLEARED: "cleared",
  cancelled: "cancelled",
  CANC: "cancelled",
  CANCELLED: "cancelled",
};

export function defaultMappingsForVendor(vendorId: CadVendorId): CadFieldMapping[] {
  switch (vendorId) {
    case "motorola_premierone":
      return [
        m("EventNumber", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("CallType", "incidentType", { required: true }),
        m("Priority", "priority"),
        m("IncidentStatus", "status", {
          transform: { type: "code_lookup", table: PREMIERONE_STATUS_MAP },
        }),
        m("Location.FullAddress", "address"),
        m("Location.Latitude", "latitude"),
        m("Location.Longitude", "longitude"),
        m("CallerName", "callerName"),
        m("CallerPhone", "callerPhone"),
        m("ReceivedTime", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "local" } }),
        m("DispatchedTime", "dispatchedAt", { transform: { type: "date_iso", sourceFormat: "local" } }),
        m("vendorIncidentId", "EventNumber", { direction: "outbound" }),
        m("status", "IncidentStatus", { direction: "outbound" }),
        m("narrative", "Narrative", { direction: "outbound" }),
      ];
    case "tyler_new_world":
      return [
        m("inc_nbr", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("call_type_cd", "incidentType", { required: true }),
        m("priority_nbr", "priority"),
        m("inc_status_cd", "status", { transform: { type: "code_lookup", table: TYLER_STATUS_MAP } }),
        m("location_txt", "address"),
        m("lat_dec", "latitude"),
        m("lon_dec", "longitude"),
        m("received_dt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "local" } }),
        m("vendorIncidentId", "inc_nbr", { direction: "outbound" }),
        m("status", "inc_status_cd", { direction: "outbound" }),
        m("narrative", "narrative_txt", { direction: "outbound" }),
      ];
    case "hexagon_intergraph":
      return [
        m("CallId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("CallCode", "incidentType", { required: true }),
        m("CallPriority", "priority"),
        m("CallStatus", "status", { transform: { type: "code_lookup", table: HEXAGON_STATUS_MAP } }),
        m("EntryAddress", "address"),
        m("Latitude", "latitude"),
        m("Longitude", "longitude"),
        m("CreateDate", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "local" } }),
        m("vendorIncidentId", "CallId", { direction: "outbound" }),
        m("status", "CallStatus", { direction: "outbound" }),
        m("narrative", "Comments", { direction: "outbound" }),
      ];
    case "central_square":
      return [
        m("call_number", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("call_type", "incidentType", { required: true }),
        m("priority", "priority"),
        m("call_status", "status", {
          transform: { type: "code_lookup", table: CENTRALSQUARE_STATUS_MAP },
        }),
        m("location.address", "address"),
        m("location.lat", "latitude"),
        m("location.lng", "longitude"),
        m("received_at", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "call_number", { direction: "outbound" }),
        m("status", "call_status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "spillman":
      return [
        m("callId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("callType", "incidentType", { required: true }),
        m("priority", "priority"),
        m("callStatus", "status", { transform: { type: "code_lookup", table: SPILLMAN_STATUS_MAP } }),
        m("address", "address"),
        m("gpsLat", "latitude"),
        m("gpsLon", "longitude"),
        m("receivedAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "callId", { direction: "outbound" }),
        m("status", "callStatus", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "mark43":
      return [
        m("id", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("type", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("address", "address"),
        m("latitude", "latitude"),
        m("longitude", "longitude"),
        m("receivedAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "id", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "caliber":
      return [
        m("callNumber", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("callType", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("location", "address"),
        m("lat", "latitude"),
        m("lon", "longitude"),
        m("receivedAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "callNumber", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "versaterm":
      return [
        m("eventId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("eventType", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("fullAddress", "address"),
        m("latitude", "latitude"),
        m("longitude", "longitude"),
        m("createTime", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "eventId", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "comments", { direction: "outbound" }),
      ];
    case "rapiddeploy":
      return [
        m("incidentId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("nature", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("address", "address"),
        m("lat", "latitude"),
        m("lng", "longitude"),
        m("createdAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "incidentId", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "zetron":
      return [
        m("callId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("callType", "incidentType", { required: true }),
        m("priority", "priority"),
        m("callStatus", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("address", "address"),
        m("gpsLat", "latitude"),
        m("gpsLon", "longitude"),
        m("receivedAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "callId", { direction: "outbound" }),
        m("status", "callStatus", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "eforce":
      return [
        m("incidentNumber", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("incidentType", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("locationText", "address"),
        m("latitude", "latitude"),
        m("longitude", "longitude"),
        m("receivedDateTime", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "incidentNumber", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "cody":
      return [
        m("call_id", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("call_type", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("address", "address"),
        m("latitude", "latitude"),
        m("longitude", "longitude"),
        m("received_at", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "call_id", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "comments", { direction: "outbound" }),
      ];
    case "sunridge_rims":
      return [
        m("caseNumber", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("natureCode", "incidentType", { required: true }),
        m("priority", "priority"),
        m("statusCode", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("streetAddress", "address"),
        m("lat", "latitude"),
        m("lon", "longitude"),
        m("createDateTime", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "caseNumber", { direction: "outbound" }),
        m("status", "statusCode", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "kabat_one":
      return [
        m("dispatchId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("callNature", "incidentType", { required: true }),
        m("priority", "priority"),
        m("status", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("address", "address"),
        m("latitude", "latitude"),
        m("longitude", "longitude"),
        m("receivedAt", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "dispatchId", { direction: "outbound" }),
        m("status", "status", { direction: "outbound" }),
        m("narrative", "narrative", { direction: "outbound" }),
      ];
    case "oracle_psdc":
      return [
        m("IncidentId", "vendorIncidentId", { required: true, direction: "inbound" }),
        m("IncidentType", "incidentType", { required: true }),
        m("Priority", "priority"),
        m("IncidentStatus", "status", { transform: { type: "code_lookup", table: COMMON_REST_STATUS_MAP } }),
        m("LocationAddress", "address"),
        m("Latitude", "latitude"),
        m("Longitude", "longitude"),
        m("ReceivedTime", "callReceivedAt", { transform: { type: "date_iso", sourceFormat: "iso" } }),
        m("vendorIncidentId", "IncidentId", { direction: "outbound" }),
        m("status", "IncidentStatus", { direction: "outbound" }),
        m("narrative", "Narrative", { direction: "outbound" }),
      ];
    case "generic_rest":
      return [];
  }
}
