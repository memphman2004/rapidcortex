/**
 * Golden regression cases for buying-intelligence classifiers.
 * These are classification fixtures — NOT hard-coded production opportunities.
 */

import { describe, expect, it } from "vitest";
import { classifyBuyingIntelligence } from "./buying-intelligence.js";

describe("buying intelligence golden set", () => {
  it("Troup County GA — NG911 vendor evaluation (pre-RFP)", () => {
    const intel = classifyBuyingIntelligence({
      title: "Troup County E911 work session — equipment discussion",
      text: `
        E911 equipment discussion. Multiple vendor options including Motorola.
        NG911 infrastructure and fiber/SIP costs reviewed.
        SPLOST funding figures discussed. INdigital quote referenced.
        No formal RFP issued.
      `,
      agencyName: "Troup County E911",
      state: "GA",
    });
    expect(intel.buyingStage).toBe("evaluating");
    expect(intel.buyingSignalType).toBe("evaluation");
    expect(intel.signalStrength === "strong" || intel.signalStrength === "moderate" || intel.signalStrength === "confirmed").toBe(true);
    expect(intel.primaryVertical).toBe("911_psap");
    expect(intel.facts.length).toBeGreaterThan(0);
    expect(intel.inferences.some((i) => /pre-RFP|No formal/i.test(i))).toBe(true);
    expect(intel.matchedCapabilities.length).toBeGreaterThan(0);
  });

  it("Rutland VT — intelligence-center search (LE, not PSAP-only)", () => {
    const intel = classifyBuyingIntelligence({
      title: "Police Chief discusses cameras and intelligence capabilities",
      text: `
        Police department is adding cameras.
        Police Chief stated interest in intelligence center capabilities used in other states.
        Capability reportedly outside the Axon package.
      `,
      agencyName: "Rutland Police",
      state: "VT",
    });
    expect(intel.verticals).toContain("law_enforcement_intelligence");
    expect(intel.buyingStage === "evaluating" || intel.buyingStage === "awareness").toBe(true);
    expect(intel.competitors.some((c) => /axon/i.test(c))).toBe(true);
  });

  it("Wentzville MO — formal RFI is procurement_live / confirmed", () => {
    const intel = classifyBuyingIntelligence({
      title: "Public Safety Software Replacement and Implementation Services",
      text: `
        Request for Information RFI 26-364 for public safety software.
        Official procurement portal. Due October 20, 2026.
      `,
      agencyName: "City of Wentzville",
      state: "MO",
      procurementStage: "rfp",
    });
    expect(intel.buyingStage).toBe("procurement_live");
    expect(intel.signalStrength).toBe("confirmed");
    expect(intel.signalCategory === "formal_rfi" || intel.buyingSignalType === "procurement").toBe(
      true,
    );
  });

  it("Dearborn Heights MI — Axon presentation is competitor evaluating", () => {
    const intel = classifyBuyingIntelligence({
      title: "City Council agenda — Axon presentation",
      text: "Axon presentation scheduled for the public safety committee.",
      agencyName: "Dearborn Heights",
      state: "MI",
    });
    expect(intel.signalCategory).toBe("competitor_presentation");
    expect(intel.buyingStage).toBe("evaluating");
    expect(intel.competitors.some((c) => /axon/i.test(c))).toBe(true);
  });

  it("Hermosa Beach — multi-vendor camera/data matching pain", () => {
    const intel = classifyBuyingIntelligence({
      title: "Police discuss ALPR and camera data matching",
      text: `
        Agency operates Flock, Axon, Genetec, and Vigilant systems.
        Discussion of improving data matching across camera silos.
      `,
      agencyName: "Hermosa Beach PD",
      state: "CA",
    });
    expect(intel.painPoints.some((p) => p.type === "camera_silos" || p.type === "data_silos")).toBe(
      true,
    );
    expect(
      intel.matchedCapabilities.some((c) =>
        ["camera_integration", "video_intelligence", "alpr_integration", "investigative_intelligence"].includes(
          c,
        ),
      ),
    ).toBe(true);
  });

  it("never invents a formal RFP from vague modernization talk", () => {
    const intel = classifyBuyingIntelligence({
      title: "Council discusses cameras",
      text: "Council discussed adding cameras downtown.",
      agencyName: "Example City",
      state: "OH",
    });
    expect(intel.buyingStage).not.toBe("procurement_live");
    expect(intel.signalStrength).not.toBe("confirmed");
    expect(intel.inferences.some((i) => /pre-RFP|No formal/i.test(i))).toBe(true);
  });
});
