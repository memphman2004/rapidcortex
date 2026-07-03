/**
 * Single source of truth for CAD vendor definitions used by the integration wizard.
 *
 * Auth header: X-RC-Token (production — live Lambda validates this header).
 * Webhook path: /api/cad/webhook/{agencyId}/{integrationId}
 */

export type CadVendorId =
  | "motorola_premier_one"
  | "tyler_new_world"
  | "central_square"
  | "hexagon"
  | "console_one"
  | "generic_webhook";

export type CadConnectionType = "webhook_inbound" | "api_poll" | "tcp_feed";

export type RcDestinationFieldId =
  | "cadEventId"
  | "incidentNumber"
  | "incidentType"
  | "priority"
  | "location"
  | "latitude"
  | "longitude"
  | "callerName"
  | "callerPhone"
  | "narrative"
  | "units"
  | "status"
  | "responseCode"
  | "agencyCode";

export interface RcDestinationField {
  id: RcDestinationFieldId;
  label: string;
  description: string;
  required: boolean;
}

export const RC_DESTINATION_FIELDS: RcDestinationField[] = [
  { id: "cadEventId", label: "CAD Event ID", description: "Vendor unique incident identifier — write-back correlation", required: true },
  { id: "incidentNumber", label: "Incident Number", description: "Human-readable event number", required: false },
  { id: "incidentType", label: "Incident Type", description: "Nature/type code", required: true },
  { id: "priority", label: "Priority", description: "Maps to RC P1–P4 via priority mapping table", required: true },
  { id: "location", label: "Location / Address", description: "Full incident address string", required: true },
  { id: "latitude", label: "Latitude", description: "GPS latitude decimal", required: false },
  { id: "longitude", label: "Longitude", description: "GPS longitude decimal", required: false },
  { id: "callerName", label: "Caller Name", description: "Reporting party name", required: false },
  { id: "callerPhone", label: "Caller Phone", description: "Callback number", required: false },
  { id: "narrative", label: "Narrative", description: "Free-text description / call notes", required: false },
  { id: "units", label: "Assigned Units", description: "Unit IDs assigned to the incident", required: false },
  { id: "status", label: "Status", description: "CAD incident status", required: false },
  { id: "responseCode", label: "Response Code", description: "Dispatch response code / run type", required: false },
  { id: "agencyCode", label: "Agency Code", description: "Vendor identifier for the originating agency", required: false },
];

export interface CadSourceField {
  key: string;
  label: string;
  example: string;
  suggestedTarget?: RcDestinationFieldId;
}

export interface DefaultFieldMapping {
  sourceKey: string;
  targetId: RcDestinationFieldId;
}

export type PriorityMapping = Record<string, "P1" | "P2" | "P3" | "P4">;

export interface CadVendorDefinition {
  id: CadVendorId;
  label: string;
  fullName: string;
  logoText: string;
  description: string;
  supportedConnectionTypes: CadConnectionType[];
  recommendedConnectionType: CadConnectionType;
  sourceFields: CadSourceField[];
  defaultFieldMappings: DefaultFieldMapping[];
  defaultPriorityMapping: PriorityMapping;
  authHeaderName: "X-RC-Token";
  vendorWebhookNotes: string;
  setupInstructions: string;
  suggestedPollIntervalMinutes?: number;
  knownApiEndpointPattern?: string;
}

