import type { CadProviderId, CadVendorId, CallAssistCadCreatePayload } from "rapid-cortex-shared";
import { cadConnectorService, isCadConnectorMock } from "rapid-cortex-integrations/cad";
import type { ResolvedCadCredentials } from "rapid-cortex-integrations/cad";

export type CadVendorLiveResult = {
  ok: boolean;
  cadIncidentId?: string;
  reason: string;
  vendorResponse?: string;
};

export const CALL_ASSIST_CAD_CONNECTOR_VENDOR: Record<Exclude<CadProviderId, "mock">, CadVendorId> = {
  "motorola-premierone": "motorola_premierone",
  "tyler-new-world": "tyler_new_world",
  "hexagon-intergraph": "hexagon_intergraph",
  centralsquare: "central_square",
  zetron: "generic_rest",
  mark43: "generic_rest",
  versaterm: "generic_rest",
};

export const CALL_ASSIST_CAD_CREATE_PATH: Record<Exclude<CadProviderId, "mock">, string> = {
  "motorola-premierone": "/api/v1/incidents",
  "tyler-new-world": "/api/cad/incidents",
  "hexagon-intergraph": "/icad/api/calls",
  centralsquare: "/api/calls",
  zetron: "/incidents",
  mark43: "/api/v1/incidents",
  versaterm: "/cad/incidents",
};

function authHeaders(credentials: ResolvedCadCredentials): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (credentials.authType === "api_key" && credentials.apiKey) headers["X-API-Key"] = credentials.apiKey;
  if (credentials.authType === "oauth2" && credentials.accessToken) {
    headers.Authorization = `Bearer ${credentials.accessToken}`;
  }
  if (credentials.authType === "basic") {
    const pair = `${credentials.username ?? ""}:${credentials.password ?? ""}`;
    headers.Authorization = `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
  }
  return headers;
}

export function cadVendorBody(
  payload: CallAssistCadCreatePayload,
  providerId: Exclude<CadProviderId, "mock"> = "motorola-premierone",
): Record<string, unknown> {
  const intake = payload.intake;
  const address = intake.locationText ?? payload.location.text ?? "";
  const priority = intake.injuries || intake.weaponsMentioned ? 1 : 3;
  const common = {
    AiGenerated: true,
    RequiresHumanReview: true,
    CallerName: intake.callerName ?? "",
    CallerPhone: intake.callbackNumber ?? "",
  };
  if (providerId === "tyler-new-world") {
    return {
      ...common,
      call_type_cd: payload.classification,
      priority_nbr: priority,
      location_txt: address,
      lat_dec: payload.location.lat ?? intake.locationLat,
      lon_dec: payload.location.lng ?? intake.locationLng,
      comments_txt: intake.summary ?? "",
    };
  }
  if (providerId === "hexagon-intergraph") {
    return {
      ...common,
      CallCode: payload.classification,
      CallPriority: priority,
      EntryAddress: address,
      Latitude: payload.location.lat ?? intake.locationLat,
      Longitude: payload.location.lng ?? intake.locationLng,
      Remarks: intake.summary ?? "",
    };
  }
  if (providerId === "centralsquare") {
    return {
      ...common,
      call_type: payload.classification,
      priority,
      location: {
        address,
        apartment: intake.apartmentSuite ?? "",
        lat: payload.location.lat ?? intake.locationLat,
        lng: payload.location.lng ?? intake.locationLng,
      },
      comments: intake.summary ?? "",
    };
  }
  if (providerId === "zetron" || providerId === "mark43" || providerId === "versaterm") {
    return {
      ...common,
      type: payload.classification,
      priority,
      address,
      lat: payload.location.lat ?? intake.locationLat,
      lng: payload.location.lng ?? intake.locationLng,
      comments: intake.summary ?? "",
    };
  }
  return {
    ...common,
    CallType: payload.classification,
    NatureCode: payload.classification,
    Priority: priority,
    Location: {
      FullAddress: address,
      Apartment: intake.apartmentSuite ?? "",
      CrossStreet: intake.crossStreets ?? "",
      Latitude: payload.location.lat ?? intake.locationLat,
      Longitude: payload.location.lng ?? intake.locationLng,
    },
    Vehicle: {
      Year: intake.vehicleYear ?? "",
      Make: intake.vehicleMake ?? "",
      Model: intake.vehicleModel ?? "",
      Color: intake.vehicleColor ?? "",
      Plate: intake.vehiclePlate ?? "",
    },
    SuspectDescription: intake.suspectDescription ?? "",
    DirectionOfTravel: intake.directionOfTravel ?? "",
    Weapons: intake.weaponsDetail ?? (intake.weaponsMentioned ? "yes" : ""),
    Injuries: intake.injuriesDetail ?? (intake.injuries ? "yes" : ""),
    Comments: intake.summary ?? "",
  };
}

/**
 * Live CAD create for any Call Assist vendor adapter.
 * Dual fail-closed flags are evaluated by the adapter before this runs.
 */
export async function submitCadVendorCreate(
  providerId: Exclude<CadProviderId, "mock">,
  payload: CallAssistCadCreatePayload,
): Promise<CadVendorLiveResult> {
  if (isCadConnectorMock()) {
    return { ok: false, reason: "cad_connector_mock" };
  }
  const vendorId = CALL_ASSIST_CAD_CONNECTOR_VENDOR[providerId];
  let connectors;
  try {
    connectors = await cadConnectorService.list(payload.agencyId);
  } catch {
    return { ok: false, reason: "cad_connector_unconfigured" };
  }
  const match = connectors.find((c) => c.vendorId === vendorId && c.enabled);
  if (!match) return { ok: false, reason: `no_${providerId.replace(/-/g, "_")}_connector` };
  const resolved = await cadConnectorService.getResolved(payload.agencyId, match.connectorId);
  if (!resolved?.baseUrl) return { ok: false, reason: `${providerId.replace(/-/g, "_")}_base_url_missing` };
  const credentials = await cadConnectorService.resolveCredentials(resolved);
  const path = CALL_ASSIST_CAD_CREATE_PATH[providerId];
  const url = `${resolved.baseUrl.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(credentials),
      body: JSON.stringify(cadVendorBody(payload, providerId)),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, reason: `${providerId.replace(/-/g, "_")}_http_failed`, vendorResponse: text.slice(0, 2000) };
    }
    let id = "";
    try {
      const json = text ? (JSON.parse(text) as { EventNumber?: string; incidentId?: string; id?: string }) : {};
      id = (json.EventNumber ?? json.incidentId ?? json.id ?? "").trim();
    } catch {
      id = "";
    }
    return {
      ok: true,
      cadIncidentId: id || `${providerId.slice(0, 8)}-${Date.now()}`,
      reason: `${providerId.replace(/-/g, "_")}_created`,
      vendorResponse: text.slice(0, 2000),
    };
  } catch (err) {
    return {
      ok: false,
      reason: `${providerId.replace(/-/g, "_")}_http_failed`,
      vendorResponse: err instanceof Error ? err.message.slice(0, 500) : "request_failed",
    };
  }
}
