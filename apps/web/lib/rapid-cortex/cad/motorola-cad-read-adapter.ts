import type {
  CadEventRecord,
  CadIncidentRecord,
  CadUnitRecord,
} from "@/lib/rapid-cortex/cad/cad-models";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import { MotorolaPremierOneCadAdapter } from "@/lib/rapid-cortex/cad/vendors/MotorolaPremierOneCadAdapter";
import type { CadHealthResult } from "@/lib/rapid-cortex/cad/CadAdapter";

function mapMotorolaIncident(
  raw: import("@/lib/rapid-cortex/cad/CadAdapter").CadIncident,
  fallbackAgency: string,
  sourceVendor: string,
): CadIncidentRecord {
  const rawObj = raw.raw ?? {};
  const latitude =
    typeof rawObj.latitude === "number"
      ? rawObj.latitude
      : typeof rawObj.latitude === "string"
        ? Number(rawObj.latitude)
        : Number.NaN;
  const longitude =
    typeof rawObj.longitude === "number"
      ? rawObj.longitude
      : typeof rawObj.longitude === "string"
        ? Number(rawObj.longitude)
        : Number.NaN;
  return {
    incidentId: raw.incidentId,
    externalCadId: String(raw.externalId ?? raw.incidentId),
    agencyId:
      typeof rawObj.agencyId === "string" && rawObj.agencyId.trim().length > 0
        ? rawObj.agencyId
        : fallbackAgency,
    callType: String(raw.callType ?? "UNKNOWN"),
    priority: typeof rawObj.priority === "string" ? rawObj.priority : "UNKNOWN",
    status: String(raw.status ?? "unknown"),
    address: raw.location ?? "Unknown location",
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    ...(typeof rawObj.callerName === "string" ? { callerName: rawObj.callerName } : {}),
    ...(typeof rawObj.callerPhone === "string" ? { callerPhone: rawObj.callerPhone } : {}),
    createdAt:
      typeof rawObj.createdAt === "string" ? rawObj.createdAt : (raw.lastUpdatedAt ?? new Date().toISOString()),
    updatedAt:
      typeof rawObj.updatedAt === "string" ? rawObj.updatedAt : (raw.lastUpdatedAt ?? new Date().toISOString()),
    assignedUnits: raw.units ?? [],
    notes:
      typeof rawObj.notes === "string"
        ? [rawObj.notes]
        : Array.isArray(rawObj.notes)
          ? rawObj.notes.filter((x: unknown): x is string => typeof x === "string")
          : [],
    sourceVendor,
  };
}

/** Read-only facade over Motorola `CadIncident` payloads (best-effort field mapping). */
export class MotorolaCadReadAdapter implements CadReadProvider {
  private readonly vendor = new MotorolaPremierOneCadAdapter();
  private readonly sourceVendor = "motorola-premierone";
  private readonly fallbackAgency = process.env.CAD_DEFAULT_AGENCY_ID?.trim() || "agency-unknown";

  async healthCheck(): Promise<CadHealthResult> {
    return this.vendor.healthCheck();
  }

  async listActiveIncidents(): Promise<CadIncidentRecord[]> {
    const rows = await this.vendor.searchIncidents({});
    return rows.map((row) =>
      mapMotorolaIncident(row, this.fallbackAgency, `${this.sourceVendor}-read`),
    );
  }

  async getIncidentById(incidentId: string): Promise<CadIncidentRecord | null> {
    try {
      const raw = await this.vendor.getIncident(incidentId);
      return mapMotorolaIncident(raw, this.fallbackAgency, `${this.sourceVendor}-read`);
    } catch {
      return null;
    }
  }

  async listUnits(): Promise<CadUnitRecord[]> {
    const payload = await this.vendor.listActiveUnits();
    const t = new Date().toISOString();
    return payload.map((u, ix) =>
      motorolaUnitToRecord(u as Record<string, unknown>, this.fallbackAgency, t, ix),
    );
  }

  async getUnitStatus(unitId: string): Promise<CadUnitRecord | null> {
    try {
      const payload = await this.vendor.getUnit(unitId);
      return motorolaUnitToRecord(payload as Record<string, unknown>, this.fallbackAgency, new Date().toISOString(), 0);
    } catch {
      return null;
    }
  }

  /** Motorola HTTP surface lacks a vendor-neutral event stream hook in this shim — stays empty unless extended. */
  async getRecentCadEvents(): Promise<CadEventRecord[]> {
    return [];
  }
}

function motorolaUnitToRecord(
  payload: Record<string, unknown>,
  agencyId: string,
  ts: string,
  ix: number,
): CadUnitRecord {
  const unitId = String(payload.unitId ?? payload.id ?? `unit-${ix}`);
  const status = String(payload.status ?? "unknown");
  const latRaw = payload.latitude;
  const lngRaw = payload.longitude;
  const latitude = typeof latRaw === "number" ? latRaw : typeof latRaw === "string" ? Number(latRaw) : undefined;
  const longitude =
    typeof lngRaw === "number" ? lngRaw : typeof lngRaw === "string" ? Number(lngRaw) : undefined;
  return {
    unitId,
    externalCadUnitId: typeof payload.externalUnitId === "string" ? payload.externalUnitId : unitId,
    agencyId: typeof payload.agencyId === "string" && payload.agencyId.trim() ? payload.agencyId : agencyId,
    unitType: typeof payload.unitType === "string" ? payload.unitType : "UNKNOWN",
    status,
    ...(typeof payload.assignedIncidentId === "string" ? { currentIncidentId: payload.assignedIncidentId } : {}),
    ...(Number.isFinite(latitude) ? { latitude: latitude as number } : {}),
    ...(Number.isFinite(longitude) ? { longitude: longitude as number } : {}),
    updatedAt:
      typeof payload.updatedAt === "string"
        ? payload.updatedAt
        : typeof payload.lastUpdated === "string"
          ? payload.lastUpdated
          : ts,
  };
}