const MOTOROLA_PREMIER_ONE: CadVendorDefinition = {
  id: "motorola_premier_one",
  label: "Motorola PremierOne",
  fullName: "Motorola Solutions PremierOne CAD",
  logoText: "MSI",
  description: "Industry-leading CAD for large metro PSAPs. Webhook push and REST API poll.",
  supportedConnectionTypes: ["webhook_inbound", "api_poll"],
  recommendedConnectionType: "webhook_inbound",
  sourceFields: [
    { key: "EventId", label: "Event ID", example: "EVT-2024-000123", suggestedTarget: "cadEventId" },
    { key: "CallNumber", label: "Call Number", example: "24-00123", suggestedTarget: "incidentNumber" },
    { key: "NatureCode", label: "Nature Code", example: "ASSLT", suggestedTarget: "incidentType" },
    { key: "Priority", label: "Priority", example: "1", suggestedTarget: "priority" },
    { key: "Location", label: "Location", example: "123 Main St", suggestedTarget: "location" },
    { key: "Latitude", label: "Latitude", example: "33.749", suggestedTarget: "latitude" },
    { key: "Longitude", label: "Longitude", example: "-84.388", suggestedTarget: "longitude" },
    { key: "CallerName", label: "Caller Name", example: "John Smith", suggestedTarget: "callerName" },
    { key: "CallerPhone", label: "Caller Phone", example: "+14045551234", suggestedTarget: "callerPhone" },
    { key: "Narrative", label: "Narrative", example: "Caller reporting…", suggestedTarget: "narrative" },
    { key: "Units", label: "Units", example: "E1,M3", suggestedTarget: "units" },
    { key: "Status", label: "Status", example: "ACTIVE", suggestedTarget: "status" },
    { key: "AgencyId", label: "Agency ID", example: "COUNTY-911", suggestedTarget: "agencyCode" },
  ],
  defaultFieldMappings: [
    { sourceKey: "EventId", targetId: "cadEventId" },
    { sourceKey: "CallNumber", targetId: "incidentNumber" },
    { sourceKey: "NatureCode", targetId: "incidentType" },
    { sourceKey: "Priority", targetId: "priority" },
    { sourceKey: "Location", targetId: "location" },
    { sourceKey: "Latitude", targetId: "latitude" },
    { sourceKey: "Longitude", targetId: "longitude" },
    { sourceKey: "CallerName", targetId: "callerName" },
    { sourceKey: "CallerPhone", targetId: "callerPhone" },
    { sourceKey: "Narrative", targetId: "narrative" },
    { sourceKey: "Units", targetId: "units" },
    { sourceKey: "Status", targetId: "status" },
  ],
  defaultPriorityMapping: { "1": "P1", "2": "P2", "3": "P3", "4": "P4", "E": "P1" },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes:
    "Configure in PremierOne Admin Console under Integrations → Outbound Webhooks. Set header X-RC-Token to the token below.",
  setupInstructions: `PremierOne Webhook Setup
─────────────────────────
1. Log into PremierOne Admin Console
2. Administration → System Configuration → Outbound Integrations
3. Add Integration → Type: HTTP Webhook
4. Webhook URL: paste URL from Step 3
5. Header name: X-RC-Token  |  Header value: [token from Step 3]
6. Events: Incident Created, Incident Updated
7. Payload format: JSON
8. Save and use "Send test" in Step 5`,
  suggestedPollIntervalMinutes: 2,
  knownApiEndpointPattern: "https://{host}/PremierOneAPI/api/incidents?since={iso8601}",
};

