import { describe, expect, it } from "vitest";
import { resolveTranscriptConnectorRollout } from "./connector-rollout.js";

describe("resolveTranscriptConnectorRollout", () => {
  it("treats empty allowlist as all agencies eligible", () => {
    const r = resolveTranscriptConnectorRollout("on", "any-agency", "");
    expect(r.agencyEligible).toBe(true);
    expect(r.connectorActive).toBe(true);
  });

  it("restricts on mode to allowlisted agencies", () => {
    const r = resolveTranscriptConnectorRollout("on", "agency-b", "agency-a,agency-c");
    expect(r.agencyEligible).toBe(false);
    expect(r.connectorActive).toBe(false);
  });

  it("shadow activates connector when agency is allowlisted", () => {
    const r = resolveTranscriptConnectorRollout("shadow", "agency-a", "agency-a");
    expect(r.connectorActive).toBe(true);
  });
});
