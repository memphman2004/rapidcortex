import { describe, expect, it } from "vitest";
import { asLexSlot } from "../slot-extractor.js";
import { resolveFulfillmentAction } from "../fulfillment-hook.js";
import type { LexV2Event } from "../types.js";

function fulfillmentEvent(intent: string, slots: Record<string, ReturnType<typeof asLexSlot> | null>): LexV2Event {
  return {
    invocationSource: "FulfillmentCodeHook",
    sessionId: "test-call",
    inputTranscript: "yes",
    interpretations: [{ intent: { name: intent, slots, state: "ReadyForFulfillment" }, nluConfidence: 0.99 }],
    sessionState: {
      sessionAttributes: { agencyId: "kcpd", callId: "test-call" },
      intent: { name: intent, slots, state: "ReadyForFulfillment" },
    },
  };
}

describe("Fulfillment intercept", () => {
  it("WeaponVisible Yes closes as emergency instead of completing the incident", () => {
    const action = resolveFulfillmentAction(
      fulfillmentEvent("SuspiciousPerson", {
        SuspiciousLocation: asLexSlot("12th and Main"),
        WeaponVisible: asLexSlot("Yes"),
        CallbackNumber: asLexSlot("555-0100"),
      }),
    );
    expect(action).toEqual({ type: "emergency", reason: "EMERGENCY" });
  });

  it("RequestHuman transfers without writing a completed case", () => {
    const action = resolveFulfillmentAction(fulfillmentEvent("RequestHuman", {}));
    expect(action).toMatchObject({ type: "human", intentName: "RequestHuman", reason: "HUMAN_REQUEST" });
  });

  it("NoiseComplaint with no weapon completes normally", () => {
    const action = resolveFulfillmentAction(
      fulfillmentEvent("NoiseComplaint", {
        NoiseLocation: asLexSlot("4200 Main"),
        NoiseType: asLexSlot("music"),
        NoiseStillHappening: asLexSlot("Yes"),
      }),
    );
    expect(action).toEqual({ type: "complete" });
  });
});
