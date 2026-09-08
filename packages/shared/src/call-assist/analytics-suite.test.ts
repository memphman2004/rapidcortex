import { describe, expect, it } from "vitest";
import { computeCallAssistAnalytics, isContained, peakConcurrent } from "./analytics-suite.js";

describe("Call Assist analytics", () => {
  it("computes AHT, containment, abandonment, CSAT, and diversion", () => {
    const dash = computeCallAssistAnalytics({
      nowMs: Date.parse("2026-01-08T00:00:00.000Z"),
      filter: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-08T00:00:00.000Z" },
      openSessions: [{ sessionId: "open", state: "INTAKE", createdAt: "2026-01-07T12:00:00.000Z" }],
      sessions: [
        {
          sessionId: "a",
          state: "COMPLETED",
          createdAt: "2026-01-02T10:00:00.000Z",
          completedAt: "2026-01-02T10:06:00.000Z",
          language: "en",
          zoneName: "North",
          routingDestinationType: "ONLINE_SERVICE",
          smsStatus: "COMPLETED",
          onlineReportingEligible: true,
          surveyScore: 5,
        },
        {
          sessionId: "b",
          state: "TRANSFERRING_HUMAN",
          createdAt: "2026-01-02T11:00:00.000Z",
          completedAt: "2026-01-02T11:04:00.000Z",
          language: "es",
          humanTakeover: true,
          routingDestinationType: "CALL_TAKER",
        },
        {
          sessionId: "c",
          state: "FAILED",
          createdAt: "2026-01-03T09:00:00.000Z",
          language: "en",
        },
      ],
    });
    expect(dash.ahtSeconds).toBe(5 * 60);
    expect(dash.containmentRate).toBeCloseTo(1 / 2);
    expect(dash.abandonmentRate).toBeCloseTo(1 / 3);
    expect(dash.csatAverage).toBe(5);
    expect(dash.humanTakeoverRate).toBeCloseTo(1 / 3);
    expect(dash.selfServiceCompletionRate).toBe(1);
    expect(dash.queueDepthCurrent).toBe(1);
    expect(dash.heatMaps.language[0]?.key).toBe("en");
  });

  it("treats completed non-emergency AI resolutions as contained", () => {
    expect(
      isContained({
        sessionId: "x",
        state: "COMPLETED",
        createdAt: "t",
        routingDestinationType: "ONLINE_SERVICE",
      }),
    ).toBe(true);
  });

  it("peaks concurrent sessions with a sweep line", () => {
    expect(
      peakConcurrent([
        { sessionId: "1", state: "COMPLETED", createdAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-01T01:00:00.000Z" },
        { sessionId: "2", state: "COMPLETED", createdAt: "2026-01-01T00:30:00.000Z", completedAt: "2026-01-01T01:30:00.000Z" },
      ]),
    ).toBe(2);
  });
});
