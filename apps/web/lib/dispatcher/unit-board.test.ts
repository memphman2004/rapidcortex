import { describe, expect, it } from "vitest";
import type { Incident } from "rapid-cortex-shared";
import type { CadUnitRecord } from "@/lib/rapid-cortex/cad/cad-models";
import {
  formatEta,
  formatStatusTimer,
  incidentStatusToBoard,
  mapCadStatus,
  mergeUnitBoard,
  unitsFromCadRecords,
  unitsFromIncidents,
} from "./unit-board";

function incident(partial: Partial<Incident> & Pick<Incident, "incidentId" | "status">): Incident {
  return {
    title: "Test",
    category: "police",
    urgency: "high",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: "",
    createdAt: "2026-08-19T20:00:00.000Z",
    updatedAt: "2026-08-19T21:00:00.000Z",
    agencyId: "ag-1",
    ...partial,
  } as Incident;
}

describe("unit board", () => {
  it("maps CAD vendor status strings", () => {
    expect(mapCadStatus("available")).toBe("AVAILABLE");
    expect(mapCadStatus("EN ROUTE")).toBe("EN_ROUTE");
    expect(mapCadStatus("on-scene")).toBe("ON_SCENE");
    expect(mapCadStatus("Off Duty")).toBe("OFF_DUTY");
    expect(mapCadStatus("dispatched")).toBe("EN_ROUTE");
    expect(mapCadStatus("mystery")).toBe("BUSY");
  });

  it("maps incident lifecycle onto board status and hides closed calls", () => {
    expect(incidentStatusToBoard("active")).toBe("EN_ROUTE");
    expect(incidentStatusToBoard("in_progress")).toBe("ON_SCENE");
    expect(incidentStatusToBoard("completed")).toBeNull();
    expect(incidentStatusToBoard("archived")).toBeNull();
  });

  it("builds rows from live incident unit assignments", () => {
    const rows = unitsFromIncidents([
      incident({
        incidentId: "inc-1",
        status: "active",
        cadUnits: ["101", "204"],
        cadLocation: "4A Townes Way",
      }),
      incident({
        incidentId: "inc-2",
        status: "completed",
        cadUnits: ["101"],
      }),
    ]);
    expect(rows.map((r) => r.id).sort()).toEqual(["101", "204"]);
    expect(rows.find((r) => r.id === "101")?.status).toBe("EN_ROUTE");
    expect(rows.find((r) => r.id === "101")?.incidentId).toBe("inc-1");
  });

  it("keeps the more committed status when a unit is on two open incidents", () => {
    const rows = unitsFromIncidents([
      incident({ incidentId: "a", status: "active", cadUnits: ["312"] }),
      incident({ incidentId: "b", status: "in_progress", cadUnits: ["312"] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ON_SCENE");
    expect(rows[0]?.incidentId).toBe("b");
  });

  it("lets CAD status override incident-derived rows for the same call-sign", () => {
    const incidents = [incident({ incidentId: "inc-1", status: "active", cadUnits: ["E12"] })];
    const cad: CadUnitRecord[] = [
      {
        unitId: "unit-e12",
        externalCadUnitId: "E12",
        agencyId: "ag-1",
        unitType: "ENGINE",
        status: "on_scene",
        currentIncidentId: "inc-1",
        updatedAt: "2026-08-19T21:10:00.000Z",
      },
    ];
    const merged = mergeUnitBoard(unitsFromCadRecords(cad, incidents), unitsFromIncidents(incidents));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("ON_SCENE");
    expect(merged[0]?.source).toBe("cad");
    expect(merged[0]?.beat).toBe("ENGINE");
  });

  it("formats unit ETA as minutes", () => {
    expect(formatEta(null)).toBe("—");
    expect(formatEta(45)).toBe("45s");
    expect(formatEta(180)).toBe("3m");
  });

  it("formats time on status as mm:ss", () => {
    const now = Date.parse("2026-08-19T21:05:00.000Z");
    expect(formatStatusTimer("2026-08-19T21:03:17.000Z", now)).toBe("01:43");
    expect(formatStatusTimer(null, now)).toBe("—");
  });
});
