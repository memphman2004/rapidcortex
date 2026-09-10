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
  sentiment?: { sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED"; negative: number };
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
        ...(opts.sentiment
          ? {
              sentimentResponse: {
                sentiment: opts.sentiment.sentiment,
                sentimentScore: {
                  positive: 0.05,
                  negative: opts.sentiment.negative,
                  mixed: 0.05,
                  neutral: 0.1,
                },
              },
            }
          : {}),
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
  it("elicits NoiseLocation first for noise complaint", async () => {
    const event = buildLexEvent({ utterance: "noisy neighbors", intent: "NoiseComplaint", slots: {} });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot", slotToElicit: "NoiseLocation" });
  });

  it("still elicits legacy location when that slot name is present", async () => {
    const event = buildLexEvent({
      utterance: "noisy neighbors",
      intent: "NoiseComplaint",
      slots: { location: null, callbackNumber: null },
    });
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

describe("First-tenant demo scenarios (KCPD overlay) — all 10 must pass", () => {
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

describe("Dialog hook — WeaponVisible intercept", () => {
  it("closes EmergencyEscalation when WeaponVisible is Yes without collecting more slots", async () => {
    const event = buildLexEvent({
      utterance: "yes",
      intent: "SuspiciousPerson",
      slots: {
        SuspiciousLocation: slot("12th and Main"),
        PersonDescription: slot("male in a dark hoodie"),
        PersonDirection: slot("still there"),
        WeaponVisible: slot("Yes"),
        CallbackNumber: null,
        CallerSafeLocation: null,
      },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("EmergencyEscalation");
    expect(result.sessionState.dialogAction.type).toBe("Close");
    expect(result.sessionState.sessionAttributes?.transferReason).toBe("EMERGENCY");
    expect(result.sessionState.sessionAttributes?.emergency).toBe("true");
    expect(result.sessionState.dialogAction).not.toMatchObject({ slotToElicit: "CallbackNumber" });
  });

  it("does not escalate when WeaponVisible is No", async () => {
    const event = buildLexEvent({
      utterance: "no",
      intent: "SuspiciousPerson",
      slots: {
        SuspiciousLocation: slot("12th and Main"),
        PersonDescription: slot("male in a dark hoodie"),
        PersonDirection: slot("still there"),
        WeaponVisible: slot("No"),
        CallbackNumber: null,
        CallerSafeLocation: null,
      },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("SuspiciousPerson");
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot", slotToElicit: "CallbackNumber" });
  });
});

describe("Dialog hook — RequestHuman", () => {
  it("transfers to a person before continuing slot collection", async () => {
    const event = buildLexEvent({
      utterance: "I want to speak to an officer",
      intent: "NoiseComplaint",
      slots: { NoiseLocation: null },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("RequestHuman");
    expect(result.sessionState.dialogAction.type).toBe("Close");
    expect(result.sessionState.sessionAttributes?.transferReason).toBe("HUMAN_REQUEST");
  });
});

describe("Dialog hook handler export", () => {
  it("exposes a Lambda handler", () => {
    expect(handler).toEqual(expect.any(Function));
  });
});

describe("Dialog hook — confidence control plane", () => {
  it("auto-escalates when agency escalate threshold is not met", async () => {
    const config = {
      ...defaultTenantConfig("kcpd"),
      agencyId: "kcpd",
      confidenceThresholds: { emergency: 0.7, escalate: 0.9, selfService: 0.95 },
    };
    const event = buildLexEvent({
      utterance: "something vague",
      intent: "NoiseComplaint",
      nluConfidence: 0.4,
    });
    const result = await handleDialog(
      event,
      testDeps({
        getConfig: async () => config,
        classify: async () => ({ intentName: "FallbackIntent", confidence: 0.2, reasoning: "low", slots: {} }),
      }),
    );
    expect(result.sessionState.intent.name).toBe("FallbackIntent");
    expect(result.sessionState.sessionAttributes?.confidenceAction).toBe("escalate_human");
    expect(result.sessionState.sessionAttributes?.transferReason).toBe("LOW_CONFIDENCE");
  });
});

describe("Dialog hook — barge-in resume", () => {
  it("keeps collected slots and resumes the next missing field after interrupt", async () => {
    const event = buildLexEvent({
      utterance: "music",
      intent: "NoiseComplaint",
      slots: { NoiseLocation: slot("4200 Main"), NoiseType: null, NoiseStillHappening: null },
      sessionAttrs: { agencyId: "kcpd", callId: "test-call", promptSlot: "NoiseType", bargeInCount: "0" },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.intent.name).toBe("NoiseComplaint");
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot" });
    expect(Number(result.sessionState.sessionAttributes?.bargeInCount)).toBeGreaterThanOrEqual(1);
    expect(result.sessionState.sessionAttributes?.bargeInEnabled).toBe("true");
  });

  it("does not count a normal slot answer as barge-in", async () => {
    const event = buildLexEvent({
      utterance: "music",
      intent: "NoiseComplaint",
      slots: { NoiseLocation: slot("4200 Main"), NoiseType: slot("music"), NoiseStillHappening: null },
      sessionAttrs: { agencyId: "kcpd", callId: "test-call", promptSlot: "NoiseType", bargeInCount: "0" },
    });
    const result = await handleDialog(event, testDeps());
    expect(Number(result.sessionState.sessionAttributes?.bargeInCount ?? "0")).toBe(0);
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot", slotToElicit: "NoiseStillHappening" });
  });
});

describe("Dialog hook — knowledge grounding", () => {
  it("answers InformationRequest only from the agency knowledge base", async () => {
    const event = buildLexEvent({
      utterance: "what are your hours",
      intent: "InformationRequest",
      slots: { InformationTopic: slot("hours") },
    });
    const result = await handleDialog(
      event,
      testDeps({
        listKnowledge: async () => [
          {
            agencyId: "kcpd",
            articleId: "hours",
            title: "Non-emergency hours",
            body: "The non-emergency line is open 24 hours.",
            tags: ["hours"],
            enabled: true,
            updatedAt: "2026-09-08T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(result.sessionState.dialogAction.type).toBe("Close");
    expect(result.messages?.[0]?.content).toMatch(/24 hours/);
    expect(result.sessionState.sessionAttributes?.knowledgeHit).toBe("true");
  });

  it("transfers when the knowledge base has no hit", async () => {
    const event = buildLexEvent({
      utterance: "what is the fine for jaywalking",
      intent: "InformationRequest",
      slots: { InformationTopic: slot("jaywalking fine") },
    });
    const result = await handleDialog(event, testDeps({ listKnowledge: async () => [] }));
    expect(result.sessionState.intent.name).toBe("FallbackIntent");
    expect(result.sessionState.sessionAttributes?.transferReason).toBe("LOW_CONFIDENCE");
  });
});

describe("Dialog hook — structured intake follow-up", () => {
  it("elicits apartment after required noise slots", async () => {
    const event = buildLexEvent({
      utterance: "no callback",
      intent: "NoiseComplaint",
      slots: {
        NoiseLocation: slot("4200 Main"),
        NoiseType: slot("music"),
        NoiseStillHappening: slot("Yes"),
        CallbackNumber: slot("555-0142"),
        AptBusiness: null,
        CrossStreets: null,
      },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.dialogAction).toMatchObject({ type: "ElicitSlot", slotToElicit: "AptBusiness" });
  });
});

describe("Dialog hook — Lex sentiment", () => {
  it("copies Lex sentiment onto session attributes", async () => {
    const event = buildLexEvent({
      utterance: "this is ridiculous",
      intent: "NoiseComplaint",
      sentiment: { sentiment: "NEGATIVE", negative: 0.91 },
    });
    const result = await handleDialog(event, testDeps());
    expect(result.sessionState.sessionAttributes?.sentiment).toBe("NEGATIVE");
    expect(result.sessionState.sessionAttributes?.sentimentNegative).toBe("0.91");
  });
});

describe("Dialog hook — greeting session start", () => {
  it("Welcome intent returns the Dynamo greeting and does not hardcode a city in Lex", async () => {
    const config = {
      ...defaultTenantConfig("springfield"),
      agencyId: "springfield",
      agencyName: "Springfield Police Department",
      tenantCity: "City of Springfield",
      callAssistGreeting: {
        mode: "stay_on_line" as const,
        cityName: "City of Springfield",
        agencyName: "Springfield Police Department",
        lineDescription: "non-emergency service line",
        escalationMode: "announce_and_transfer" as const,
        speakEscalationAnnouncement: true,
        enableColdClimateIntents: false,
        enableLiveAgentHandoff: true,
        greetingPreviewConfirmed: true,
      },
    };
    const event = buildLexEvent({
      utterance: "hello",
      intent: "Welcome",
      sessionAttrs: { agencyId: "springfield", callId: "test-call" },
    });
    const result = await handleDialog(event, testDeps({ getConfig: async () => config }));
    expect(result.sessionState.dialogAction.type).toBe("ElicitIntent");
    expect(result.messages?.[0]?.content).toContain("City of Springfield");
    expect(result.messages?.[0]?.content).not.toMatch(/Kansas City|KCPD/i);
    expect(result.sessionState.sessionAttributes?.greetingDelivered).toBe("true");
  });

  it("silent_transfer emergency close speaks nothing", async () => {
    const config = {
      ...defaultTenantConfig("springfield"),
      agencyId: "springfield",
      callAssistGreeting: {
        mode: "stay_on_line" as const,
        cityName: "City of Springfield",
        agencyName: "Springfield PD",
        lineDescription: "non-emergency service line",
        escalationMode: "silent_transfer" as const,
        speakEscalationAnnouncement: false,
        enableColdClimateIntents: false,
        enableLiveAgentHandoff: true,
        greetingPreviewConfirmed: true,
      },
    };
    const event = buildLexEvent({
      utterance: "he has a gun",
      intent: "NoiseComplaint",
      sessionAttrs: { agencyId: "springfield", callId: "test-call", greetingDelivered: "true" },
    });
    const result = await handleDialog(event, testDeps({ getConfig: async () => config }));
    expect(result.sessionState.intent.name).toBe("EmergencyEscalation");
    expect(result.sessionState.sessionAttributes?.escalationMode).toBe("silent_transfer");
    expect(result.messages ?? []).toHaveLength(0);
  });
});
