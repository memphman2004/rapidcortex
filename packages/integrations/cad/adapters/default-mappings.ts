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
    case "generic_rest":
      return [];
  }
}