const TYLER_NEW_WORLD: CadVendorDefinition = {
  id: "tyler_new_world",
  label: "Tyler New World",
  fullName: "Tyler Technologies New World CAD",
  logoText: "TYL",
  description: "Widely deployed in mid-sized PSAPs. API polling is the primary integration path.",
  supportedConnectionTypes: ["api_poll"],
  recommendedConnectionType: "api_poll",
  sourceFields: [
    { key: "eventNumber", label: "Event Number", example: "2024-1234", suggestedTarget: "cadEventId" },
    { key: "callNumber", label: "Call Number", example: "E24001234", suggestedTarget: "incidentNumber" },
    { key: "callType", label: "Call Type", example: "ASSAULT", suggestedTarget: "incidentType" },
    { key: "priority", label: "Priority", example: "1", suggestedTarget: "priority" },
    { key: "locationAddress", label: "Location", example: "456 Oak Ave", suggestedTarget: "location" },
    { key: "gpsLat", label: "GPS Lat", example: "33.749", suggestedTarget: "latitude" },
    { key: "gpsLon", label: "GPS Lon", example: "-84.388", suggestedTarget: "longitude" },
    { key: "callerName", label: "Caller Name", example: "Jane Doe", suggestedTarget: "callerName" },
    { key: "callerPhone", label: "Caller Phone", example: "4045550000", suggestedTarget: "callerPhone" },
    { key: "remarks", label: "Remarks", example: "Caller states…", suggestedTarget: "narrative" },
    { key: "assignedUnits", label: "Assigned Units", example: "P12,F4", suggestedTarget: "units" },
    { key: "eventStatus", label: "Event Status", example: "ACTIVE", suggestedTarget: "status" },
    { key: "agencyCode", label: "Agency Code", example: "PVPD", suggestedTarget: "agencyCode" },
  ],
  defaultFieldMappings: [
    { sourceKey: "eventNumber", targetId: "cadEventId" },
    { sourceKey: "callNumber", targetId: "incidentNumber" },
    { sourceKey: "callType", targetId: "incidentType" },
    { sourceKey: "priority", targetId: "priority" },
    { sourceKey: "locationAddress", targetId: "location" },
    { sourceKey: "gpsLat", targetId: "latitude" },
    { sourceKey: "gpsLon", targetId: "longitude" },
    { sourceKey: "callerName", targetId: "callerName" },
    { sourceKey: "callerPhone", targetId: "callerPhone" },
    { sourceKey: "remarks", targetId: "narrative" },
    { sourceKey: "assignedUnits", targetId: "units" },
    { sourceKey: "eventStatus", targetId: "status" },
  ],
  defaultPriorityMapping: { "1": "P1", "2": "P2", "3": "P3", "4": "P4", "5": "P4" },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes: "Tyler New World uses REST API polling only. Configure API endpoint and credentials in Step 3.",
  setupInstructions: `Tyler New World API Poll Setup
────────────────────────────────
1. Work with Tyler to enable API access
2. Obtain API Base URL, API Key, Agency Code
3. Typical endpoint: GET /nwcad/api/incidents?since={iso8601}&agencyCode={code}
4. Enter credentials in Step 3
5. Rapid Cortex polls at the configured interval (default: 2 min)`,
  suggestedPollIntervalMinutes: 2,
  knownApiEndpointPattern: "https://{host}/nwcad/api/incidents?since={iso8601}&agencyCode={agencyCode}",
};

const CENTRAL_SQUARE: CadVendorDefinition = {
  id: "central_square",
  label: "CentralSquare",
  fullName: "CentralSquare CAD (formerly TriTech / Superion)",
  logoText: "CS",
  description: "Common across county and regional PSAPs. Webhook push via Integration Engine.",
  supportedConnectionTypes: ["webhook_inbound", "api_poll"],
  recommendedConnectionType: "webhook_inbound",
  sourceFields: [
    { key: "IncidentId", label: "Incident ID", example: "CS-2024-000456", suggestedTarget: "cadEventId" },
    { key: "IncidentNumber", label: "Incident Number", example: "24-456", suggestedTarget: "incidentNumber" },
    { key: "NatureOfCall", label: "Nature of Call", example: "FIRE", suggestedTarget: "incidentType" },
    { key: "Priority", label: "Priority", example: "1", suggestedTarget: "priority" },
    { key: "Address", label: "Address", example: "789 Elm St", suggestedTarget: "location" },
    { key: "Lat", label: "Latitude", example: "33.749", suggestedTarget: "latitude" },
    { key: "Lon", label: "Longitude", example: "-84.388", suggestedTarget: "longitude" },
    { key: "CallerName", label: "Caller Name", example: "Alice Johnson", suggestedTarget: "callerName" },
    { key: "CallerPhone", label: "Caller Phone", example: "4045559876", suggestedTarget: "callerPhone" },
    { key: "Comments", label: "Comments", example: "Large structure…", suggestedTarget: "narrative" },
    { key: "UnitList", label: "Unit List", example: "E5,L2,BC1", suggestedTarget: "units" },
    { key: "Status", label: "Status", example: "DISPATCHED", suggestedTarget: "status" },
  ],
  defaultFieldMappings: [
    { sourceKey: "IncidentId", targetId: "cadEventId" },
    { sourceKey: "IncidentNumber", targetId: "incidentNumber" },
    { sourceKey: "NatureOfCall", targetId: "incidentType" },
    { sourceKey: "Priority", targetId: "priority" },
    { sourceKey: "Address", targetId: "location" },
    { sourceKey: "Lat", targetId: "latitude" },
    { sourceKey: "Lon", targetId: "longitude" },
    { sourceKey: "CallerName", targetId: "callerName" },
    { sourceKey: "CallerPhone", targetId: "callerPhone" },
    { sourceKey: "Comments", targetId: "narrative" },
    { sourceKey: "UnitList", targetId: "units" },
    { sourceKey: "Status", targetId: "status" },
  ],
  defaultPriorityMapping: { "1": "P1", "2": "P2", "3": "P3", "4": "P4", "E": "P1" },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes: "Configure in CentralSquare Integration Engine. Outbound REST with X-RC-Token header.",
  setupInstructions: `CentralSquare Webhook Setup
─────────────────────────────
1. Access CentralSquare Integration Engine
2. Create Outbound Integration → REST/HTTP
3. Webhook URL from Step 3
4. Header: X-RC-Token = [token from Step 3]
5. Events: Incident Created, Updated, Units Assigned`,
  suggestedPollIntervalMinutes: 2,
  knownApiEndpointPattern: "https://{host}/cs-cad/api/v1/incidents?modifiedSince={iso8601}",
};

