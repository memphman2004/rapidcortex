import { describe, expect, it } from "vitest";
import { evaluateSafety, isImmutableEmergency } from "./safety.js";
import { classifyCallTriage } from "./triage.js";
import { recommendRoute } from "./routing.js";
import { extractIntakeFields, mergeIntakeFromLexSlots, intakeCompleteness } from "./intake.js";
import { evaluateCarfaxEligibility } from "./carfax.js";
import { nextIntakeQuestion } from "./questioning.js";
import { KCPD_RFP_DEMO_SCENARIOS, getDemoScenarioById } from "./demo-scenarios.js";
import { kcpdExternalAgencySeed } from "./kcpd-tenant-seed.js";
import { isRetentionDue, MISSOURI_SUNSHINE_RETENTION_POLICY, planCallAssistRetentionActions } from "./retention.js";
import { detectCallAssistLanguage } from "./language.js";
import { callerRequestedHuman } from "./human-request.js";
import { detectTtyMode, formatTtySms } from "./tty.js";
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
    expect(intake.vehicleColor?.toLowerCase()).toBe("white");
  });

  it("stores apartment, cross streets, direction, vehicle set, suspect, weapons, and injuries", () => {
    const intake = extractIntakeFields(
      "Suspicious person at 4200 Oak Street apartment 3B heading north, white Honda Civic plate XYZ999, young male in a hoodie, he has a knife, someone is bleeding",
    );
    expect(intake.apartmentSuite).toBe("3B");
    expect(intake.directionOfTravel).toBe("north");
    expect(intake.vehicleMake?.toLowerCase()).toBe("honda");
    expect(intake.vehicleModel?.toLowerCase()).toBe("civic");
    expect(intake.vehicleColor?.toLowerCase()).toBe("white");
    expect(intake.vehiclePlate).toBe("XYZ999");
    expect(intake.suspectDescription?.toLowerCase()).toMatch(/male/);
    expect(intake.weaponsMentioned).toBe(true);
    expect(intake.weaponsDetail?.toLowerCase()).toBe("knife");
    expect(intake.injuries).toBe(true);
    expect(intake.crossStreets).toBeUndefined();
  });

  it("extracts cross streets from intersection phrasing", () => {
    const intake = extractIntakeFields("It's at the corner of Oak and Main Street");
    expect(intake.crossStreets?.toLowerCase()).toMatch(/oak/);
  });

  it("maps Lex slots onto structured intake fields", () => {
    const intake = mergeIntakeFromLexSlots(
      {
        NoiseLocation: "4200 Main",
        AptBusiness: "3B",
        CrossStreets: "Main and Oak",
        VehicleMake: "Honda",
        VehicleModel: "Civic",
        VehicleColor: "white",
        VehiclePlate: "xyz999",
        PersonDescription: "male in a hoodie",
        PersonDirection: "north",
        WeaponVisible: "Yes",
        AccidentInjuries: "Yes",
      },
      {},
    );
    expect(intake.locationText).toBe("4200 Main");
    expect(intake.apartmentSuite).toBe("3B");
    expect(intake.crossStreets).toBe("Main and Oak");
    expect(intake.vehicleMake).toBe("Honda");
    expect(intake.vehicleModel).toBe("Civic");
    expect(intake.vehicleColor).toBe("white");
    expect(intake.vehiclePlate).toBe("XYZ999");
    expect(intake.suspectDescription).toMatch(/hoodie/);
    expect(intake.directionOfTravel).toBe("north");
    expect(intake.weaponsMentioned).toBe(true);
    expect(intake.injuries).toBe(true);
    expect(intakeCompleteness(intake).filled).toEqual(
      expect.arrayContaining([
        "locationText",
        "apartmentSuite",
        "crossStreets",
        "vehicleMake",
        "vehicleModel",
        "vehicleColor",
        "vehiclePlate",
        "suspectDescription",
        "weaponsMentioned",
        "injuries",
      ]),
    );
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
    expect(formatTtySms("<speak>What is the address?</speak>")).toBe("WHAT IS THE ADDRESS?");
  });

  it("blocks ungrounded medical advice", () => {
    const g = assertGroundedReply({
      proposedText: "I recommend CPR until officers arrive in 4 minutes",
      knowledgeHit: false,
      isEmergencyTransfer: false,
    });
    expect(g.allowed).toBe(false);
  });

  it("blocks information answers when the knowledge base was not queried or missed", () => {
    const g = assertGroundedReply({
      proposedText: "The records window is 8 to 5.",
      knowledgeHit: false,
      isEmergencyTransfer: false,
      requiresKnowledge: true,
    });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe("no_knowledge_base_hit");
  });
});

describe("bid matrix", () => {
  it("covers 26 bid lines including deleted line 12", () => {
    expect(CALL_ASSIST_BID_LINE_MATRIX).toHaveLength(26);
    expect(CALL_ASSIST_BID_LINE_MATRIX.map((r) => r.line)).toEqual([...Array(26).keys()].map((n) => n + 1));
  });
});

describe("Call Assist retention by data type", () => {
  it("plans transcript redaction before full session delete", () => {
    const plan = planCallAssistRetentionActions({
      createdAtIso: "2020-01-01T00:00:00.000Z",
      policy: {
        audioRetentionDays: 1,
        transcriptRetentionDays: 1,
        intakeDataRetentionDays: 3650,
        analyticsRetentionDays: 1,
      },
      legalHold: false,
      nowMs: Date.parse("2020-01-10T00:00:00.000Z"),
    });
    expect(plan.redactTranscript).toBe(true);
    expect(plan.deleteSession).toBe(false);
    expect(plan.deleteSurvey).toBe(true);
  });

  it("skips purge on legal hold", () => {
    const plan = planCallAssistRetentionActions({
      createdAtIso: "2000-01-01T00:00:00.000Z",
      policy: MISSOURI_SUNSHINE_RETENTION_POLICY,
      legalHold: true,
    });
    expect(plan.deleteSession).toBe(false);
    expect(plan.redactTranscript).toBe(false);
  });
});
