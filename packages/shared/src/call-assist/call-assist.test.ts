import { describe, expect, it } from "vitest";
import { evaluateSafety, isImmutableEmergency } from "./safety.js";
import { classifyCallTriage } from "./triage.js";
import { recommendRoute } from "./routing.js";
import { extractIntakeFields } from "./intake.js";
import { evaluateCarfaxEligibility } from "./carfax.js";
import { nextIntakeQuestion } from "./questioning.js";
import { KCPD_RFP_DEMO_SCENARIOS, getDemoScenarioById } from "./demo-scenarios.js";
import { kcpdExternalAgencySeed } from "./kcpd-tenant-seed.js";
import { isRetentionDue, MISSOURI_SUNSHINE_RETENTION_POLICY } from "./retention.js";
import { detectCallAssistLanguage } from "./language.js";
import { callerRequestedHuman } from "./human-request.js";
import { detectTtyMode } from "./tty.js";
import { assertGroundedReply } from "./grounding.js";
import { CALL_ASSIST_BID_LINE_MATRIX } from "./bid-matrix.js";

describe("Call Assist Safety Engine", () => {
  it("transfers to 911 and stops AI when the caller says emergency", () => {
    const d = evaluateSafety("this is an emergency");
    expect(d.action).toBe("TRANSFER_911");
    expect(d.continueAiConversation).toBe(false);
    expect(isImmutableEmergency(d)).toBe(true);
  });

  it("transfers when a gun is disclosed mid-call", () => {
    const d = evaluateSafety("wait he has a gun");
    expect(d.action).toBe("TRANSFER_911");
    expect(d.continueAiConversation).toBe(false);
  });

  it("has no enabled flag — empty config cannot suppress 911", () => {
    expect(Object.keys(evaluateSafety("help me"))).not.toContain("enabled");
    expect(evaluateSafety("help me").action).toBe("TRANSFER_911");
  });
});

describe("Call Assist triage", () => {
  it("cannot override a safety emergency", () => {
    const t = classifyCallTriage("loud music but this is an emergency");
    expect(t.primaryClassification).toBe("EMERGENCY");
    expect(t.continueIntake).toBe(false);
    expect(t.emergencyDetected).toBe(true);
  });

  it("classifies noise and abandoned vehicle", () => {
    expect(classifyCallTriage("loud music from a party").primaryClassification).toBe("NOISE_COMPLAINT");
    expect(classifyCallTriage("abandoned vehicle on Main").primaryClassification).toBe("NON_EMERGENCY_POLICE");
  });
});

describe("Call Assist routing", () => {
  it("routes PUBLIC_WORKS to EXTERNAL_AGENCY when the tenant directory matches", () => {
    const rec = recommendRoute({
      classification: "PUBLIC_WORKS",
      externalAgencies: kcpdExternalAgencySeed("agency-1"),
      intakeSummary: "water main burst",
      callbackNumber: "8165550100",
      locationText: "Oak Street",
    });
    expect(rec.destinationType).toBe("EXTERNAL_AGENCY");
    expect(rec.destinationId).toBe("kc-water");
    expect(rec.spokenReceiverSummary).toMatch(/Oak Street/);
  });

  it("routes EMERGENCY to EMERGENCY_911 even if an external agency is configured", () => {
    const rec = recommendRoute({
      classification: "EMERGENCY",
      externalAgencies: kcpdExternalAgencySeed("agency-1"),
    });
    expect(rec.destinationType).toBe("EMERGENCY_911");
  });
});

describe("intake, CARFAX, questioning", () => {
  it("extracts plate and location", () => {
    const intake = extractIntakeFields("Abandoned at 1200 Main Street plate ABC123 white ford");
    expect(intake.locationText?.toLowerCase()).toContain("1200 main");
    expect(intake.vehiclePlate).toBe("ABC123");
    expect(intake.vehicleMake?.toLowerCase()).toBe("ford");
  });

  it("CARFAX is eligible only when historical vehicle crime with no injury", () => {
    const eligible = evaluateCarfaxEligibility(
      {
        summary: "stolen car yesterday",
        incidentTypeHint: "stolen vehicle",
        vehicleMake: "Honda",
        vehiclePlate: "XYZ999",
        injuries: false,
        isInProgress: false,
        locationText: "800 Walnut",
        callbackNumber: "8165550199",
      },
      { portalUrl: "https://example.test/report" },
    );
    expect(eligible.eligible).toBe(true);
    expect(eligible.smsDeliveryReady).toBe(true);
  });

  it("does not ask more questions after emergency", () => {
    expect(nextIntakeQuestion("EMERGENCY", {})).toBeNull();
  });
});

describe("demo library", () => {
  it("ships 10 base evaluation templates and keeps the first-tenant overlay ids", () => {
    expect(KCPD_RFP_DEMO_SCENARIOS).toHaveLength(10);
    expect(getDemoScenarioById("kcpd-s07")?.expectedTransferTrigger).toBe("EMERGENCY");
    expect(getDemoScenarioById("demo-non-emergency-reveals-emergency")?.expectedTransferTrigger).toBe("EMERGENCY");
  });
});

describe("retention, language, TTY, grounding", () => {
  it("Missouri policy blocks deletion while on legal hold", () => {
    expect(MISSOURI_SUNSHINE_RETENTION_POLICY.statute).toBe("RSMo 610");
    expect(
      isRetentionDue({
        createdAtIso: "2000-01-01T00:00:00.000Z",
        retentionDays: 1,
        legalHold: true,
      }),
    ).toBe(false);
  });

  it("detects Spanish and human-request without treating it as 911", () => {
    expect(detectCallAssistLanguage("Hola, hay un carro abandonado")).toBe("es");
    expect(callerRequestedHuman("I want to speak to a person")).toBe(true);
    expect(evaluateSafety("I want to speak to a person").action).toBe("CONTINUE");
  });

  it("TTY from Connect attributes recommends SMS fallback", () => {
    const d = detectTtyMode({ connectAttributes: { MediaDetection: "TTY" } });
    expect(d.ttyMode).toBe(true);
    expect(d.smsFallbackRecommended).toBe(true);
  });

  it("blocks ungrounded medical advice", () => {
    const g = assertGroundedReply({
      proposedText: "I recommend CPR until officers arrive in 4 minutes",
      knowledgeHit: false,
      isEmergencyTransfer: false,
    });
    expect(g.allowed).toBe(false);
  });
});

describe("bid matrix", () => {
  it("covers 26 bid lines including deleted line 12", () => {
    expect(CALL_ASSIST_BID_LINE_MATRIX).toHaveLength(26);
    expect(CALL_ASSIST_BID_LINE_MATRIX.map((r) => r.line)).toEqual([...Array(26).keys()].map((n) => n + 1));
  });
});