const HEXAGON: CadVendorDefinition = {
  id: "hexagon",
  label: "Hexagon / I/CAD",
  fullName: "Hexagon Safety & Infrastructure (I/CAD)",
  logoText: "HXG",
  description: "Enterprise CAD for large counties. I/CAD Web Services or GeoMedia Connect.",
  supportedConnectionTypes: ["webhook_inbound", "api_poll"],
  recommendedConnectionType: "api_poll",
  sourceFields: [
    { key: "event_id", label: "Event ID", example: "HXG-20240001", suggestedTarget: "cadEventId" },
    { key: "event_number", label: "Event Number", example: "2024-E-00001", suggestedTarget: "incidentNumber" },
    { key: "event_type", label: "Event Type", example: "10-50", suggestedTarget: "incidentType" },
    { key: "priority_code", label: "Priority Code", example: "P1", suggestedTarget: "priority" },
    { key: "location_text", label: "Location Text", example: "100 Peachtree NW", suggestedTarget: "location" },
    { key: "lat", label: "Lat", example: "33.749", suggestedTarget: "latitude" },
    { key: "lng", label: "Lng", example: "-84.388", suggestedTarget: "longitude" },
    { key: "caller_name", label: "Caller Name", example: "Robert Jones", suggestedTarget: "callerName" },
    { key: "callback_number", label: "Callback Number", example: "+14045551111", suggestedTarget: "callerPhone" },
    { key: "problem", label: "Problem / Notes", example: "Caller advising…", suggestedTarget: "narrative" },
    { key: "responding_units", label: "Responding Units", example: "P21,E6", suggestedTarget: "units" },
    { key: "event_status", label: "Event Status", example: "DISPATCHED", suggestedTarget: "status" },
    { key: "response_type", label: "Response Type", example: "EMERGENCY", suggestedTarget: "responseCode" },
  ],
  defaultFieldMappings: [
    { sourceKey: "event_id", targetId: "cadEventId" },
    { sourceKey: "event_number", targetId: "incidentNumber" },
    { sourceKey: "event_type", targetId: "incidentType" },
    { sourceKey: "priority_code", targetId: "priority" },
    { sourceKey: "location_text", targetId: "location" },
    { sourceKey: "lat", targetId: "latitude" },
    { sourceKey: "lng", targetId: "longitude" },
    { sourceKey: "caller_name", targetId: "callerName" },
    { sourceKey: "callback_number", targetId: "callerPhone" },
    { sourceKey: "problem", targetId: "narrative" },
    { sourceKey: "responding_units", targetId: "units" },
    { sourceKey: "event_status", targetId: "status" },
    { sourceKey: "response_type", targetId: "responseCode" },
  ],
  defaultPriorityMapping: { "P1": "P1", "P2": "P2", "P3": "P3", "P4": "P4", "1": "P1", "2": "P2", "3": "P3", "4": "P4" },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes: "Configure in I/CAD Web Services under Administration → Event Notifications.",
  setupInstructions: `Hexagon I/CAD Integration Setup
──────────────────────────────────
1. Contact Hexagon integrator for API base URL and key
2. Webhook: X-RC-Token header with token from Step 3
3. Poll endpoint: GET /icad-ws/api/events/since/{timestamp}`,
  suggestedPollIntervalMinutes: 2,
  knownApiEndpointPattern: "https://{host}/icad-ws/api/events/since/{timestamp}?agencyCode={agencyCode}",
};

