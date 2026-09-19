import { describe, expect, it } from "vitest";
import { matchTransferRules } from "./rules";
import { berkeleyDemoIncidents, SEED_TRANSFER_RULES } from "./seed";

describe("C2C transfer rules", () => {
  it("routes county-line fire and skips inland traffic stops", () => {
    const incidents = berkeleyDemoIncidents();
    const fire = incidents.find((i) => i.incidentId === "BKC-1001")!;
    const stop = incidents.find((i) => i.incidentId === "BKC-1005")!;
    expect(matchTransferRules(fire, SEED_TRANSFER_RULES).map((r) => r.destAgencyId)).toEqual([
      "charleston-county-sc",
    ]);
    expect(matchTransferRules(stop, SEED_TRANSFER_RULES)).toEqual([]);
  });

  it("matches pursuit without requiring the geo box", () => {
    const pursuit = berkeleyDemoIncidents().find((i) => i.incidentId === "BKC-1003")!;
    expect(matchTransferRules(pursuit, SEED_TRANSFER_RULES).some((r) => r.ruleId === "rule-pursuit")).toBe(true);
  });

  it("does not match fire north of the county-line box", () => {
    const fire = berkeleyDemoIncidents().find((i) => i.incidentId === "BKC-1001")!;
    const inland = { ...fire, latitude: 33.3, longitude: -80.0 };
    expect(matchTransferRules(inland, SEED_TRANSFER_RULES)).toEqual([]);
  });

  it("ignores disabled rules", () => {
    const fire = berkeleyDemoIncidents().find((i) => i.incidentId === "BKC-1001")!;
    const disabled = SEED_TRANSFER_RULES.map((rule) => ({ ...rule, enabled: false }));
    expect(matchTransferRules(fire, disabled)).toEqual([]);
  });
});
