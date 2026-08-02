import { describe, it, expect, vi, beforeEach } from "vitest";

const { listByAgency } = vi.hoisted(() => ({ listByAgency: vi.fn() }));

vi.mock("../repositories/smsRoutingRepository.js", () => ({
  SmsRoutingRepository: class {
    listByAgency = listByAgency;
  },
}));

vi.mock("./env.js", () => ({
  env: { smsRoutingTable: "rapid-cortex-sms-routing-test" },
}));

const { resolveAgencySender, resetAgencySenderCache } = await import("./agencySmsSender.js");

function record(over: Partial<Record<string, unknown>> = {}) {
  return {
    phoneNumber: "+14707482763",
    agencyId: "columbus-ga",
    vertical: "911",
    agencyName: "Columbus PD",
    label: "primary",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
    ...over,
  };
}

describe("resolveAgencySender", () => {
  beforeEach(() => {
    listByAgency.mockReset();
    resetAgencySenderCache();
  });

  it("returns the agency's active number", async () => {
    listByAgency.mockResolvedValue([record()]);
    await expect(resolveAgencySender("columbus-ga")).resolves.toBe("+14707482763");
  });

  it("falls back to the shared sender when the agency has no number", async () => {
    listByAgency.mockResolvedValue([]);
    await expect(resolveAgencySender("columbus-ga")).resolves.toBeNull();
  });

  it("ignores deactivated numbers", async () => {
    listByAgency.mockResolvedValue([record({ active: false })]);
    await expect(resolveAgencySender("columbus-ga")).resolves.toBeNull();
  });

  it("never returns another tenant's number", async () => {
    listByAgency.mockResolvedValue([
      record({ agencyId: "someone-else", phoneNumber: "+12025550111" }),
    ]);
    await expect(resolveAgencySender("columbus-ga")).resolves.toBeNull();
  });

  it("picks deterministically when an agency owns several numbers", async () => {
    listByAgency.mockResolvedValue([
      record({ phoneNumber: "+14707482763" }),
      record({ phoneNumber: "+12025550100" }),
    ]);
    await expect(resolveAgencySender("columbus-ga")).resolves.toBe("+12025550100");
  });

  it("caches per agency so a send burst is not a Dynamo query burst", async () => {
    listByAgency.mockResolvedValue([record()]);
    await resolveAgencySender("columbus-ga");
    await resolveAgencySender("columbus-ga");
    expect(listByAgency).toHaveBeenCalledTimes(1);
  });

  it("does not let a lookup failure block an emergency-path send", async () => {
    listByAgency.mockRejectedValue(new Error("ProvisionedThroughputExceeded"));
    await expect(resolveAgencySender("columbus-ga")).resolves.toBeNull();
  });

  it("skips the lookup entirely when the routing table is not configured", async () => {
    vi.resetModules();
    vi.doMock("./env.js", () => ({ env: { smsRoutingTable: "" } }));
    const mod = await import("./agencySmsSender.js");
    await expect(mod.resolveAgencySender("columbus-ga")).resolves.toBeNull();
    expect(listByAgency).not.toHaveBeenCalled();
    vi.doUnmock("./env.js");
  });
});