const CONSOLE_ONE: CadVendorDefinition = {
  id: "console_one",
  label: "Console One",
  fullName: "Console One CAD",
  logoText: "C1",
  description: "Modern cloud-native CAD with JSON webhook push.",
  supportedConnectionTypes: ["webhook_inbound"],
  recommendedConnectionType: "webhook_inbound",
  sourceFields: [
    { key: "id", label: "ID", example: "c1-evt-abc123", suggestedTarget: "cadEventId" },
    { key: "displayId", label: "Display ID", example: "2024-00789", suggestedTarget: "incidentNumber" },
    { key: "type", label: "Type", example: "ASSAULT", suggestedTarget: "incidentType" },
    { key: "priority", label: "Priority", example: "IMMEDIATE", suggestedTarget: "priority" },
    { key: "address", label: "Address", example: "321 Broad St", suggestedTarget: "location" },
    { key: "coordinates.lat", label: "Coordinates Lat", example: "33.749", suggestedTarget: "latitude" },
    { key: "coordinates.lng", label: "Coordinates Lng", example: "-84.388", suggestedTarget: "longitude" },
    { key: "caller.name", label: "Caller Name", example: "Mary Brown", suggestedTarget: "callerName" },
    { key: "caller.phone", label: "Caller Phone", example: "+14045552222", suggestedTarget: "callerPhone" },
    { key: "notes", label: "Notes", example: "Caller reports…", suggestedTarget: "narrative" },
    { key: "units", label: "Units", example: '["P1","M2"]', suggestedTarget: "units" },
    { key: "status", label: "Status", example: "dispatched", suggestedTarget: "status" },
  ],
  defaultFieldMappings: [
    { sourceKey: "id", targetId: "cadEventId" },
    { sourceKey: "displayId", targetId: "incidentNumber" },
    { sourceKey: "type", targetId: "incidentType" },
    { sourceKey: "priority", targetId: "priority" },
    { sourceKey: "address", targetId: "location" },
    { sourceKey: "coordinates.lat", targetId: "latitude" },
    { sourceKey: "coordinates.lng", targetId: "longitude" },
    { sourceKey: "caller.name", targetId: "callerName" },
    { sourceKey: "caller.phone", targetId: "callerPhone" },
    { sourceKey: "notes", targetId: "narrative" },
    { sourceKey: "units", targetId: "units" },
    { sourceKey: "status", targetId: "status" },
  ],
  defaultPriorityMapping: {
    "IMMEDIATE": "P1",
    "EMERGENCY": "P1",
    "PRIORITY": "P2",
    "URGENT": "P2",
    "ROUTINE": "P3",
    "NON-EMERGENCY": "P4",
    "1": "P1",
    "2": "P2",
    "3": "P3",
    "4": "P4",
  },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes: "Console One Admin → Integrations → Outbound Webhooks. Header X-RC-Token.",
  setupInstructions: `Console One Webhook Setup
──────────────────────────
1. Console One Admin → Settings → Integrations → Outbound Webhooks
2. Endpoint URL from Step 3
3. Header: X-RC-Token = [token from Step 3]
4. Events: Incident Created, Updated, Unit Dispatched`,
};

