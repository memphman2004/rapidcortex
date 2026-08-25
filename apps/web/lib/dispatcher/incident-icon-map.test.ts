import { describe, expect, it } from "vitest";
import { INCIDENT_TYPES } from "@/lib/dispatcher/incident-protocols";
import {
  INCIDENT_ICON_MAP,
  filterIncidentTypesForGrid,
  getIncidentIconEntry,
} from "@/lib/dispatcher/incident-icon-map";

const EXISTING_IDS = [
  "assault",
  "shots_fired",
  "structure_fire",
  "cardiac",
  "mvc",
  "welfare_check",
  "burglary",
  "medical_general",
  "domestic",
  "overdose",
  "disturbance",
  "other",
] as const;

describe("incident icon map", () => {
  it("keeps every original incident type", () => {
    const ids = new Set(INCIDENT_TYPES.map((t) => t.id));
    for (const id of EXISTING_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("maps existing IDs to lucide icons with discipline colors", () => {
    expect(getIncidentIconEntry("assault").color).toBe("#60A5FA");
    expect(getIncidentIconEntry("shots_fired").color).toBe("#60A5FA");
    expect(getIncidentIconEntry("structure_fire").color).toBe("#F87171");
    expect(getIncidentIconEntry("cardiac").color).toBe("#4ADE80");
    expect(getIncidentIconEntry("mvc").color).toBe("#F87171");
    expect(getIncidentIconEntry("medical_general").color).toBe("#4ADE80");
    expect(getIncidentIconEntry("overdose").color).toBe("#4ADE80");
    expect(getIncidentIconEntry("disturbance").color).toBe("#C084FC");
    expect(getIncidentIconEntry("unknown-key").color).toBe("#C084FC");
  });

  it("auto-priority follows the icon map", () => {
    expect(INCIDENT_ICON_MAP["shots-fired"]?.defaultPriority).toBe("P1");
    expect(INCIDENT_ICON_MAP.assault?.defaultPriority).toBe("P2");
    expect(INCIDENT_ICON_MAP.burglary?.defaultPriority).toBe("P3");
    expect(INCIDENT_ICON_MAP.other?.defaultPriority).toBe("P4");
  });

  it("filters by discipline tab and ignores the tab while searching", () => {
    const law = filterIncidentTypesForGrid(INCIDENT_TYPES, "", "law");
    expect(law.every((t) => INCIDENT_ICON_MAP[t.id]?.discipline === "law")).toBe(true);
    expect(law.some((t) => t.id === "assault")).toBe(true);
    expect(law.some((t) => t.id === "cardiac")).toBe(false);

    const fireEms = filterIncidentTypesForGrid(INCIDENT_TYPES, "", "fire_ems");
    expect(
      fireEms.every((t) => {
        const d = INCIDENT_ICON_MAP[t.id]?.discipline;
        return d === "fire" || d === "ems";
      }),
    ).toBe(true);
    expect(fireEms.some((t) => t.id === "structure_fire")).toBe(true);
    expect(fireEms.some((t) => t.id === "cardiac")).toBe(true);
    expect(fireEms.some((t) => t.id === "assault")).toBe(false);

    const other = filterIncidentTypesForGrid(INCIDENT_TYPES, "", "other");
    expect(other.every((t) => INCIDENT_ICON_MAP[t.id]?.discipline === "other")).toBe(true);
    expect(other.some((t) => t.id === "disturbance")).toBe(true);

    const searched = filterIncidentTypesForGrid(INCIDENT_TYPES, "cardiac", "law");
    expect(searched.map((t) => t.id)).toEqual(["cardiac"]);
  });

  it("ALL tab includes every type", () => {
    expect(filterIncidentTypesForGrid(INCIDENT_TYPES, "", "all")).toHaveLength(INCIDENT_TYPES.length);
  });
});
