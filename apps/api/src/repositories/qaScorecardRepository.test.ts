import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("./baseRepository.js", () => ({
  ddb: { send },
}));

vi.mock("../lib/env.js", () => ({
  env: { qaScorecardsTable: "rapid-cortex-qa-scorecards-test" },
}));

import { QaScorecardRepository } from "./qaScorecardRepository.js";

describe("QaScorecardRepository.patch", () => {
  const repo = new QaScorecardRepository();

  beforeEach(() => {
    send.mockReset();
  });

  it("binds :aid in ExpressionAttributeValues so ConditionExpression resolves", async () => {
    send.mockResolvedValue({
      Attributes: {
        pk: "agency-a#card-1",
        agencyDispatcherKey: "agency-a#disp-1",
        scorecardId: "card-1",
        agencyId: "agency-a",
        dispatcherId: "disp-1",
        incidentId: "inc-1",
        status: "submitted",
        updatedAt: "2026-05-26T00:00:00.000Z",
      },
    });

    await repo.patch("agency-a", "card-1", {
      status: "submitted",
      updatedAt: "2026-05-26T00:00:00.000Z",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0][0];
    expect(call.input.ConditionExpression).toBe("agencyId = :aid");
    expect(call.input.ExpressionAttributeValues).toEqual(
      expect.objectContaining({ ":aid": "agency-a" }),
    );
  });

  it("binds :aid even when only updatedAt is provided (acknowledge-like minimal patch)", async () => {
    send.mockResolvedValue({
      Attributes: {
        pk: "agency-b#card-9",
        agencyDispatcherKey: "agency-b#disp-9",
        scorecardId: "card-9",
        agencyId: "agency-b",
        dispatcherId: "disp-9",
        incidentId: "inc-9",
        status: "acknowledged",
        acknowledgedAt: "2026-05-26T01:00:00.000Z",
        updatedAt: "2026-05-26T01:00:00.000Z",
      },
    });

    await repo.patch("agency-b", "card-9", {
      acknowledgedAt: "2026-05-26T01:00:00.000Z",
      status: "acknowledged",
      updatedAt: "2026-05-26T01:00:00.000Z",
    });

    const call = send.mock.calls[0][0];
    expect(call.input.ExpressionAttributeValues).toEqual(
      expect.objectContaining({ ":aid": "agency-b" }),
    );
    expect(call.input.Key).toEqual({ pk: "agency-b#card-9" });
  });

  it("returns null when DynamoDB returns no Attributes (conditional-write miss)", async () => {
    send.mockResolvedValue({});
    const out = await repo.patch("agency-c", "missing", {
      updatedAt: "2026-05-26T00:00:00.000Z",
    });
    expect(out).toBeNull();
  });
});