const GENERIC_WEBHOOK: CadVendorDefinition = {
  id: "generic_webhook",
  label: "Generic Webhook",
  fullName: "Generic / Custom Webhook",
  logoText: "GEN",
  description: "Any CAD system or custom integration. Configure field mapping manually.",
  supportedConnectionTypes: ["webhook_inbound", "api_poll"],
  recommendedConnectionType: "webhook_inbound",
  sourceFields: [
    { key: "id", label: "ID", example: "evt-001", suggestedTarget: "cadEventId" },
    { key: "type", label: "Type", example: "INCIDENT", suggestedTarget: "incidentType" },
    { key: "priority", label: "Priority", example: "1", suggestedTarget: "priority" },
    { key: "address", label: "Address", example: "123 Main St", suggestedTarget: "location" },
    { key: "lat", label: "Lat", example: "33.749", suggestedTarget: "latitude" },
    { key: "lng", label: "Lng", example: "-84.388", suggestedTarget: "longitude" },
    { key: "narrative", label: "Narrative", example: "Incident details", suggestedTarget: "narrative" },
  ],
  defaultFieldMappings: [
    { sourceKey: "id", targetId: "cadEventId" },
    { sourceKey: "type", targetId: "incidentType" },
    { sourceKey: "priority", targetId: "priority" },
    { sourceKey: "address", targetId: "location" },
    { sourceKey: "lat", targetId: "latitude" },
    { sourceKey: "lng", targetId: "longitude" },
    { sourceKey: "narrative", targetId: "narrative" },
  ],
  defaultPriorityMapping: { "1": "P1", "2": "P2", "3": "P3", "4": "P4" },
  authHeaderName: "X-RC-Token",
  vendorWebhookNotes: "POST JSON to the webhook URL with header X-RC-Token.",
  setupInstructions: `Generic Webhook Setup
──────────────────────
1. Method: POST
2. URL from Step 3
3. Headers: Content-Type: application/json, X-RC-Token: [token]
4. Configure field mapping in Step 4`,
};

export const CAD_VENDORS: CadVendorDefinition[] = [
  MOTOROLA_PREMIER_ONE,
  TYLER_NEW_WORLD,
  CENTRAL_SQUARE,
  HEXAGON,
  CONSOLE_ONE,
  GENERIC_WEBHOOK,
];

export function getCadVendor(id: CadVendorId): CadVendorDefinition {
  const vendor = CAD_VENDORS.find((v) => v.id === id);
  if (!vendor) throw new Error(`Unknown CAD vendor: ${id}`);
  return vendor;
}

/** RC destination → parser logical field (generic webhook + future parsers). */
const PARSER_FIELD_ALIASES: Partial<Record<RcDestinationFieldId, string>> = {
  cadEventId: "cadNumber",
  incidentNumber: "incidentNumber",
  incidentType: "incidentType",
  priority: "priority",
  location: "location",
  latitude: "latitude",
  longitude: "longitude",
  callerName: "callerName",
  callerPhone: "callerCallback",
  narrative: "notes",
  units: "units",
  status: "status",
  responseCode: "responseCode",
  agencyCode: "agencyCode",
};

/** Build DynamoDB config blob from mapper UI state. */
export function buildFieldMappingConfig(
  mappings: Array<{ sourceKey: string; targetId: RcDestinationFieldId | "" }>,
  priorityMapping: PriorityMapping,
): Record<string, unknown> {
  const fieldMapping: Record<string, string> = {};
  const uiFieldMappings: DefaultFieldMapping[] = [];

  for (const m of mappings) {
    if (!m.sourceKey || !m.targetId) continue;
    uiFieldMappings.push({ sourceKey: m.sourceKey, targetId: m.targetId });
    const parserKey = PARSER_FIELD_ALIASES[m.targetId] ?? m.targetId;
    fieldMapping[parserKey] = m.sourceKey;
  }

  return { fieldMapping, priorityMapping, uiFieldMappings };
}
