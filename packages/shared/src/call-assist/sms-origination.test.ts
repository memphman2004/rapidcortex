import { describe, expect, it } from "vitest";
import {
  CALL_ASSIST_SMS_TEST_DID_E164,
  isPreArrivalIqSmsOrigination,
  PRE_ARRIVAL_IQ_SMS_ORIGINATION_E164,
} from "./sms-origination.js";
import { callAssistPollyNeuralVoiceId } from "./nova-sonic.js";

describe("Call Assist SMS origination guard", () => {
  it("detects Pre-Arrival iQ number", () => {
    expect(isPreArrivalIqSmsOrigination(PRE_ARRIVAL_IQ_SMS_ORIGINATION_E164)).toBe(true);
    expect(isPreArrivalIqSmsOrigination("3198358230")).toBe(true);
  });

  it("does not flag the Call Assist test DID", () => {
    expect(isPreArrivalIqSmsOrigination(CALL_ASSIST_SMS_TEST_DID_E164)).toBe(false);
  });
});

describe("Polly Neural voice mapping", () => {
  it("maps en / es / pt locales", () => {
    expect(callAssistPollyNeuralVoiceId("en-US")).toBe("Matthew");
    expect(callAssistPollyNeuralVoiceId("es-US")).toBe("Lupe");
    expect(callAssistPollyNeuralVoiceId("pt-BR")).toBe("Camila");
  });
});
