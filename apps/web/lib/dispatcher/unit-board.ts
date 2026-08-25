import type { Incident } from "rapid-cortex-shared";
import type { CadUnitRecord } from "@/lib/rapid-cortex/cad/cad-models";

export const UNIT_BOARD_STATUSES = ["AVAILABLE", "EN_ROUTE", "ON_SCENE", "BUSY", "OFF_DUTY"] as const;
export type UnitBoardStatus = (typeof UNIT_BOARD_STATUSES)[number];

export type UnitBoardRow = {
  id: string;
  status: UnitBoardStatus;
  beat: string;
  etaSeconds: number | null;
  updatedAt: string | null;
  incidentId: string | null;
  source: "cad" | "incident";
};

const STATUS_RANK: Record<UnitBoardStatus, number> = {
  ON_SCENE: 4,
  EN_ROUTE: 3,
  BUSY: 2,
  AVAILABLE: 1,
  OFF_DUTY: 0,
};

export const UNIT_STATUS_LABEL: Record<UnitBoardStatus, string> = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  EN_ROUTE: "EN ROUTE",
  ON_SCENE: "ON SCENE",
  OFF_DUTY: "OFF DUTY",
};

export function mapCadStatus(raw: string | null | undefined): UnitBoardStatus {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (s === "available" || s === "avail" || s === "in_service" || s === "inservice" || s === "clear") {
    return "AVAILABLE";
  }
  if (
    s === "en_route" ||
    s === "enroute" ||
    s === "dispatched" ||
    s === "responding" ||
    s === "response"
  ) {
    return "EN_ROUTE";
  }
  if (s === "on_scene" || s === "onscene" || s === "arrived" || s === "at_scene") {
    return "ON_SCENE";
  }
  if (s === "off_duty" || s === "offduty" || s === "unavailable" || s === "out_of_service") {
    return "OFF_DUTY";
  }
  if (s === "busy" || s === "assigned" || s === "committed" || s === "transporting") {
    return "BUSY";
  }
  return "BUSY";
}

export function incidentStatusToBoard(status: Incident["status"]): UnitBoardStatus | null {
  if (status === "active") return "EN_ROUTE";
  if (status === "in_progress") return "ON_SCENE";
  return null;
}

function beatFromIncident(incident: Incident): string {
  const beat = (incident.cadBeat || "").trim();
  if (beat) return beat.slice(0, 8);
  const loc = (incident.cadLocation || incident.callerAddressLine || "").trim();
  if (!loc) return "—";
  const token = loc.split(/[,\s]+/)[0] ?? "";
  return token.slice(0, 6) || "—";
}

function etaFromIncident(incident: Incident, unitId: string): number | null {
  const details = incident.cadUnitDetails ?? [];
  const hit = details.find((d) => d.unitId.trim().toUpperCase() === unitId.trim().toUpperCase());
  return typeof hit?.etaSeconds === "number" ? hit.etaSeconds : null;
}

function unitKey(id: string): string {
  return id.trim().toUpperCase();
}

export function unitsFromIncidents(incidents: Incident[]): UnitBoardRow[] {
  const byId = new Map<string, UnitBoardRow>();
  for (const incident of incidents) {
    const status = incidentStatusToBoard(incident.status);
    if (!status) continue;
    const ids = incident.cadUnits ?? [];
    for (const raw of ids) {
      const id = raw.trim();
      if (!id) continue;
      const key = unitKey(id);
      const row: UnitBoardRow = {
        id,
        status,
        beat: beatFromIncident(incident),
        etaSeconds: etaFromIncident(incident, id),
        updatedAt: incident.cadLastSyncAt || incident.updatedAt,
        incidentId: incident.incidentId,
        source: "incident",
      };
      const prev = byId.get(key);
      if (!prev || STATUS_RANK[row.status] > STATUS_RANK[prev.status]) {
        byId.set(key, row);
      }
    }
  }
  return [...byId.values()];
}

export function unitsFromCadRecords(
  records: CadUnitRecord[],
  incidents: Incident[],
): UnitBoardRow[] {
  return records.map((u) => {
    const displayId = (u.externalCadUnitId || u.unitId || "").trim() || "—";
    const cadIncident = (u.currentIncidentId ?? "").trim();
    const matched =
      incidents.find(
        (i) =>
          i.incidentId === cadIncident ||
          i.cadIncidentId === cadIncident ||
          (i.cadUnits ?? []).some((id) => unitKey(id) === unitKey(displayId)),
      ) ?? null;
    return {
      id: displayId,
      status: mapCadStatus(u.status),
      beat: (u.beat && u.beat.trim()) || (u.unitType && u.unitType !== "UNKNOWN" ? u.unitType.slice(0, 6) : "—"),
      etaSeconds: typeof u.etaSeconds === "number" ? u.etaSeconds : null,
      updatedAt: u.updatedAt || null,
      incidentId: matched?.incidentId ?? (cadIncident || null),
      source: "cad" as const,
    };
  });
}

/** CAD feed wins on matching call-sign; incident assignments fill gaps. */
export function mergeUnitBoard(cadRows: UnitBoardRow[], incidentRows: UnitBoardRow[]): UnitBoardRow[] {
  const byId = new Map<string, UnitBoardRow>();
  for (const row of incidentRows) byId.set(unitKey(row.id), row);
  for (const row of cadRows) byId.set(unitKey(row.id), row);
  return [...byId.values()].sort((a, b) => {
    const rank = STATUS_RANK[b.status] - STATUS_RANK[a.status];
    if (rank !== 0) return rank;
    return a.id.localeCompare(b.id);
  });
}

export function formatEta(etaSeconds: number | null): string {
  if (etaSeconds == null || etaSeconds < 0) return "—";
  if (etaSeconds < 60) return `${etaSeconds}s`;
  const m = Math.round(etaSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, "0")}m`;
}

export function formatStatusTimer(iso: string | null, now: number): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type CadUnitsResponse = {
  units?: CadUnitRecord[];
};

/** Next.js BFF — not the Lambda API. Fail closed to [] when CAD is off or unauthorized. */
export async function fetchCadUnitBoard(): Promise<CadUnitRecord[]> {
  try {
    const res = await fetch("/api/cad/units", { credentials: "include" });
    if (!res.ok) return [];
    const body = (await res.json()) as CadUnitsResponse;
    return Array.isArray(body.units) ? body.units : [];
  } catch {
    return [];
  }
}
