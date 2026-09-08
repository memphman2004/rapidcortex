import { describe, expect, it } from "vitest";
import {
  applyCallbackAttempt,
  callbackIsDue,
  callerAcceptedOffer,
  callerDeclinedOffer,
  callerRequestedCallback,
  DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS,
  nextCallbackDueAt,
  shouldOfferCallback,
  type CallAssistCallbackCampaign,
} from "./callback.js";

function campaign(over: Partial<CallAssistCallbackCampaign> = {}): CallAssistCallbackCampaign {
  return {
    callbackId: "cb_1",
    sessionId: "cas_1",
    agencyId: "agency-1",
    status: "QUEUED",
    phoneE164: "+18165550100",
    attempts: [],
    maxAttempts: 3,
    retryMinutes: 15,
    dueAt: "2026-01-01T00:00:00.000Z",
    offeredAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("Call Assist callback campaign", () => {
  it("offers after hours, overflow, or an explicit callback request", () => {
    expect(
      shouldOfferCallback({
        settings: DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS,
        hoursOpen: false,
        mode: "NON_EMERGENCY",
        utterance: "parking ticket",
        alreadyOffered: false,
        emergencyDetected: false,
      }),
    ).toBe(true);
    expect(callerRequestedCallback("can you call me back")).toBe(true);
    expect(
      shouldOfferCallback({
        settings: DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS,
        hoursOpen: true,
        mode: "OVERFLOW",
        utterance: "noise",
        alreadyOffered: false,
        emergencyDetected: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferCallback({
        settings: DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS,
        hoursOpen: true,
        mode: "NON_EMERGENCY",
        utterance: "noise",
        alreadyOffered: false,
        emergencyDetected: true,
      }),
    ).toBe(false);
  });

  it("parses accept and decline", () => {
    expect(callerAcceptedOffer("yes please")).toBe(true);
    expect(callerDeclinedOffer("no thanks")).toBe(true);
  });

  it("retries until max attempts then fails", () => {
    const first = applyCallbackAttempt(
      campaign(),
      { attempt: 1, at: "2026-01-01T00:01:00.000Z", result: "no_answer" },
      "2026-01-01T00:01:00.000Z",
    );
    expect(first.status).toBe("QUEUED");
    expect(callbackIsDue(first, Date.parse(first.dueAt))).toBe(true);
    const second = applyCallbackAttempt(
      first,
      { attempt: 2, at: "2026-01-01T00:20:00.000Z", result: "busy" },
      "2026-01-01T00:20:00.000Z",
    );
    const failed = applyCallbackAttempt(
      second,
      { attempt: 3, at: "2026-01-01T00:40:00.000Z", result: "failed", reason: "no_answer" },
      "2026-01-01T00:40:00.000Z",
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBe("max_attempts");
  });

  it("marks takeover and connected", () => {
    const live = applyCallbackAttempt(
      campaign(),
      { attempt: 1, at: "t", result: "connected", contactId: "c1" },
      "t",
    );
    expect(live.status).toBe("IN_PROGRESS");
    const grab = applyCallbackAttempt(
      campaign(),
      { attempt: 1, at: "t", result: "taken_over" },
      "t",
    );
    expect(grab.status).toBe("TAKEN_OVER");
  });

  it("schedules retry due times", () => {
    const due = nextCallbackDueAt(15, Date.parse("2026-01-01T00:00:00.000Z"));
    expect(due).toBe("2026-01-01T00:15:00.000Z");
  });
});
