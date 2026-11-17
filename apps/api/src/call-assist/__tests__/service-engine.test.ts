/**
 * Phase 2 — Service Execution Engine tests
 *
 * Pure unit tests — no DynamoDB, no AWS calls.
 * All logic is tested via shared package functions.
 */
import { describe, it, expect } from "vitest";

import {
  resolveServiceRequest,
  isMunicipalServiceExpansionEnabled,
  serviceConfirmationText,
  catalogGapSummary,
  getPlaybookForDepartment,
  listPlaybookDepartments,
  playbookAutoEscalate,
  playbookIntakeFields,
  playbookSlaMinutes,
  PLAYBOOK_SCHEMA_VERSION,
} from "rapid-cortex-shared";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

describe("isMunicipalServiceExpansionEnabled", () => {
  it("returns false when config is null", () => {
    expect(isMunicipalServiceExpansionEnabled(null)).toBe(false);
  });

  it("returns false when config is undefined", () => {
    expect(isMunicipalServiceExpansionEnabled(undefined)).toBe(false);
  });

  it("returns false when flag is absent (default OFF)", () => {
    expect(isMunicipalServiceExpansionEnabled({})).toBe(false);
  });

  it("returns false when explicitly false", () => {
    expect(isMunicipalServiceExpansionEnabled({ municipalServiceExpansionEnabled: false })).toBe(false);
  });

  it("returns true when explicitly true", () => {
    expect(isMunicipalServiceExpansionEnabled({ municipalServiceExpansionEnabled: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Playbook registry
// ---------------------------------------------------------------------------

describe("getPlaybookForDepartment", () => {
  it("returns null for unknown department", () => {
    expect(getPlaybookForDepartment("UNKNOWN_DEPT")).toBeNull();
  });

  it("returns playbook for PUBLIC_WORKS", () => {
    const p = getPlaybookForDepartment("PUBLIC_WORKS");
    expect(p).not.toBeNull();
    expect(p!.departmentId).toBe("PUBLIC_WORKS");
    expect(p!.version).toBe(PLAYBOOK_SCHEMA_VERSION);
  });

  it("returns playbook for SANITATION", () => {
    const p = getPlaybookForDepartment("SANITATION");
    expect(p?.departmentId).toBe("SANITATION");
  });

  it("returns playbook for WATER_SEWER_AUTHORITY", () => {
    const p = getPlaybookForDepartment("WATER_SEWER_AUTHORITY");
    expect(p?.departmentId).toBe("WATER_SEWER_AUTHORITY");
  });

  it("returns playbook for THREE11_OPERATIONS", () => {
    const p = getPlaybookForDepartment("THREE11_OPERATIONS");
    expect(p?.departmentId).toBe("THREE11_OPERATIONS");
  });

  it("lists 14 departments with registered playbooks", () => {
    expect(listPlaybookDepartments().length).toBe(14);
  });
});

describe("playbookIntakeFields", () => {
  it("returns empty array for unknown department", () => {
    expect(playbookIntakeFields("UNKNOWN_DEPT")).toEqual([]);
  });

  it("PUBLIC_WORKS first field is address", () => {
    const fields = playbookIntakeFields("PUBLIC_WORKS");
    expect(fields[0]?.name).toBe("incidentLocation");
    expect(fields[0]?.type).toBe("address");
  });

  it("ANIMAL_CONTROL has isAggressive yesno field", () => {
    const fields = playbookIntakeFields("ANIMAL_CONTROL");
    const aggField = fields.find((f) => f.name === "isAggressive");
    expect(aggField?.type).toBe("yesno");
    expect(aggField?.required).toBe(true);
  });

  it("all required fields have voicePrompt", () => {
    for (const deptId of listPlaybookDepartments()) {
      const fields = playbookIntakeFields(deptId);
      for (const f of fields) {
        if (f.required) {
          expect(f.voicePrompt, `${deptId}.${f.name} missing voicePrompt`).toBeTruthy();
        }
      }
    }
  });
});

describe("playbookSlaMinutes", () => {
  it("returns undefined for unknown department", () => {
    expect(playbookSlaMinutes("UNKNOWN_DEPT")).toBeUndefined();
  });

  it("PUBLIC_WORKS has 480m SLA", () => {
    expect(playbookSlaMinutes("PUBLIC_WORKS")).toBe(480);
  });

  it("PARKING_ENFORCEMENT has 120m SLA (fastest)", () => {
    expect(playbookSlaMinutes("PARKING_ENFORCEMENT")).toBe(120);
  });
});

describe("playbookAutoEscalate", () => {
  it("returns false for unknown department", () => {
    expect(playbookAutoEscalate("UNKNOWN_DEPT", "flooding")).toBe(false);
  });

  it("returns false when no keywords match", () => {
    expect(playbookAutoEscalate("PUBLIC_WORKS", "pothole on main street")).toBe(false);
  });

  it("triggers on 'sinkhole' for PUBLIC_WORKS", () => {
    expect(playbookAutoEscalate("PUBLIC_WORKS", "there is a sinkhole on 5th")).toBe(true);
  });

  it("triggers on 'sewage in street' for WATER_SEWER_AUTHORITY", () => {
    expect(playbookAutoEscalate("WATER_SEWER_AUTHORITY", "sewage in street by my house")).toBe(true);
  });

  it("triggers on 'biting' for ANIMAL_CONTROL", () => {
    expect(playbookAutoEscalate("ANIMAL_CONTROL", "dog is biting kids")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(playbookAutoEscalate("WATER_SEWER_AUTHORITY", "Water Main Broke")).toBe(true);
  });

  it("returns false for departments with no autoEscalateIfKeywords", () => {
    // PARKS_RECREATION has no autoEscalateIfKeywords
    expect(playbookAutoEscalate("PARKS_RECREATION", "flooding at park")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveServiceRequest — flag off (flag = false)
// ---------------------------------------------------------------------------

describe("resolveServiceRequest — flag off", () => {
  it("returns unknown for empty utterance", () => {
    const r = resolveServiceRequest({ utterance: "", enableEnhanced: false });
    expect(r.kind).toBe("unknown");
  });

  it("returns emergency when Lex intent is RedirectToEmergencyServices", () => {
    // Emergency is routed by Lex *before* the service engine for bare utterances.
    // The engine only receives the emergency kind from municipalRouteOverride when
    // the Lex intent is explicitly RedirectToEmergencyServices.
    const r = resolveServiceRequest({
      utterance: "someone is having a heart attack",
      incidentType: "RedirectToEmergencyServices",
      enableEnhanced: false,
    });
    expect(r.kind).toBe("emergency");
  });

  it("does not include playbook metadata when flag is off", () => {
    const r = resolveServiceRequest({
      utterance: "there is a pothole on elm street",
      enableEnhanced: false,
    });
    if (r.kind === "department_intake") {
      expect(r.playbook).toBeUndefined();
      expect(r.intakeFields).toBeUndefined();
    }
    // If routing falls through, still no playbook
    expect(r.playbook).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveServiceRequest — flag on (enhanced)
// ---------------------------------------------------------------------------

describe("resolveServiceRequest — flag on (enhanced)", () => {
  it("routes 311 lifecycle intents to THREE11_OPERATIONS", () => {
    const r = resolveServiceRequest({
      utterance: "I want to check on my report",
      incidentType: "CheckServiceRequestStatus",
      enableEnhanced: true,
    });
    expect(r.kind).toBe("lifecycle");
    expect(r.departmentId).toBe("THREE11_OPERATIONS");
  });

  it("routes status check utterance without intent", () => {
    const r = resolveServiceRequest({
      utterance: "can you check the status of my report",
      enableEnhanced: true,
    });
    expect(r.kind).toBe("lifecycle");
  });

  it("routes 'reopen' utterance to lifecycle kind", () => {
    const r = resolveServiceRequest({
      utterance: "I want to reopen my closed request",
      enableEnhanced: true,
    });
    expect(r.kind).toBe("lifecycle");
  });

  it("includes intake fields in department_intake result", () => {
    const r = resolveServiceRequest({
      utterance: "I want to report a pothole",
      incidentType: "ReportRoadsInfrastructure",
      enableEnhanced: true,
    });
    if (r.kind === "department_intake") {
      expect(r.intakeFields).toBeDefined();
      expect((r.intakeFields ?? []).length).toBeGreaterThan(0);
    }
  });

  it("includes autoEscalate true for sinkhole in PUBLIC_WORKS", () => {
    const r = resolveServiceRequest({
      utterance: "there is a sinkhole on main street blocking traffic",
      incidentType: "ReportRoadsInfrastructure",
      enableEnhanced: true,
    });
    if (r.kind === "department_intake") {
      expect(r.autoEscalate).toBe(true);
    }
  });

  it("returns emergency kind when Lex signals RedirectToEmergencyServices (flag on)", () => {
    // Emergency routing is enforced by Lex before the service engine receives the call.
    // The engine propagates the kind when municipalRouteOverride returns "emergency".
    const r = resolveServiceRequest({
      utterance: "my house is on fire please help",
      incidentType: "RedirectToEmergencyServices",
      enableEnhanced: true,
    });
    expect(r.kind).toBe("emergency");
  });

  it("includes slaMinutes in result", () => {
    const r = resolveServiceRequest({
      utterance: "my trash wasn't picked up today",
      incidentType: "ReportSanitationWaste",
      enableEnhanced: true,
    });
    if (r.kind === "department_intake") {
      expect(r.slaMinutes).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// serviceConfirmationText
// ---------------------------------------------------------------------------

describe("serviceConfirmationText", () => {
  it("substitutes confirmation number in template", () => {
    const text = serviceConfirmationText({
      departmentId: "SANITATION",
      confirmationNumber: "KC-2024-XYZ1",
    });
    expect(text).toContain("KC-2024-XYZ1");
    expect(text).toContain("Sanitation");
  });

  it("falls back gracefully for unknown department", () => {
    const text = serviceConfirmationText({
      departmentId: "UNKNOWN",
      confirmationNumber: "KC-2024-TEST",
    });
    expect(text).toContain("KC-2024-TEST");
    expect(text).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// catalogGapSummary
// ---------------------------------------------------------------------------

describe("catalogGapSummary", () => {
  it("computes correct activation gap", () => {
    const summary = catalogGapSummary({
      serviceRegistryCount: 1163,
      liveMunicipalIssueCount: 76,
      liveDepartments: ["PUBLIC_WORKS", "SANITATION", "WATER_SEWER_AUTHORITY"],
    });
    expect(summary.candidateCount).toBe(1163);
    expect(summary.liveIssueCount).toBe(76);
    expect(summary.activationGap).toBe(1163 - 76);
    expect(summary.coveragePct).toBe(Math.round((76 / 1163) * 100));
    expect(summary.uncoveredDepartments.length).toBeGreaterThan(0);
    expect(summary.uncoveredDepartments).not.toContain("PUBLIC_WORKS");
    expect(summary.uncoveredDepartments).toContain("ANIMAL_CONTROL");
  });

  it("handles zero service registry count without division by zero", () => {
    const summary = catalogGapSummary({
      serviceRegistryCount: 0,
      liveMunicipalIssueCount: 0,
      liveDepartments: [],
    });
    expect(summary.coveragePct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Playbook schema invariants (all 14 playbooks)
// ---------------------------------------------------------------------------

describe("All playbooks: schema invariants", () => {
  for (const deptId of listPlaybookDepartments()) {
    it(`${deptId}: has valid citizenConfirmation template`, () => {
      const p = getPlaybookForDepartment(deptId)!;
      expect(p.citizenConfirmation).toContain("{confirmationNumber}");
    });

    it(`${deptId}: has at least one intake field`, () => {
      const p = getPlaybookForDepartment(deptId)!;
      expect(p.intakeFields.length).toBeGreaterThan(0);
    });

    it(`${deptId}: has at least one resolution step`, () => {
      const p = getPlaybookForDepartment(deptId)!;
      expect(p.resolutionSteps.length).toBeGreaterThan(0);
    });

    it(`${deptId}: defaultSlaMinutes is positive`, () => {
      const p = getPlaybookForDepartment(deptId)!;
      expect(p.defaultSlaMinutes).toBeGreaterThan(0);
    });
  }
});
