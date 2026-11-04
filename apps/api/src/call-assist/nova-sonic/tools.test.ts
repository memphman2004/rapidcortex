import { describe, expect, it } from "vitest";
import {
  emergencyHandoffFromTranscript,
  executeNovaSonicTool,
  fallbackHandoff,
  initialHandoff,
  mergeHandoff,
} from "./tools.js";

describe("Nova Sonic tools", () => {
  const ctx = {
    agencyId: "kcpd",
    contactId: "contact-1",
    config: { confirmationPrefix: "KC", operatingHours: { timezone: "America/Chicago" } } as never,
    intake: {},
  };

  it("transfer_emergency sets Connect emergency handoff", () => {
    const result = executeNovaSonicTool("transfer_emergency", { reason: "active fire" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.handoff?.emergencyEscalation).toBe("true");
    expect(result.handoff?.novaSessionStatus).toBe("EMERGENCY");
    expect(result.handoff?.novaSonicFallbackToLex).toBe("false");
  });

  it("issue_report_number completes the call with a confirmation", () => {
    const result = executeNovaSonicTool(
      "issue_report_number",
      { locationText: "4500 Warwick", incidentTypeHint: "abandoned_vehicle" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.handoff?.callerDone).toBe("true");
    expect(result.handoff?.novaSessionStatus).toBe("COMPLETED");
    expect(String(result.payload.confirmationNumber)).toMatch(/^KC-/);
  });

  it("save_intake_fields patches intake without closing", () => {
    const result = executeNovaSonicTool(
      "save_intake_fields",
      { locationText: "4500 Warwick", vehicleDescription: "blue sedan" },
      ctx,
    );
    expect(result.intakePatch?.locationText).toBe("4500 Warwick");
    expect(result.handoff).toBeUndefined();
  });

  it("request_human falls back to Lex", () => {
    const result = executeNovaSonicTool("request_human", { reason: "wants person" }, ctx);
    expect(result.handoff?.novaSonicFallbackToLex).toBe("true");
    expect(result.handoff?.novaSessionStatus).toBe("HUMAN");
  });

  it("emergency interrupt from transcript", () => {
    expect(emergencyHandoffFromTranscript("there's a fire on Main")).toMatchObject({
      emergencyEscalation: "true",
      novaSessionStatus: "EMERGENCY",
    });
    expect(emergencyHandoffFromTranscript("pothole on Main")).toBeNull();
  });

  it("fallback handoff preserves Lex path attrs", () => {
    const handoff = mergeHandoff(initialHandoff(), fallbackHandoff("stream_closed"));
    expect(handoff.novaSonicFallbackToLex).toBe("true");
    expect(handoff.novaFallbackReason).toBe("stream_closed");
  });
});
