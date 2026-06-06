import type {
  CadEventRecord,
  CadIncidentRecord,
  CadUnitRecord,
} from "@/lib/rapid-cortex/cad/cad-models";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import type { CadHealthResult } from "@/lib/rapid-cortex/cad/CadAdapter";

const SOURCE = "staging-cad-read-adapter";

const STAGING_AGENCY = "staging-agency-001";

const BASE_INCIDENTS: readonly Omit<CadIncidentRecord, "createdAt" | "updatedAt">[] = [
  {
    incidentId: "staging-inc-e01",
    externalCadId: "CAD-E101-ALPHA",
    agencyId: STAGING_AGENCY,
    callType: "EMS — chest pain",
    priority: "1",
    status: "active",
    address: "500 Oak St, Example City",
    latitude: 37.785834,
    longitude: -122.406417,
    callerName: "Alex Rivera",
    callerPhone: "+15551239876",
    assignedUnits: ["E12", "M3"],
    notes: ["Caller reports SOB.", "Medicine overdue by 45m."],
    sourceVendor: SOURCE,
  },
  {
    incidentId: "staging-inc-e02",
    externalCadId: "CAD-E102-BETA",
    agencyId: STAGING_AGENCY,
    callType: "Structure fire",
    priority: "2",
    status: "active",
    address: "1400 Waterfront Ave, Example City",
    latitude: 37.77065,
    longitude: -122.39212,
    assignedUnits: ["E7", "E9", "L1"],
    notes: ["Working fire on Bravo side.", "Second alarm staged."],
    sourceVendor: SOURCE,
  },
  {
    incidentId: "staging-inc-e03",
    externalCadId: "CAD-E103-GAMMA",
    agencyId: STAGING_AGENCY,
    callType: "Agency assist — traffic stop",
    priority: "3",
    status: "pending",
    address: "I-880 NB @ MM 32",
    latitude: 37.619_905,
    longitude: -122.052_778,
    callerPhone: "+1800555911",
    assignedUnits: [],
    notes: ["Awaiting unit availability."],
    sourceVendor: SOURCE,
  },
];

const BASE_UNITS: readonly Omit<CadUnitRecord, "updatedAt">[] = [
  {
    unitId: "unit-e12",
    externalCadUnitId: "ENG-12",
    agencyId: STAGING_AGENCY,
    unitType: "ENGINE",
    status: "on_scene",
    currentIncidentId: "staging-inc-e01",
    latitude: 37.785991,
    longitude: -122.406612,
    sourceVendor: SOURCE,
  },
  {
    unitId: "unit-m3",
    externalCadUnitId: "MED-3",
    agencyId: STAGING_AGENCY,
    unitType: "MEDIC",
    status: "enroute",
    currentIncidentId: "staging-inc-e01",
    latitude: 37.7842,
    longitude: -122.3988,
    sourceVendor: SOURCE,
  },
  {
    unitId: "unit-e7",
    externalCadUnitId: "ENG-7",
    agencyId: STAGING_AGENCY,
    unitType: "ENGINE",
    status: "on_scene",
    currentIncidentId: "staging-inc-e02",
    latitude: 37.7707,
    longitude: -122.39205,
    sourceVendor: SOURCE,
  },
];

/**
 * Shadow-pilot CAD read adapter: deterministic, realistic payloads without external credentials.
 */
export class StagingCadReadAdapter implements CadReadProvider {
  async healthCheck(): Promise<CadHealthResult> {
    return {
      ok: true,
      mode: "read_only",
      provider: SOURCE,
      detail: "Staging CAD read adapter is healthy (deterministic incidents/units/events).",
    };
  }

  async listActiveIncidents(): Promise<CadIncidentRecord[]> {
    return BASE_INCIDENTS.map((base, ix) => stampIncident(base, ix + 10));
  }

  async getIncidentById(incidentId: string): Promise<CadIncidentRecord | null> {
    const id = incidentId.trim();
    const ix = BASE_INCIDENTS.findIndex((i) => i.incidentId === id);
    if (ix >= 0) {
      const base = BASE_INCIDENTS[ix]!;
      return stampIncident(base, ix + 30);
    }
    return null;
  }

  async listUnits(): Promise<CadUnitRecord[]> {
    return BASE_UNITS.map((u, i) => ({
      ...u,
      updatedAt: offsetIso(nowIso(), -(i + 1) * 45_000),
    }));
  }

  async getUnitStatus(unitId: string): Promise<CadUnitRecord | null> {
    const id = unitId.trim();
    const row = BASE_UNITS.find((u) => u.unitId === id || u.externalCadUnitId === id);
    if (!row) return null;
    return {
      ...row,
      updatedAt: offsetIso(nowIso(), -120_000),
    };
  }

  async getRecentCadEvents(): Promise<CadEventRecord[]> {
    const t = nowIso();
    const incident = BASE_INCIDENTS[1]!;
    return [
      {
        eventId: "staging-cad-ev-1",
        agencyId: STAGING_AGENCY,
        externalCadId: BASE_INCIDENTS[0]!.externalCadId,
        eventType: "UNIT_STATUS_CHANGED",
        payload: { unitId: "E12", prior: "response", next: "on_scene" },
        receivedAt: offsetIso(t, -180_000),
        sourceVendor: SOURCE,
      },
      {
        eventId: "staging-cad-ev-2",
        agencyId: STAGING_AGENCY,
        externalCadId: incident.externalCadId,
        eventType: "NOTE_APPENDED",
        payload: {
          snippet: "Command established; exposure protection on Deck 3.",
          authorRole: "BC",
        },
        receivedAt: offsetIso(t, -90_000),
        sourceVendor: SOURCE,
      },
    ];
  }
}

function stampIncident(base: Omit<CadIncidentRecord, "createdAt" | "updatedAt">, jitterMin: number) {
  const updatedAt = offsetIso(nowIso(), -jitterMin * 60 * 1000);
  const createdAt = offsetIso(updatedAt, -45 * 60 * 1000);
  const out: CadIncidentRecord = {
    ...base,
    createdAt,
    updatedAt,
  };
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function offsetIso(iso: string, ms: number) {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}
