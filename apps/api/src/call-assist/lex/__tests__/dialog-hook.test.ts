import { describe, expect, it } from "vitest";
import { KCPD_LEX_DEMO_SCENARIOS } from "rapid-cortex-shared";
import { defaultTenantConfig } from "../../config-service.js";
import { classifyWithBedrock } from "../intent-classifier.js";
import { asLexSlot } from "../slot-extractor.js";
import { handleDialog, handler, type DialogHookDeps } from "../dialog-hook.js";
import type { LexSlotValue, LexV2Event } from "../types.js";

process.env.CALL_ASSIST_LEX_BEDROCK_MOCK = "1";

function slot(value: string): LexSlotValue {
  return asLexSlot(value);
}

function buildLexEvent(opts: {
  utterance: string;
  intent: string;
  slots?: Record<string, LexSlotValue | null>;
  sessionAttrs?: Record<string, string>;
  nluConfidence?: number;
}): LexV2Event {
  const intentName = opts.intent;
  const slots = opts.slots ?? {};
  const sessionAttributes = opts.sessionAttrs ?? { agencyId: "kcpd", callId: "test-call" };
  const nluConfidence = opts.nluConfidence ?? 0.95;
  return {
    invocationSource: "DialogCodeHook",
    sessionId: sessionAttributes.callId ?? "test-call",
    inputTranscript: opts.utterance,
    interpretations: [
      {
        intent: { name: intentName, slots, state: "InProgress", confirmationState: "None" },
        nluConfidence,
      },
    ],
    sessionState: {
      sessionAttributes,
      intent: { name: intentName, slots, state: "InProgress", confirmationState: "None" },
    },
  };
}

function testDeps(overrides: Partial<DialogHookDeps> = {}): DialogHookDeps {
  const config = {
    ...defaultTenantConfig("kcpd"),
    agencyId: "kcpd",
    agencyShortName: "KCPD",
    shortName: "KCPD",
    vertical: "911" as const,
    uiVertical: "911" as const,
  };
  return {
    getConfig: async () => config,
    classify: async () => ({
      intentName: "NoiseComplaint",
      confidence: 0.9,
      reasoning: "test",
      slots: {},
    }),
    getSession: async () => null,
    updateSession: async () => undefined,
    ...overrides,
  };
}

describe("Dialog hook — Safety gate", () => {
  it("fires TRANSFER_911 on weapons keyword regardless of intent", async () => {
    const event = buildLexEvent({ utterance: "he has a gun", intent: "NoiseComplaint" });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("EmergencyEscalation");
    expect(result.sessionState.dialogAction.type).toBe("Close");
  });

  it("fires on medical emergency even when caller says it is not 911", async () => {
    const event = buildLexEvent({
      utterance: "it's not an emergency but he's not breathing",
      intent: "ReportOnly",
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("EmergencyEscalation");
  });

  it("fires mid-call — scenario kcpd-06", async () => {
    const deps = testDeps();
    const turn1 = buildLexEvent({ utterance: "suspicious person outside", intent: "NonEmergencyPolice" });
    const r1 = await handleDialog(turn1, deps);
    expect(r1.sessionState.intent.name).not.toBe("EmergencyEscalation");

    const turn2 = buildLexEvent({
      utterance: "he just pulled out a gun",
      intent: "NonEmergencyPolice",
      sessionAttrs: r1.sessionState.sessionAttributes ?? { agencyId: "kcpd", callId: "test-call" },
    });
    const r2 = await handleDialog(turn2, deps);
    expect(r2.sessionState.intent.name).toBe("EmergencyEscalation");
    expect(r2.sessionState.sessionAttributes?.transferReason).toBe("EMERGENCY");
    expect(r2.sessionState.sessionAttributes?.transferSummary).toContain("gun");
  });
});

describe("Dialog hook — Slot elicitation", () => {
  it("elicits location first for noise complaint", async () => {
    const event = buildLexEvent({ utterance: "noisy neighbors", intent: "NoiseComplaint", slots: {} });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot", slotToElicit: "location" });
  });

  it("delegates when all required slots are filled", async () => {
    const event = buildLexEvent({
      utterance: "555-0142",
      intent: "NoiseComplaint",
      slots: { location: slot("4200 Main St"), callbackNumber: slot("555-0142") },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.dialogAction.type).toBe("Delegate");
  });
});

describe("Dialog hook — Bedrock fallback", () => {
  it("classifies indirect utterance below Lex confidence", async () => {
    const event = buildLexEvent({
      utterance: "there's drums playing since midnight",
      nluConfidence: 0.3,
      intent: "FallbackIntent",
    });
    const result = await handleDialog(
      event,
      testDeps({
        classify: async () => ({
          intentName: "NoiseComplaint",
          confidence: 0.88,
          reasoning: "bedrock_test",
          slots: {},
        }),
      }),
    );
    expect(result.sessionState.intent.name).not.toBe("FallbackIntent");
  });
});

describe("KCPD demo scenarios — all 10 must pass", () => {
  it.each(KCPD_LEX_DEMO_SCENARIOS)("Scenario $id: $label", async (scenario) => {
    let sessionAttrs: Record<string, string> = { agencyId: "kcpd", callId: `test-${scenario.id}` };
    const deps = testDeps({ classify: classifyWithBedrock });

    for (const utterance of scenario.utterances.slice(0, -1)) {
      const event = buildLexEvent({
        utterance,
        intent: "FallbackIntent",
        sessionAttrs,
        nluConfidence: 0.4,
      });
      const result = await handleDialog(event, deps);
      sessionAttrs = result.sessionState.sessionAttributes ?? sessionAttrs;
      if (result.sessionState.intent.name === "EmergencyEscalation") break;
    }

    expect(sessionAttrs.classification).toBe(scenario.expectedClass);
  });
});

describe("Dialog hook handler export", () => {
  it("exposes a Lambda handler", () => {
    expect(handler).toEqual(expect.any(Function));
  });
});
