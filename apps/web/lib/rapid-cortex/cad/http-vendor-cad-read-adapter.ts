import type { CadIncidentRecord } from "@/lib/rapid-cortex/cad/cad-models";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import type { CadHealthResult, CadIncident } from "@/lib/rapid-cortex/cad/CadAdapter";

type ReadVendor = {
  healthCheck(): Promise<CadHealthResult>;
  searchIncidents(query: { limit?: number }): Promise<CadIncident[]>;
  getIncident(incidentId: string): Promise<CadIncident>;
};

function mapIncident(raw: CadIncident, fallbackAgency: string, sourceVendor: string): CadIncidentRecord {
  const rawObj = raw.raw ?? {};
  const latRaw = rawObj.latitude ?? rawObj.Latitude ?? rawObj.Lat ?? rawObj.gpsLat;
  const lngRaw = rawObj.longitude ?? rawObj.Longitude ?? rawObj.Lon ?? rawObj.gpsLon;
  const latitude = typeof latRaw === "number" ? latRaw : typeof latRaw === "string" ? Number(latRaw) : Number.NaN;
  const longitude = typeof lngRaw === "number" ? lngRaw : typeof lngRaw === "string" ? Number(lngRaw) : Number.NaN;
  return {
    incidentId: raw.incidentId,
    externalCadId: String(raw.externalId ?? raw.incidentId),
    agencyId:
      typeof rawObj.agencyId === "string" && rawObj.agencyId.trim().length > 0
        ? rawObj.agencyId
        : fallbackAgency,
    callType: String(raw.callType ?? "UNKNOWN"),
    priority: typeof rawObj.priority === "string" || typeof rawObj.Priority === "string"
      ? String(rawObj.priority ?? rawObj.Priority)
      : "UNKNOWN",
    status: String(raw.status ?? "unknown"),
    address: raw.location ?? "Unknown location",
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    ...(typeof rawObj.callerName === "string" || typeof rawObj.CallerName === "string"
      ? { callerName: String(rawObj.callerName ?? rawObj.CallerName) }
      : {}),
    ...(typeof rawObj.callerPhone === "string" || typeof rawObj.CallerPhone === "string"
      ? { callerPhone: String(rawObj.callerPhone ?? rawObj.CallerPhone) }
      : {}),
    createdAt:
      typeof rawObj.createdAt === "string" ? rawObj.createdAt : (raw.lastUpdatedAt ?? new Date().toISOString()),
    updatedAt:
      typeof rawObj.updatedAt === "string" ? rawObj.updatedAt : (raw.lastUpdatedAt ?? new Date().toISOString()),
    assignedUnits: raw.units ?? [],
    notes:
      typeof rawObj.notes === "string" || typeof rawObj.Comments === "string" || typeof rawObj.remarks === "string"
        ? [String(rawObj.notes ?? rawObj.Comments ?? rawObj.remarks)]
        : Array.isArray(rawObj.notes)
          ? rawObj.notes.filter((x: unknown): x is string => typeof x === "string")
          : [],
    sourceVendor,
  };
}

/** Read-only facade over HTTP JSON CAD adapters (PremierOne / CentralSquare / Tyler). */
export class HttpVendorCadReadAdapter implements CadReadProvider {
  private readonly fallbackAgency = process.env.CAD_DEFAULT_AGENCY_ID?.trim() || "agency-unknown";

  constructor(
    private readonly vendor: ReadVendor,
    private readonly sourceVendor: string,
  ) {}

  async healthCheck(): Promise<CadHealthResult> {
    return this.vendor.healthCheck();
  }

  async listActiveIncidents(): Promise<CadIncidentRecord[]> {
    const rows = await this.vendor.searchIncidents({});
    return rows.map((row) => mapIncident(row, this.fallbackAgency, `${this.sourceVendor}-read`));
  }

  async getIncidentById(incidentId: string): Promise<CadIncidentRecord | null> {
    try {
      const raw = await this.vendor.getIncident(incidentId);
      return mapIncident(raw, this.fallbackAgency, `${this.sourceVendor}-read`);
    } catch {
      return null;
    }
  }

  async listUnits() {
    return [];
  }

  async getUnitStatus() {
    return null;
  }

  async getRecentCadEvents() {
    return [];
  }
}
